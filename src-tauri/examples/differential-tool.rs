//! Exercise the production downloader with saved release metadata. Never installs or launches payloads.
use minepix_backend::differential;
use serde_json::{Value,json};
use std::{fs,path::PathBuf};
use tauri_plugin_updater::UpdaterExt;

fn main()->Result<(),Box<dyn std::error::Error>>{
    let args:Vec<String>=std::env::args().skip(1).collect();
    if args.len()!=4 {return Err("differential-tool <manifest.json> <base.exe|-> <output.exe> <expected-current-version>".into());}
    let metadata:Value=serde_json::from_slice(&fs::read(&args[0])?)?;
    let config:Value=serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let mut context=tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().version=Some(args[3].parse()?);
    context.package_info_mut().version=args[3].parse()?;
    context.config_mut().plugins.0.insert("updater".into(),json!({"pubkey":config["plugins"]["updater"]["pubkey"],"endpoints":config["plugins"]["updater"]["endpoints"],"requireSignedVersion":true}));
    let app=tauri::test::mock_builder().plugin(tauri_plugin_updater::Builder::new().build()).build(context)?;
    let update=app.updater()?.restore_update(metadata)?.ok_or("Target is not newer than current version")?;
    if update.current_version!=args[3] {return Err("Unexpected updater current version".into());}
    let root=tempfile::tempdir()?;
    if args[1]!="-" {differential::cache_verified(root.path(),&fs::read(&args[1])?)?;}
    let (bytes,stats)=tauri::async_runtime::block_on(differential::download(&update,root.path(),|_|{}))?;
    update.verify(&bytes)?;
    fs::write(PathBuf::from(&args[2]),&bytes)?;
    println!("{}",serde_json::to_string(&json!({"ok":true,"current":update.current_version,"version":update.version,"bytes":bytes.len(),"sha256":differential::sha256(&bytes),"transfer":stats,"signatureValid":true,"versionBinding":true,"executedInstaller":false}))?);
    Ok(())
}
