use crate::storage::{read_file, write_atomic, write_json};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    fs, io,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub opened_at: i64,
}

pub struct Files {
    pub root: PathBuf,
    pub active: HashMap<String, String>,
    pub selected: HashSet<String>,
    pub startup: Vec<PathBuf>,
    startup_ready: bool,
    recent: Vec<RecentFile>,
    reference_chunks: crate::project::ReferenceChunkCache,
}

fn error(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

pub fn basename(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

fn key(path: &str) -> String {
    if cfg!(windows) {
        path.to_lowercase().replace('/', "\\")
    } else {
        path.into()
    }
}

pub fn launch_paths(arguments: &[String], cwd: &Path) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    arguments
        .iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| {
            let path = cwd.join(arg);
            let extension = path.extension()?.to_str()?.to_ascii_lowercase();
            if ![
                "pix", "json", "png", "jpg", "jpeg", "webp", "bmp", "gif", "svg", "ico", "ase", "aseprite",
            ]
            .contains(&extension.as_str())
            {
                return None;
            }
            seen.insert(key(&path.to_string_lossy())).then_some(path)
        })
        .collect()
}

pub fn decode_bytes(name: &str, bytes: &[u8], file_path: Option<&str>) -> io::Result<Value> {
    let extension = Path::new(name)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let mime = match extension.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "gif" => Some("image/gif"),
        "svg" => Some("image/svg+xml"),
        "ico" => Some("image/x-icon"),
        _ => None,
    };
    if let Some(mime) = mime {
        return Ok(
            json!({"name": name, "filePath": null, "type": if extension == "gif" { "gif" } else { "image" }, "mime": mime, "sourcePath": file_path, "data": STANDARD.encode(bytes)}),
        );
    }
    if extension == "ase" || extension == "aseprite" {
        let mut imported = crate::aseprite::decode(bytes, name)?;
        imported["type"] = json!("aseprite");
        imported["name"] = json!(name);
        imported["filePath"] = json!(file_path);
        return Ok(imported);
    }
    if extension != "pix" {
        return Err(error("不支持此文件格式"));
    }
    if bytes.starts_with(b"MPIXPAL\0") {
        return Ok(json!({"name":name,"type":"palette","filePath":null,"data":STANDARD.encode(bytes)}));
    }
    let document = crate::project::decode(bytes)?;
    Ok(
        json!({"name": name, "filePath": file_path, "type": "project", "data": serde_json::to_string(&document)?}),
    )
}

pub fn read_reference(path: &Path) -> io::Result<Value> {
    let text = path.to_string_lossy();
    let file = decode_bytes(&basename(path), &read_file(path)?, Some(&text))?;
    if file["mime"].as_str().is_none() { return Err(error("参考文件必须是图片")); }
    Ok(file)
}

impl Files {
    pub fn new(root: PathBuf) -> io::Result<Self> {
        fs::create_dir_all(&root)?;
        let path = root.join("recent-files.json");
        let recent = if path.exists() {
            serde_json::from_slice(&read_file(&path)?)?
        } else {
            Vec::new()
        };
        let startup = launch_paths(
            &std::env::args().collect::<Vec<_>>(),
            &std::env::current_dir()?,
        );
        Ok(Self {
            root,
            active: HashMap::new(),
            selected: HashSet::new(),
            startup,
            startup_ready: false,
            recent,
            reference_chunks: crate::project::ReferenceChunkCache::default(),
        })
    }

    pub fn receive_launch(&mut self, paths: Vec<PathBuf>) -> Vec<PathBuf> {
        if self.startup_ready {
            paths
        } else {
            self.startup.extend(paths);
            Vec::new()
        }
    }

    pub fn take_startup(&mut self) -> Vec<PathBuf> {
        self.startup_ready = true;
        std::mem::take(&mut self.startup)
    }

    fn persist_recent(&self) -> io::Result<()> {
        write_json(&self.root.join("recent-files.json"), &self.recent)
    }

    pub fn add_recent(&mut self, path: &Path) -> io::Result<()> {
        let path = fs::canonicalize(path)?;
        // canonicalize on Windows returns a verbatim prefix; keep UI paths conventional.
        let text = path
            .to_string_lossy()
            .trim_start_matches("\\\\?\\")
            .to_owned();
        self.recent.retain(|entry| key(&entry.path) != key(&text));
        self.recent.insert(
            0,
            RecentFile {
                path: text,
                name: basename(&path),
                opened_at: chrono::Utc::now().timestamp_millis(),
            },
        );
        self.recent.truncate(20);
        self.persist_recent()
    }

    pub fn recent(&mut self) -> io::Result<Vec<RecentFile>> {
        self.recent.retain(|entry| {
            Path::new(&entry.path).is_file()
                && Path::new(&entry.path)
                    .extension()
                    .is_some_and(|value| crate::document_save::FORMATS.iter().any(|extension| value.eq_ignore_ascii_case(extension)))
        });
        self.persist_recent()?;
        Ok(self.recent.clone())
    }

    pub fn remove_recent(&mut self, path: &str) -> io::Result<Vec<RecentFile>> {
        self.recent.retain(|entry| key(&entry.path) != key(path));
        self.persist_recent()?;
        Ok(self.recent.clone())
    }

    pub fn clear_recent(&mut self) -> io::Result<Vec<RecentFile>> {
        self.recent.clear();
        self.persist_recent()?;
        Ok(Vec::new())
    }

    pub fn open_recent(&mut self, path: &str) -> io::Result<Value> {
        let entry = self.recent()?.into_iter()
            .find(|entry| key(&entry.path) == key(path))
            .ok_or_else(|| error("最近文件条目已失效"))?;
        self.open_for_transfer(Path::new(&entry.path))
    }

    pub fn open_for_transfer(&mut self, path: &Path) -> io::Result<Value> {
        if !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("pix")) {
            return self.open(path);
        }
        let mut header = [0u8; 8];
        use std::io::Read;
        let mut file = fs::File::open(path)?;
        if file.read(&mut header)? == 8 && &header == b"MPIXPAL\0" {
            return self.open(path);
        }
        let path = fs::canonicalize(path)?;
        let text = path.to_string_lossy().trim_start_matches("\\\\?\\").to_owned();
        Ok(json!({"type":"project","name":basename(&path),"filePath":text,"rawProject":true}))
    }

    pub fn read_project_transfer(&mut self, path: &Path, record: bool) -> io::Result<Vec<u8>> {
        let path = fs::canonicalize(path)?;
        let source = read_file(&path)?;
        let encoded;
        let source = if path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("ase") || extension.eq_ignore_ascii_case("aseprite")) {
            encoded = crate::project::encode(&crate::aseprite::decode(&source, &basename(&path))?["doc"])?;
            encoded.as_slice()
        } else { source.as_slice() };
        let bytes = crate::project::read_transfer(source)?;
        if record {
            let text = path.to_string_lossy().trim_start_matches("\\\\?\\").to_owned();
            self.selected.insert(text);
            self.add_recent(&path)?;
        }
        Ok(bytes)
    }

    pub fn open(&mut self, path: &Path) -> io::Result<Value> {
        let path = fs::canonicalize(path)?;
        if path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
        {
            let metadata: Value = serde_json::from_slice(&read_file(&path)?)?;
            return if metadata["format"] == "pixel-studio-png-sequence" {
                crate::formats::read_sequence_manifest(&path)
            } else {
                crate::formats::read_sheet_manifest(&path)
            };
        }
        let text = path
            .to_string_lossy()
            .trim_start_matches("\\\\?\\")
            .to_owned();
        let value = decode_bytes(&basename(&path), &read_file(&path)?, Some(&text))?;
        if value["type"] == "project" || value["type"] == "aseprite" {
            self.selected.insert(text);
            self.add_recent(&path)?;
        }
        Ok(value)
    }

    pub fn save_project(&mut self, window: &str, target: &Path, data: &str) -> io::Result<Value> {
        let mut document: Value = serde_json::from_str(data)?;
        if document["format"] != "pixel-studio" {
            return Err(error("不是 MinePix 项目"));
        }
        let name = target
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        document["name"] = json!(name);
        for reference in document["references"].as_array_mut().into_iter().flatten() {
            let object = reference.as_object_mut().ok_or_else(|| error("参考图片无效"))?;
            if object.get("path").and_then(Value::as_str).is_none_or(str::is_empty) { return Err(error("参考图缺少源文件路径")); }
            object.remove("data");object.remove("missing");
        }
        if let Some(layers) = document["layers"].as_array_mut() {
            for layer in layers {
                if let Some(reference) = layer.get_mut("reference").and_then(Value::as_object_mut) {
                    if reference.contains_key("data") {
                        if reference.get("path").and_then(Value::as_str).is_none_or(str::is_empty) { return Err(error("参考图缺少源文件路径")); }
                        reference.remove("data");reference.remove("missing");
                    }
                }
            }
        }
        self.save_encoded(window, target, &name, &crate::project::encode(&document)?)
    }

    pub fn save_packed(&mut self, window: &str, target: &Path, packed: &crate::project::PackedSave<'_>) -> io::Result<Value> {
        let name = target.file_stem().unwrap_or_default().to_string_lossy().into_owned();
        let extension = target.extension().unwrap_or_default().to_string_lossy().to_ascii_lowercase();
        let bytes = match extension.as_str() {
            "pix" => packed.encode_cached(&name, &mut self.reference_chunks)?,
            "ase" | "aseprite" => crate::aseprite::encode(&packed.document(&name)?)?,
            _ => return Err(error("项目保存仅支持 PIX / ASE / ASEPRITE")),
        };
        let previous = self.active.get(window).cloned();
        let result = self.save_encoded(window, target, &name, &bytes);
        // Snapshot saves may finish after this window switched to another document.
        if packed.target().is_some() {
            if let Some(path) = previous { self.active.insert(window.into(), path); }
            else { self.active.remove(window); }
        }
        result
    }

    pub fn save_image(&mut self, window: &str, target: &Path, encoded: &[u8]) -> io::Result<Value> {
        let format = crate::document_save::format(target)?;
        let bytes = crate::document_save::image_bytes(&format, encoded)?;
        let name = target.file_stem().unwrap_or_default().to_string_lossy();
        let previous = self.active.get(window).cloned();
        let result = self.save_encoded(window, target, &name, &bytes);
        if let Some(path) = previous { self.active.insert(window.into(), path); } else { self.active.remove(window); }
        let mut result = result?;
        result["singleImage"] = json!(true);result["format"] = json!(format);Ok(result)
    }

    fn save_encoded(&mut self, window: &str, target: &Path, name: &str, bytes: &[u8]) -> io::Result<Value> {
        write_atomic(target, bytes)?;
        let text = target.to_string_lossy().into_owned();
        self.active.insert(window.into(), text.clone());
        self.selected.insert(text.clone());
        self.add_recent(target)?;
        Ok(json!({"filePath": text, "name": name}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_image_save_preserves_other_active_document_and_registers_recent_path() {
        let root = tempfile::tempdir().unwrap();let mut files = Files::new(root.path().join("settings")).unwrap();
        files.active.insert("main".into(), "another.pix".into());
        let path = root.path().join("single.png");let bytes = include_bytes!("../../tests/fixtures/gif-frame.png");
        let result = files.save_image("main", &path, bytes).unwrap();assert_eq!(result["singleImage"],true);
        assert_eq!(fs::read(&path).unwrap(),bytes);assert_eq!(files.active["main"],"another.pix");assert_eq!(files.recent().unwrap().len(),1);
        let failed = root.path().join("invalid.gif");assert!(files.save_image("main",&failed,b"not png").is_err());assert!(!failed.exists());assert_eq!(files.active["main"],"another.pix");
    }

    #[test]
    fn packed_save_uses_real_ase_encoding_and_reopens_with_path() {
        let root = tempfile::tempdir().unwrap();let mut files = Files::new(root.path().join("settings")).unwrap();
        let imported = crate::aseprite::decode(include_bytes!("../../tests/fixtures/rgba-linked.aseprite"), "sprite").unwrap();
        let metadata = serde_json::to_vec(&json!({"document":imported["doc"],"blocks":[],"name":"sprite","saveAs":true,"target":{"filePath":null,"defaultFormat":"ase"}})).unwrap();
        let mut wire = b"MPXSAVE1".to_vec();wire.extend_from_slice(&(metadata.len() as u32).to_le_bytes());wire.extend_from_slice(&metadata);
        let packed = crate::project::PackedSave::parse(&wire).unwrap();assert_eq!(packed.default_format(), "ase");
        for extension in ["ase", "aseprite"] {
            let target = root.path().join(format!("sprite.{extension}"));files.save_packed("main", &target, &packed).unwrap();
            let bytes = fs::read(&target).unwrap();assert_eq!(&bytes[4..6], &[0xe0, 0xa5]);
            let opened = files.open(&target).unwrap();assert_eq!(opened["type"], "aseprite");assert!(opened["filePath"].as_str().unwrap().ends_with(extension));
            assert_eq!(opened["doc"]["frames"].as_array().unwrap().len(), 2);
            let count = files.recent().unwrap().len();assert_eq!(&files.read_project_transfer(&target, false).unwrap()[..8], b"MPXREAD1");assert_eq!(files.recent().unwrap().len(), count);
        }
        assert_eq!(files.recent().unwrap().len(), 2);
    }

    #[test]
    fn external_reference_save_stores_paths_without_image_data() {
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let target = root.path().join("external.pix");
        let document = json!({"format":"pixel-studio","frames":[],"references":[{"path":"C:/reference.png","data":"AQIDBA==","x":8,"missing":"stale"}],"layers":[{"reference":{"path":"D:/layer.png","data":"AQIDBA=="}}]});
        files.save_project("main", &target, &document.to_string()).unwrap();
        let decoded = crate::project::decode(&fs::read(&target).unwrap()).unwrap();
        assert_eq!(decoded["references"][0]["path"], "C:/reference.png");
        assert!(decoded["references"][0].get("data").is_none());
        assert!(decoded["references"][0].get("missing").is_none());
        assert!(decoded["layers"][0]["reference"].get("data").is_none());
    }

    #[test]
    fn external_reference_read_retains_real_path_and_missing_file_errors() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("reference.png");
        fs::write(&path, b"image-file-bytes").unwrap();
        let image = read_reference(&path).unwrap();
        assert_eq!(image["sourcePath"], path.to_string_lossy().as_ref());
        assert_eq!(image["data"], STANDARD.encode(b"image-file-bytes"));
        fs::remove_file(&path).unwrap();assert!(read_reference(&path).is_err());
    }


    #[test]
    fn recent_paths_do_not_shift_after_removal_or_reordering() {
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let sample = include_str!("../../tests/fixtures/documents/mushroom.json");
        let a = root.path().join("a.pix");
        let b = root.path().join("b.pix");
        files.save_project("main", &b, sample).unwrap();
        files.save_project("main", &a, sample).unwrap();
        let entries = files.recent().unwrap();
        let path_a = entries[0].path.clone();
        let path_b = entries[1].path.clone();
        // Another window opening B changes the order after the UI took its snapshot.
        files.add_recent(&b).unwrap();
        assert_eq!(files.open_recent(&path_a).unwrap()["name"], "a.pix");
        fs::remove_file(&a).unwrap();
        assert!(files.open_recent(&path_a).is_err());
        assert_eq!(files.open_recent(&path_b).unwrap()["name"], "b.pix");
        assert_eq!(files.recent().unwrap().len(), 1);
        files.clear_recent().unwrap();
        assert!(files.open_recent(&path_b).is_err());
    }

    #[test]
    fn palette_pix_opens_without_project_transfer_or_recent_entry() {
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let path = root.path().join("palette.pix");
        let bytes = b"MPIXPAL\0\x01\0\x01\0\x12\x34\x56\x78";
        fs::write(&path, bytes).unwrap();
        let opened = files.open_for_transfer(&path).unwrap();
        assert_eq!(opened["type"], "palette");
        assert_eq!(opened["data"], STANDARD.encode(bytes));
        assert!(opened["filePath"].is_null());
        assert!(files.recent().unwrap().is_empty());
        assert!(files.selected.is_empty());
        assert_eq!(decode_bytes("palette.pix", bytes, None).unwrap()["type"], "palette");
    }

    #[test]
    fn raw_project_read_records_only_valid_completed_reads() {
        let root=tempfile::tempdir().unwrap();
        let mut files=Files::new(root.path().join("settings")).unwrap();
        let target=root.path().join("读取 中文.pix");
        let document=json!({"format":"pixel-studio","frames":[{"cels":[[0,u32::MAX]]}]});
        fs::write(&target,crate::project::encode(&document).unwrap()).unwrap();
        let canonical = fs::canonicalize(&target).unwrap();
        let expected = canonical.to_string_lossy().trim_start_matches("\\\\?\\").to_owned();
        let descriptor=files.open_for_transfer(&target).unwrap();
        assert_eq!(descriptor["type"],"project");assert_eq!(descriptor["rawProject"],true);
        assert_eq!(descriptor["filePath"].as_str(),Some(expected.as_str()));
        assert!(files.recent().unwrap().is_empty());assert!(files.selected.is_empty());
        assert_eq!(&files.read_project_transfer(&target,false).unwrap()[..8],b"MPXREAD1");
        assert!(files.recent().unwrap().is_empty());assert!(files.selected.is_empty());
        files.read_project_transfer(&target,true).unwrap();
        let recent=serde_json::to_value(files.recent().unwrap()).unwrap();
        assert_eq!(recent.as_array().unwrap().len(),1);assert!(files.selected.contains(&expected));
        assert_eq!(recent[0]["path"].as_str(),Some(expected.as_str()));
        files.read_project_transfer(&target,false).unwrap();
        assert_eq!(serde_json::to_value(files.recent().unwrap()).unwrap(),recent);
        let bad=root.path().join("损坏.pix");fs::write(&bad,b"corrupt").unwrap();
        assert!(files.open_for_transfer(&bad).is_ok());
        assert!(files.read_project_transfer(&bad,true).is_err());
        assert_eq!(serde_json::to_value(files.recent().unwrap()).unwrap(),recent);
        let bad_canonical = fs::canonicalize(&bad).unwrap();
        let bad_expected = bad_canonical.to_string_lossy().trim_start_matches("\\\\?\\").to_owned();
        assert!(!files.selected.contains(&bad_expected));
    }

    #[test]
    fn ase_import_preserves_project_path() {
        let bytes = include_bytes!("../../tests/fixtures/rgba-linked.aseprite");
        let imported = decode_bytes("动画.ase", bytes, Some("C:/动画.ase")).unwrap();
        assert_eq!(imported["type"], "aseprite");
        assert_eq!(imported["filePath"], "C:/动画.ase");
        assert_eq!(imported["doc"]["frames"].as_array().unwrap().len(), 2);
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let path = root.path().join("动画.aseprite");
        fs::write(&path, bytes).unwrap();
        assert_eq!(files.open(&path).unwrap()["type"], "aseprite");
        assert_eq!(files.recent().unwrap().len(), 1);
        assert_eq!(files.selected.len(), 1);
    }

    #[test]
    fn project_save_and_recent_roundtrip() {
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let sample = include_str!("../../tests/fixtures/documents/mushroom.json");
        let first = root.path().join("作品.pix");
        let result = files.save_project("main", &first, sample).unwrap();
        assert_eq!(result["name"], "作品");
        let opened = files.open(&first).unwrap();
        let document: Value = serde_json::from_str(opened["data"].as_str().unwrap()).unwrap();
        let original: Value = serde_json::from_str(sample).unwrap();
        assert_eq!(document["frames"], original["frames"]);
        let second = root.path().join("second.pix");
        files.save_project("main", &second, sample).unwrap();
        assert_eq!(files.recent().unwrap()[0].name, "second.pix");
        let first_path = files.recent().unwrap()[1].path.clone();
        assert_eq!(files.remove_recent(&first_path).unwrap().len(), 1);
        assert_eq!(
            Files::new(root.path().join("settings"))
                .unwrap()
                .recent()
                .unwrap()
                .len(),
            1
        );
        assert!(files.clear_recent().unwrap().is_empty());
    }

    #[test]
    fn snapshot_save_does_not_replace_another_active_document_path() {
        let metadata = serde_json::to_vec(&json!({"document":{"format":"pixel-studio","frames":[]},"blocks":[],"name":"A","saveAs":false,"target":{"filePath":"a.pix"}})).unwrap();
        let wire = [b"MPXSAVE1".as_slice(), &(metadata.len() as u32).to_le_bytes(), &metadata].concat();
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let target = root.path().join("a.pix");
        files.active.insert("main".into(), "b.pix".into());
        files.save_packed("main", &target, &crate::project::PackedSave::parse(&wire).unwrap()).unwrap();
        assert_eq!(files.active["main"], "b.pix");
        assert_eq!(crate::project::decode(&fs::read(target).unwrap()).unwrap()["name"], "a");
    }

    #[test]
    fn packed_project_save_renames_and_preserves_target_on_bad_payload() {
        let bytes = include_bytes!("../../tests/fixtures/project-transfer/fixture.bin");
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let target = root.path().join("中文 目标.pix");
        let result = files.save_packed("editor-1", &target, &crate::project::PackedSave::parse(bytes).unwrap()).unwrap();
        assert_eq!(result["name"], "中文 目标");
        assert_eq!(files.active["editor-1"], target.to_string_lossy());
        assert_eq!(files.recent().unwrap().len(), 1);
        let original = fs::read(&target).unwrap();
        let doc = crate::project::decode(&original).unwrap();
        assert_eq!(doc["name"], "中文 目标");
        assert_eq!(doc["frames"][0]["cels"][2], json!([0,u32::MAX,287454020]));
        assert!(files.save_packed("editor-1", &target, &crate::project::PackedSave::parse(&bytes[..bytes.len()-1]).unwrap()).is_err());
        assert_eq!(fs::read(&target).unwrap(), original);
        assert_eq!(files.recent().unwrap().len(), 1);
    }

    #[test]
    fn dropped_local_paths_preserve_project_identity_and_manifest_dependencies() {
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let project = root.path().join("本地 作品.pix");
        files.save_project("main", &project, include_str!("../../tests/fixtures/documents/mushroom.json")).unwrap();
        let first = files.open(&project).unwrap();
        assert_eq!(files.open(&project).unwrap()["filePath"], first["filePath"]);
        assert_eq!(files.recent().unwrap().len(), 1);
        assert!(files.selected.contains(first["filePath"].as_str().unwrap()));

        let image = include_bytes!("../../tests/fixtures/gif-frame.png");
        let (width, height) = crate::formats::png_size(image).unwrap();
        fs::write(root.path().join("同目录.png"), image).unwrap();
        let sequence = root.path().join("序列.json");
        fs::write(&sequence, serde_json::to_vec(&json!({
            "format":"pixel-studio-png-sequence","version":1,"width":width,"height":height,
            "tags":[],"frames":[{"file":"同目录.png","duration":75,"sourceIndex":2}]
        })).unwrap()).unwrap();
        let opened = files.open(&sequence).unwrap();
        assert_eq!(opened["type"], "sequence");
        assert_eq!(opened["files"][0]["data"], STANDARD.encode(image));
        assert_eq!(opened["manifest"]["frames"][0]["duration"], 75);

        let sheet = root.path().join("图集.json");
        let mut metadata = json!({
            "app":"pixel-studio","image":"同目录.png","size":{"w":width,"h":height},
            "frames":[{"frame":{"x":0,"y":0,"w":width,"h":height},"duration":75}],"tags":[]
        });
        fs::write(&sheet, serde_json::to_vec(&metadata).unwrap()).unwrap();
        let opened = files.open(&sheet).unwrap();
        assert_eq!(opened["type"], "sheet-manifest");
        assert_eq!(opened["metadata"], metadata);
        assert_eq!(opened["data"], STANDARD.encode(image));
        assert_eq!(files.recent().unwrap().len(), 1);
        metadata["image"] = json!("../outside.png");
        fs::write(&sheet, serde_json::to_vec(&metadata).unwrap()).unwrap();
        assert!(files.open(&sheet).is_err());
        fs::write(&sheet, b"{}").unwrap();
        assert!(files.open(&sheet).is_err());
        fs::write(root.path().join("old.pix"), b"{\"format\":\"pixel-studio\"}").unwrap();
        assert!(files.open(&root.path().join("old.pix")).is_err());
    }
    #[test]
    fn launch_paths_resolve_and_filter_arguments() {
        let root = tempfile::tempdir().unwrap();
        let args: Vec<String> = [
            "MinePix.exe",
            "--debug",
            "作品 动画.PIX",
            "sample.aseprite",
            "notes.txt",
            "作品 动画.PIX",
            "missing.png",
        ]
        .into_iter()
        .map(str::to_owned)
        .collect();
        assert_eq!(
            launch_paths(&args, root.path()),
            vec![
                root.path().join("作品 动画.PIX"),
                root.path().join("sample.aseprite"),
                root.path().join("missing.png")
            ]
        );
        let absolute = root.path().join("绝对.pix");
        assert_eq!(
            launch_paths(
                &[
                    "MinePix.exe".into(),
                    absolute.to_string_lossy().into_owned()
                ],
                root.path()
            ),
            vec![absolute]
        );
    }

    #[test]
    fn launch_queue_drains_once_and_routes_after_ready() {
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().into()).unwrap();
        files.startup.clear();
        let first = root.path().join("first.pix");
        let second = root.path().join("second.ase");
        assert!(files.receive_launch(vec![first.clone()]).is_empty());
        assert_eq!(files.take_startup(), vec![first]);
        assert!(files.take_startup().is_empty());
        assert_eq!(files.receive_launch(vec![second.clone()]), vec![second]);
        assert!(files.startup.is_empty());
    }
}
