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
                "pix", "json", "png", "jpg", "jpeg", "webp", "bmp", "gif", "ase", "aseprite",
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
        _ => None,
    };
    if let Some(mime) = mime {
        return Ok(
            json!({"name": name, "filePath": null, "type": if extension == "gif" { "gif" } else { "image" }, "mime": mime, "data": STANDARD.encode(bytes)}),
        );
    }
    if extension == "ase" || extension == "aseprite" {
        let mut imported = crate::aseprite::decode(bytes, name)?;
        imported["type"] = json!("aseprite");
        imported["name"] = json!(name);
        imported["filePath"] = Value::Null;
        return Ok(imported);
    }
    if extension != "pix" {
        return Err(error("不支持此文件格式"));
    }
    let document = crate::project::decode(bytes)?;
    Ok(
        json!({"name": name, "filePath": file_path, "type": "project", "data": serde_json::to_string(&document)?}),
    )
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
                    .is_some_and(|value| value.eq_ignore_ascii_case("pix"))
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

    pub fn open_for_transfer(&mut self, path: &Path) -> io::Result<Value> {
        if !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("pix")) {
            return self.open(path);
        }
        let path = fs::canonicalize(path)?;
        let text = path.to_string_lossy().trim_start_matches("\\\\?\\").to_owned();
        Ok(json!({"type":"project","name":basename(&path),"filePath":text,"rawProject":true}))
    }

    pub fn read_project_transfer(&mut self, path: &Path, record: bool) -> io::Result<Vec<u8>> {
        let path = fs::canonicalize(path)?;
        let bytes = crate::project::read_transfer(&read_file(&path)?)?;
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
        if value["type"] == "project" {
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
        self.save_encoded(window, target, &name, &crate::project::encode(&document)?)
    }

    pub fn save_packed(&mut self, window: &str, target: &Path, packed: &crate::project::PackedSave<'_>) -> io::Result<Value> {
        let name = target.file_stem().unwrap_or_default().to_string_lossy().into_owned();
        self.save_encoded(window, target, &name, &packed.encode(&name)?)
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
    fn raw_project_read_records_only_valid_completed_reads() {
        let root=tempfile::tempdir().unwrap();
        let mut files=Files::new(root.path().join("settings")).unwrap();
        let target=root.path().join("读取 中文.pix");
        let document=json!({"format":"pixel-studio","frames":[{"cels":[[0,u32::MAX]]}]});
        fs::write(&target,crate::project::encode(&document).unwrap()).unwrap();
        let descriptor=files.open_for_transfer(&target).unwrap();
        assert_eq!(descriptor["type"],"project");assert_eq!(descriptor["rawProject"],true);
        assert_eq!(descriptor["filePath"].as_str(),target.to_str());
        assert!(files.recent().unwrap().is_empty());assert!(files.selected.is_empty());
        assert_eq!(&files.read_project_transfer(&target,false).unwrap()[..8],b"MPXREAD1");
        assert!(files.recent().unwrap().is_empty());assert!(files.selected.is_empty());
        files.read_project_transfer(&target,true).unwrap();
        let recent=serde_json::to_value(files.recent().unwrap()).unwrap();
        assert_eq!(recent.as_array().unwrap().len(),1);assert!(files.selected.contains(target.to_str().unwrap()));
        files.read_project_transfer(&target,false).unwrap();
        assert_eq!(serde_json::to_value(files.recent().unwrap()).unwrap(),recent);
        let bad=root.path().join("损坏.pix");fs::write(&bad,b"corrupt").unwrap();
        assert!(files.open_for_transfer(&bad).is_ok());
        assert!(files.read_project_transfer(&bad,true).is_err());
        assert_eq!(serde_json::to_value(files.recent().unwrap()).unwrap(),recent);
        assert!(!files.selected.contains(bad.to_str().unwrap()));
    }

    #[test]
    fn ase_import_returns_document_without_project_path() {
        let bytes = include_bytes!("../../tests/fixtures/rgba-linked.aseprite");
        let imported = decode_bytes("动画.ase", bytes, Some("C:/动画.ase")).unwrap();
        assert_eq!(imported["type"], "aseprite");
        assert!(imported["filePath"].is_null());
        assert_eq!(imported["doc"]["frames"].as_array().unwrap().len(), 2);
        let root = tempfile::tempdir().unwrap();
        let mut files = Files::new(root.path().join("settings")).unwrap();
        let path = root.path().join("动画.aseprite");
        fs::write(&path, bytes).unwrap();
        assert_eq!(files.open(&path).unwrap()["type"], "aseprite");
        assert!(files.recent().unwrap().is_empty());
        assert!(files.selected.is_empty());
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
