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

    pub fn write(&self, record: RecoveryInput) -> io::Result<()> {
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
        write_atomic(&folder.join("current.recovery"), record.data.as_bytes())?;
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
        let data = String::from_utf8(read_file(&folder.join(if previous {
            "previous.recovery"
        } else {
            "current.recovery"
        }))?)
        .map_err(|_| invalid("恢复数据不是 UTF-8"))?;
        Ok(RecoveryDocument { metadata, data })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
