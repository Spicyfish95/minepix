use serde_json::{Value, json};
use std::{io, path::Path};

pub const REPOSITORY: &str = "https://github.com/Spicyfish95/minepix";

pub fn input_audit_enabled() -> bool {
    std::env::args().any(|argument| argument == "--input-audit")
}

pub fn record(root: &Path, enabled: bool, record: &Value, displays: Value) -> io::Result<Value> {
    if !enabled {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "请通过 --input-audit 启动数位笔诊断",
        ));
    }
    let mut output = record
        .as_object()
        .cloned()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "诊断记录无效"))?;
    let samples = record["samples"]
        .as_array()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "诊断采样无效"))?;
    if samples.len() > 8192 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "诊断采样超过 8192",
        ));
    }
    let ok = record["trustedPenSamples"].as_u64().unwrap_or(0) >= 10
        && record["pressureVaries"] == true
        && record["strokes"].as_u64().unwrap_or(0) >= 1
        && record["gestureActive"] == false;
    output.insert("ok".into(), json!(ok));
    output.insert("platform".into(), json!(std::env::consts::OS));
    output.insert("displays".into(), displays);
    output.insert("recordedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
    let directory = root.join("input-device");
    std::fs::create_dir_all(&directory)?;
    let path = directory.join("report.json");
    crate::storage::write_json(&path, &output)?;
    Ok(json!({"ok":ok,"filePath":path}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repository_url_is_fixed() {
        assert_eq!(REPOSITORY, "https://github.com/Spicyfish95/minepix");
    }
    #[test]
    fn audit_requires_mode_and_persists_samples() {
        let root = tempfile::tempdir().unwrap();
        let mut record = json!({"trustedPenSamples":0,"pressureVaries":false,"strokes":0,"gestureActive":false,"samples":[]});
        assert_eq!(
            super::record(root.path(), false, &record, json!([]))
                .unwrap_err()
                .kind(),
            io::ErrorKind::PermissionDenied
        );
        assert_eq!(
            super::record(root.path(), true, &record, json!([])).unwrap()["ok"],
            false
        );
        record["trustedPenSamples"] = json!(10);
        record["pressureVaries"] = json!(true);
        record["strokes"] = json!(1);
        record["samples"] =
            json!([{"pressure":0.1,"isTrusted":true},{"pressure":0.8,"isTrusted":true}]);
        let displays = json!([{"scaleFactor":1.5,"size":{"width":1920,"height":1080}}]);
        assert_eq!(
            super::record(root.path(), true, &record, displays.clone()).unwrap()["ok"],
            true
        );
        let saved: Value = serde_json::from_slice(
            &std::fs::read(root.path().join("input-device/report.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(saved["samples"], record["samples"]);
        assert_eq!(saved["displays"], displays);
        assert!(saved["recordedAt"].is_string());
        record["gestureActive"] = json!(true);
        assert_eq!(
            super::record(root.path(), true, &record, json!([])).unwrap()["ok"],
            false
        );
        record["samples"] = json!(vec![json!({}); 8193]);
        assert!(super::record(root.path(), true, &record, json!([])).is_err());
    }
}
