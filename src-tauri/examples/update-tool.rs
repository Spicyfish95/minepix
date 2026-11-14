use base64::{Engine, engine::general_purpose::STANDARD};
use minisign_verify::{PublicKey, Signature};
use serde_json::{Value, json};
use std::{fs, io};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    if arguments.len() != 2 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "update-tool <installer.exe> <version>",
        )
        .into());
    }
    let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let key = STANDARD.decode(config["plugins"]["updater"]["pubkey"].as_str().unwrap())?;
    let key = PublicKey::decode(std::str::from_utf8(&key)?)?;
    let signature = STANDARD.decode(fs::read_to_string(format!("{}.sig", arguments[0]))?.trim())?;
    let signature = Signature::decode(std::str::from_utf8(&signature)?)?;
    let mut bytes = fs::read(&arguments[0])?;
    key.verify(&bytes, &signature, false)?;
    if !signature
        .trusted_comment()
        .split('\t')
        .any(|field| field == format!("version:{}", arguments[1]))
    {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "签名版本与发布版本不一致").into());
    }
    bytes[0] ^= 1;
    assert!(key.verify(&bytes, &signature, false).is_err());
    println!(
        "{}",
        json!({"signatureValid":true,"versionBinding":true,"tamperRejected":true,"version":arguments[1],"bytes":bytes.len(),"executedInstaller":false})
    );
    Ok(())
}
