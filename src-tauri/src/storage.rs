use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

pub fn check_size(bytes: u64) -> io::Result<()> {
    if bytes > MAX_FILE_BYTES {
        return Err(invalid("文件超过 512 MiB 限制"));
    }
    Ok(())
}

pub fn read_file(path: &Path) -> io::Result<Vec<u8>> {
    let file = fs::File::open(path)?;
    check_size(file.metadata()?.len())?;
    // Read from the same handle checked above; cap the allocation if a file grows during reading.
    let mut data = Vec::new();
    std::io::Read::take(file, MAX_FILE_BYTES + 1).read_to_end(&mut data)?;
    check_size(data.len() as u64)?;
    Ok(data)
}

use std::io::Read;

pub fn write_atomic(path: &Path, data: &[u8]) -> io::Result<()> {
    check_size(data.len() as u64)?;
    let temporary = path.with_file_name(format!(
        "{}.{}.tmp",
        path.file_name()
            .ok_or_else(|| invalid("文件路径无效"))?
            .to_string_lossy(),
        Uuid::new_v4()
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(data)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub fn write_json(path: &Path, value: &impl Serialize) -> io::Result<()> {
    write_atomic(path, &serde_json::to_vec(value)?)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryInput {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub file_path: Option<String>,
    pub dirty: bool,
    #[serde(default)]
    pub data: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryMetadata {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub dirty: bool,
    pub updated_at: String,
    #[serde(default)]
    pub previous: bool,
}

#[derive(Serialize)]
pub struct RecoveryDocument {
    #[serde(flatten)]
    pub metadata: RecoveryMetadata,
    pub data: String,
}

pub struct RecoveryStore {
    root: PathBuf,
}

fn path_key(path: &str) -> String {
    if cfg!(windows) {
        path.replace('/', "\\").to_lowercase()
    } else {
        path.to_owned()
    }
}

impl RecoveryStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn folder(&self, id: &str) -> io::Result<PathBuf> {
        if id.is_empty()
            || id.len() > 80
            || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        {
            return Err(invalid("恢复项目标识无效"));
        }
        Ok(self.root.join(id))
    }

    fn remove(&self, id: &str) -> io::Result<()> {
        match fs::remove_dir_all(self.folder(id)?) {
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            result => result,
        }
    }

    pub fn write(&self, mut record: RecoveryInput) -> io::Result<()> {
        let data=std::mem::take(&mut record.data);
        self.write_bytes(record,data.as_bytes())
    }

    pub fn write_packed(&self, record:RecoveryInput,payloads:&[&[u8]])->io::Result<()>{
        if !record.dirty||record.file_path.as_ref().is_none_or(|path|path.is_empty()){return self.remove(&record.id);}
        if payloads.len()!=1{return Err(invalid("恢复快照缺少项目数据"));}
        let packed=crate::project::PackedSave::parse(payloads[0])?;
        let bytes=packed.encode(packed.name())?;
        self.write_bytes(record,&bytes)
    }

    fn write_bytes(&self, record: RecoveryInput, data:&[u8]) -> io::Result<()> {
        let Some(file_path) = record
            .file_path
            .filter(|path| !path.is_empty() && record.dirty)
        else {
            return self.remove(&record.id);
        };
        let folder = self.folder(&record.id)?;
        fs::create_dir_all(&folder)?;
        match fs::copy(
            folder.join("current.recovery"),
            folder.join("previous.recovery"),
        ) {
            Err(error) if error.kind() == io::ErrorKind::NotFound => (),
            result => {
                result?;
            }
        };
        write_atomic(&folder.join("current.recovery"), data)?;
        write_json(
            &folder.join("metadata.json"),
            &RecoveryMetadata {
                id: record.id,
                name: record.name,
                file_path,
                dirty: true,
                updated_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
                previous: false,
            },
        )
    }

    pub fn list(&self) -> io::Result<Vec<RecoveryMetadata>> {
        fs::create_dir_all(&self.root)?;
        let mut records = Vec::new();
        for entry in fs::read_dir(&self.root)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let folder = self.folder(&entry.file_name().to_string_lossy())?;
            let bytes = match fs::read(folder.join("metadata.json")) {
                Ok(bytes) => bytes,
                Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                Err(error) => return Err(error),
            };
            let mut record: RecoveryMetadata = match serde_json::from_slice(&bytes) {
                Ok(record) => record,
                Err(_) => continue, // An interrupted metadata write is not a usable recovery.
            };
            if record.file_path.is_empty() || !record.dirty {
                self.remove(&entry.file_name().to_string_lossy())?;
                continue;
            }
            record.previous = folder.join("previous.recovery").is_file();
            records.push(record);
        }
        records.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(records)
    }

    pub fn clear_saved(&self, file_path: &str) -> io::Result<()> {
        for record in self.list()? {
            if path_key(&record.file_path) == path_key(file_path) {
                self.remove(&record.id)?;
            }
        }
        Ok(())
    }

    pub fn find_by_path(&self, file_path: &str) -> io::Result<Option<RecoveryMetadata>> {
        Ok(self
            .list()?
            .into_iter()
            .find(|record| path_key(&record.file_path) == path_key(file_path)))
    }

    pub fn read(&self, id: &str, previous: bool) -> io::Result<RecoveryDocument> {
        let folder = self.folder(id)?;
        let mut metadata: RecoveryMetadata =
            serde_json::from_slice(&read_file(&folder.join("metadata.json"))?)?;
        if metadata.file_path.is_empty() || !metadata.dirty {
            return Err(invalid("没有符合条件的恢复项目"));
        }
        metadata.previous = folder.join("previous.recovery").is_file();
        let bytes = read_file(&folder.join(if previous {
            "previous.recovery"
        } else {
            "current.recovery"
        }))?;
        let data = if bytes.starts_with(b"MINEPIX\0") { serde_json::to_string(&crate::project::decode(&bytes)?)? }
            else {String::from_utf8(bytes).map_err(|_|invalid("恢复数据不是 UTF-8"))?};
        Ok(RecoveryDocument { metadata, data })
    }

    pub fn read_packed(&self,id:&str,previous:bool)->io::Result<Vec<u8>>{
        let folder=self.folder(id)?;
        let mut metadata:RecoveryMetadata=serde_json::from_slice(&read_file(&folder.join("metadata.json"))?)?;
        if metadata.file_path.is_empty()||!metadata.dirty{return Err(invalid("没有符合条件的恢复项目"));}
        metadata.previous=previous;
        let source=read_file(&folder.join(if previous{"previous.recovery"}else{"current.recovery"}))?;
        let pixels=if source.starts_with(b"MINEPIX\0"){crate::project::read_transfer(&source)?}
            else {crate::project::document_read_transfer(&serde_json::from_slice(&source)?,serde_json::Value::Null)?};
        crate::binary_packet::encode(serde_json::to_value(metadata)?,&[&pixels])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packed_recovery_rotates_binary_and_preserves_last_valid_snapshot_on_bad_input(){
        let root=tempfile::tempdir().unwrap();let store=RecoveryStore::new(root.path().join("recovery"));
        let request=||RecoveryInput{id:"binary-1".into(),name:"恢复".into(),file_path:Some("C:/a.pix".into()),dirty:true,data:String::new()};
        let packed=|pixel:u32|{
            let metadata=serde_json::to_vec(&serde_json::json!({"document":{"format":"pixel-studio","frames":[{"cels":[null]}]},"blocks":[{"path":"/frames/0/cels/0","kind":"u32","count":1}],"name":"恢复","saveAs":false})).unwrap();
            let mut bytes=b"MPXSAVE1".to_vec();bytes.extend_from_slice(&(metadata.len() as u32).to_le_bytes());bytes.extend_from_slice(&metadata);bytes.extend_from_slice(&pixel.to_le_bytes());bytes
        };
        let first=packed(0xff0000ff);store.write_packed(request(),&[&first]).unwrap();let second=packed(0x00ff00ff);store.write_packed(request(),&[&second]).unwrap();
        let folder=root.path().join("recovery/binary-1");let current=read_file(&folder.join("current.recovery")).unwrap();assert!(current.starts_with(b"MINEPIX\0"));
        assert_eq!(crate::project::decode(&current).unwrap()["frames"][0]["cels"][0][0],0x00ff00ffu32);
        assert_eq!(crate::project::decode(&read_file(&folder.join("previous.recovery")).unwrap()).unwrap()["frames"][0]["cels"][0][0],0xff0000ffu32);
        assert!(store.write_packed(request(),&[b"bad"]).is_err());assert_eq!(read_file(&folder.join("current.recovery")).unwrap(),current);
        let wire=store.read_packed("binary-1",false).unwrap();let packet=crate::binary_packet::Packet::parse(&wire).unwrap();assert_eq!(packet.metadata["id"],"binary-1");assert!(packet.payloads[0].starts_with(b"MPXREAD1"));
        store.write(RecoveryInput{data:"{\"format\":\"pixel-studio\",\"frames\":[]}".into(),..request()}).unwrap();assert!(store.read_packed("binary-1",false).is_ok());
    }

    #[test]
    fn clean_recovery_request_accepts_missing_payload() {
        let record: RecoveryInput = serde_json::from_value(
            serde_json::json!({"id":"clean-1","filePath":"C:/art.pix","dirty":false}),
        )
        .unwrap();
        let root = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(root.path().join("recovery"));
        store.write(record).unwrap();
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn atomic_save_replaces_and_preserves_target_on_error() {
        let root = tempfile::tempdir().unwrap();
        let target = root.path().join("project.pix");
        write_atomic(&target, b"first").unwrap();
        write_atomic(&target, b"second").unwrap();
        assert_eq!(read_file(&target).unwrap(), b"second");
        let directory = root.path().join("directory.pix");
        fs::create_dir(&directory).unwrap();
        fs::write(directory.join("keep"), b"original").unwrap();
        assert!(write_atomic(&directory, b"replacement").is_err());
        assert_eq!(fs::read(directory.join("keep")).unwrap(), b"original");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 2);
    }

    #[test]
    fn file_limits_and_unicode_paths() {
        let root = tempfile::tempdir().unwrap();
        let target = root.path().join("像素作品.pix");
        write_atomic(&target, "蘑菇".as_bytes()).unwrap();
        assert_eq!(
            String::from_utf8(read_file(&target).unwrap()).unwrap(),
            "蘑菇"
        );
        assert!(check_size(MAX_FILE_BYTES).is_ok());
        assert!(check_size(MAX_FILE_BYTES + 1).is_err());
        let file = fs::File::create(root.path().join("oversize.pix")).unwrap();
        file.set_len(MAX_FILE_BYTES + 1).unwrap();
        assert!(read_file(&root.path().join("oversize.pix")).is_err());
    }

    #[test]
    fn recovery_rotates_and_discards_saved_records() {
        let root = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(root.path().join("recovery"));
        let record = |data: &str| RecoveryInput {
            id: "document-1".into(),
            name: "作品".into(),
            file_path: Some("C:\\作品.pix".into()),
            dirty: true,
            data: data.into(),
        };
        store.write(record("first")).unwrap();
        store.write(record("second")).unwrap();
        assert_eq!(store.read("document-1", false).unwrap().data, "second");
        assert_eq!(store.read("document-1", true).unwrap().data, "first");
        assert!(store.list().unwrap()[0].previous);
        assert!(store.find_by_path("C:\\作品.pix").unwrap().is_some());
        store.clear_saved("C:\\作品.pix").unwrap();
        assert!(store.list().unwrap().is_empty());
        let mut untitled = record("unsaved");
        untitled.file_path = None;
        store.write(untitled).unwrap();
        assert!(store.list().unwrap().is_empty());
        assert!(store.read("../outside", false).is_err());
    }
}
