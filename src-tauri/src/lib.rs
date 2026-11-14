pub mod aseprite;
mod diagnostics;
pub mod differential;
mod drop_paths;
mod files;
mod formats;
mod notifications;
pub mod project;
mod storage;
mod updater;
mod windows;
mod window_dpi;

use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::Mutex;
use storage::{RecoveryDocument, RecoveryInput, RecoveryMetadata, RecoveryStore};
use tauri::Manager;

struct Backend {
    recovery: Mutex<RecoveryStore>,
    files: Mutex<files::Files>,
    locale: Mutex<String>,
    dirty: Mutex<std::collections::HashMap<String, bool>>,
    windows: windows::Windows,
    updates: updater::Updates,
}

fn text(args: &[Value], index: usize) -> &str {
    args.get(index).and_then(Value::as_str).unwrap_or_default()
}

fn dialog(state: &Backend) -> rfd::AsyncFileDialog {
    let chinese = *state.locale.lock().unwrap() != "en";
    rfd::AsyncFileDialog::new().set_title(if chinese {
        "MinePix — 选择文件"
    } else {
        "MinePix — Choose a file"
    })
}

#[tauri::command]
async fn save_project_packed(
    request: tauri::ipc::Request<'_>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Backend>,
) -> Result<Value, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("项目保存需要原始字节".into());
    };
    let packed = project::PackedSave::parse(bytes).map_err(|error| error.to_string())?;
    let previous = state.files.lock().unwrap().active.get(window.label()).cloned();
    let target = if previous.is_none() || packed.save_as() {
        let default = previous.unwrap_or_else(|| format!("{}.pix", std::path::Path::new(packed.name())
            .file_stem().unwrap_or_default().to_string_lossy()));
        let Some(chosen) = dialog(&state).add_filter("MinePix", &["pix"])
            .set_file_name(default).save_file().await else { return Ok(Value::Null) };
        chosen.path().to_path_buf()
    } else { PathBuf::from(previous.unwrap()) };
    let result = state.files.lock().unwrap().save_packed(window.label(), &target, &packed)
        .map_err(|error| error.to_string())?;
    state.recovery.lock().unwrap().clear_saved(&target.to_string_lossy())
        .map_err(|error| error.to_string())?;
    Ok(result)
}

#[tauri::command]
async fn read_project_packed(
    file_path: String,
    record: bool,
    state: tauri::State<'_, Backend>,
) -> Result<tauri::ipc::Response, String> {
    state.files.lock().unwrap().read_project_transfer(std::path::Path::new(&file_path), record)
        .map(tauri::ipc::Response::new).map_err(|error| error.to_string())
}

#[tauri::command]
async fn desktop_call(
    method: String,
    args: Vec<Value>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Backend>,
) -> Result<Value, String> {
    let io_error = |error: std::io::Error| error.to_string();
    match method.as_str() {
        "editorInfo" => Ok(json!({"id": window.label(), "detached": window.label() != "main"})),
        "editorReady" => {
            state.windows.mark_ready(window.label());
            Ok(Value::Null)
        }
        "editorReply" => {
            state
                .windows
                .reply(window.label(), args.first().ok_or("缺少文档应答")?)?;
            Ok(Value::Null)
        }
        "closeConfirmed" => {
            state.windows.allow_close(window.label());
            window.close().map_err(|error| error.to_string())?;
            Ok(Value::Null)
        }
        "closeWindow" => {
            state
                .windows
                .close(window.app_handle(), window.label())
                .await?;
            Ok(Value::Null)
        }
        "detachDocument" => {
            let id = args.first().ok_or("缺少文档标识")?.clone();
            let document = state
                .windows
                .request(&window, "take", json!({"id":id}))
                .await?;
            let child = state
                .windows
                .create(window.app_handle(), window.label())
                .await?;
            if let Err(error) = state
                .windows
                .request(&child, "adopt", json!({"states":[document],"replace":true}))
                .await
            {
                state.windows.allow_close(child.label());
                let _ = child.close();
                return Err(error);
            }
            state.windows.remove_document(&window, id).await?;
            Ok(json!(child.label()))
        }
        "moveDocument" => {
            let options = args.first().ok_or("缺少文档移动参数")?;
            let source = window
                .app_handle()
                .get_webview_window(options["owner"].as_str().ok_or("文档来源无效")?)
                .ok_or("文档来源窗口已关闭")?;
            if source.label() == window.label() {
                return Err("来源与目标窗口相同".into());
            }
            let document = state
                .windows
                .request(&source, "take", json!({"id":options["id"]}))
                .await?;
            state.windows.request(&window,"adopt",json!({"states":[document],"beforeId":options["beforeId"],"after":options["after"]})).await?;
            state
                .windows
                .remove_document(&source, options["id"].clone())
                .await?;
            Ok(json!(true))
        }
        "appInfo" => Ok(json!({
            "version": window.app_handle().package_info().version.to_string(), "packaged": !cfg!(debug_assertions),
            "autoUpdate": state.updates.automatic(), "license": "MIT", "repository": diagnostics::REPOSITORY,
            "inputAudit": diagnostics::input_audit_enabled(),
            "backend": "tauri-rust"
        })),
        "openRepository" => {
            use tauri_plugin_opener::OpenerExt;
            window
                .app_handle()
                .opener()
                .open_url(diagnostics::REPOSITORY, None::<&str>)
                .map_err(|error| error.to_string())?;
            Ok(json!(true))
        }
        "recordInputAudit" => {
            let displays:Vec<_>=window.available_monitors().map_err(|e|e.to_string())?.iter().map(|monitor|
                json!({"name":monitor.name(),"scaleFactor":monitor.scale_factor(),"size":{"width":monitor.size().width,"height":monitor.size().height},
                    "position":{"x":monitor.position().x,"y":monitor.position().y}})).collect();
            let root = state.files.lock().unwrap().root.clone();
            diagnostics::record(
                &root,
                diagnostics::input_audit_enabled(),
                args.first().ok_or("缺少诊断记录")?,
                json!(displays),
            )
            .map_err(io_error)
        }
        "updateState" => Ok(state.updates.state()),
        "testNotification" => {
            notifications::send_test(window.app_handle())?;
            Ok(json!({"submitted":true}))
        }
        "checkUpdates" => Ok(state.updates.check(window.app_handle()).await),
        "downloadUpdate" => Ok(state.updates.download(window.app_handle()).await),
        "cancelUpdate" => Ok(state.updates.cancel(window.app_handle())),
        "installUpdate" => Ok(state.updates.install(window.app_handle()).await),
        "setAutoUpdate" => {
            state
                .updates
                .set_automatic(
                    args.first()
                        .and_then(Value::as_bool)
                        .ok_or("更新偏好无效")?,
                )
                .map_err(io_error)?;
            Ok(json!(state.updates.automatic()))
        }
        "openUpdateRelease" => {
            use tauri_plugin_opener::OpenerExt;
            window
                .app_handle()
                .opener()
                .open_url(updater::RELEASES, None::<&str>)
                .map_err(|error| error.to_string())?;
            Ok(json!(true))
        }
        "setLocale" => {
            *state.locale.lock().unwrap() = text(&args, 0).into();
            Ok(Value::Null)
        }
        "setDirty" => {
            state.dirty.lock().unwrap().insert(
                window.label().into(),
                args.first().and_then(Value::as_bool).unwrap_or(false),
            );
            Ok(Value::Null)
        }
        "activateDocument" => {
            let path = text(&args, 0);
            let mut files = state.files.lock().unwrap();
            if files.selected.contains(path) {
                files.active.insert(window.label().into(), path.into());
            } else {
                files.active.remove(window.label());
            }
            Ok(Value::Null)
        }
        "recentFiles" => {
            serde_json::to_value(state.files.lock().unwrap().recent().map_err(io_error)?)
                .map_err(|error| error.to_string())
        }
        "removeRecent" => serde_json::to_value(
            state
                .files
                .lock()
                .unwrap()
                .remove_recent(text(&args, 0))
                .map_err(io_error)?,
        )
        .map_err(|error| error.to_string()),
        "clearRecent" => serde_json::to_value(
            state
                .files
                .lock()
                .unwrap()
                .clear_recent()
                .map_err(io_error)?,
        )
        .map_err(|error| error.to_string()),
        "openRecent" => {
            let index = args
                .first()
                .and_then(Value::as_u64)
                .ok_or("最近文件条目无效")? as usize;
            let mut files = state.files.lock().unwrap();
            let entries = files.recent().map_err(io_error)?;
            let path = entries.get(index).ok_or("最近文件条目已失效")?.path.clone();
            files.open_for_transfer(std::path::Path::new(&path)).map_err(io_error)
        }
        "startupFiles" => {
            let mut files = state.files.lock().unwrap();
            let paths = files.take_startup();
            let documents: Vec<Value> = paths
                .into_iter()
                .map(|path| {
                    files.open_for_transfer(&path).unwrap_or_else(
                        |error| json!({"type":"error","message": error.to_string()}),
                    )
                })
                .collect();
            Ok(json!(documents))
        }
        "openDroppedPath" => state
            .files
            .lock()
            .unwrap()
            .open_for_transfer(std::path::Path::new(text(&args, 0)))
            .map_err(io_error),
        "open" | "openKeymap" | "openPalette" => {
            let mode = text(&args, 0);
            if method == "open" && mode == "sequence" {
                let Some(chosen) = dialog(&state)
                    .add_filter("PNG sequence", &["png"])
                    .pick_files()
                    .await
                else {
                    return Ok(Value::Null);
                };
                let paths: Vec<PathBuf> = chosen
                    .iter()
                    .map(|file| file.path().to_path_buf())
                    .collect();
                return formats::read_sequence(&paths, None, None).map_err(io_error);
            }
            let picker = match method.as_str() {
                "openKeymap" => dialog(&state).add_filter("Shortcut configuration", &["json"]),
                "openPalette" => dialog(&state).add_filter("Palette", &["json", "gpl", "palette"]),
                _ if mode == "reference" => dialog(&state)
                    .add_filter("Reference images", &["png", "jpg", "jpeg", "webp", "gif"]),
                _ if mode == "sequence-manifest" || mode == "sheet-manifest" => {
                    dialog(&state).add_filter("JSON manifest", &["json"])
                }
                _ => dialog(&state).add_filter(
                    "MinePix / Images",
                    &[
                        "pix", "json", "png", "jpg", "jpeg", "webp", "bmp", "gif", "ase",
                        "aseprite",
                    ],
                ),
            };
            let chosen = if mode == "reference" {
                picker.pick_files().await
            } else {
                picker.pick_file().await.map(|file| vec![file])
            };
            let Some(chosen) = chosen else {
                return Ok(Value::Null);
            };
            if method == "open" && mode == "sequence-manifest" {
                return formats::read_sequence_manifest(chosen[0].path()).map_err(io_error);
            }
            if method == "open" && mode == "sheet-manifest" {
                return formats::read_sheet_manifest(chosen[0].path()).map_err(io_error);
            }
            if method != "open" {
                let data = storage::read_file(chosen[0].path()).map_err(io_error)?;
                return Ok(json!(
                    String::from_utf8(data).map_err(|error| error.to_string())?
                ));
            }
            let mut files = state.files.lock().unwrap();
            let documents: Result<Vec<Value>, _> =
                chosen.iter().map(|file| files.open_for_transfer(file.path())).collect();
            let mut documents = documents.map_err(io_error)?;
            if mode == "reference" {
                for document in &mut documents {
                    document["type"] = json!("image");
                }
                Ok(json!(documents))
            } else {
                Ok(documents.remove(0))
            }
        }
        "saveProject" => {
            let data = text(&args, 0);
            let name = text(&args, 1);
            let save_as = args.get(2).and_then(Value::as_bool).unwrap_or(false);
            let previous = state
                .files
                .lock()
                .unwrap()
                .active
                .get(window.label())
                .cloned();
            let target = if previous.is_none() || save_as {
                let default = previous.unwrap_or_else(|| {
                    format!(
                        "{}.pix",
                        std::path::Path::new(name)
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                    )
                });
                let Some(chosen) = dialog(&state)
                    .add_filter("MinePix", &["pix"])
                    .set_file_name(default)
                    .save_file()
                    .await
                else {
                    return Ok(Value::Null);
                };
                chosen.path().to_path_buf()
            } else {
                PathBuf::from(previous.unwrap())
            };
            let result = state
                .files
                .lock()
                .unwrap()
                .save_project(window.label(), &target, data)
                .map_err(io_error)?;
            state
                .recovery
                .lock()
                .unwrap()
                .clear_saved(&target.to_string_lossy())
                .map_err(io_error)?;
            Ok(result)
        }
        "save" => {
            use base64::Engine;
            let kind = text(&args, 1);
            let extension = match kind {
                "project" => "pix",
                "palette" => "json",
                value => value,
            };
            let name = std::path::Path::new(text(&args, 2))
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy();
            let Some(chosen) = dialog(&state)
                .add_filter(extension, &[extension])
                .set_file_name(format!("{name}.{extension}"))
                .save_file()
                .await
            else {
                return Ok(json!(false));
            };
            let data = if kind == "project" {
                project::encode(
                    &serde_json::from_str(text(&args, 0)).map_err(|error| error.to_string())?,
                )
                .map_err(io_error)?
            } else if args.get(3).and_then(Value::as_bool).unwrap_or(false) {
                base64::engine::general_purpose::STANDARD
                    .decode(text(&args, 0))
                    .map_err(|error| error.to_string())?
            } else {
                text(&args, 0).as_bytes().to_vec()
            };
            storage::write_atomic(chosen.path(), &data).map_err(io_error)?;
            Ok(json!(true))
        }
        "exportAseprite" => {
            let document = args.first().ok_or("缺少导出文档")?;
            let bytes = aseprite::encode(document).map_err(io_error)?;
            let name = formats::safe_base(document["name"].as_str().unwrap_or("sprite"));
            let Some(chosen) = dialog(&state)
                .add_filter("Aseprite", &["aseprite"])
                .set_file_name(format!("{name}.aseprite"))
                .save_file()
                .await
            else {
                return Ok(Value::Null);
            };
            storage::write_atomic(chosen.path(), &bytes).map_err(io_error)?;
            Ok(json!({"filePath":chosen.path()}))
        }
        "exportAnimation" => {
            let value = args.first().ok_or("动画参数缺失")?;
            let options: formats::AnimationOptions =
                serde_json::from_value(value.clone()).map_err(|error| error.to_string())?;
            match value["format"].as_str() {
                Some("gif") => {
                    let Some(chosen) = dialog(&state)
                        .add_filter("GIF", &["gif"])
                        .set_file_name(format!("{}.gif", formats::safe_base(&options.name)))
                        .save_file()
                        .await
                    else {
                        return Ok(Value::Null);
                    };
                    storage::write_atomic(
                        chosen.path(),
                        &formats::encode_gif(&options).map_err(io_error)?,
                    )
                    .map_err(io_error)?;
                    Ok(json!({"filePath":chosen.path(),"count":options.frames.len()}))
                }
                Some("sequence") => {
                    let Some(chosen) = dialog(&state).pick_folder().await else {
                        return Ok(Value::Null);
                    };
                    formats::export_sequence(chosen.path(), &options).map_err(io_error)
                }
                _ => Err("未知动画格式".into()),
            }
        }
        "exportSheet" => {
            let Some(chosen) = dialog(&state).pick_folder().await else {
                return Ok(Value::Null);
            };
            formats::export_sheet(chosen.path(), args.first().ok_or("缺少图集参数")?)
                .map_err(io_error)
        }
        "exportSheetMetadata" => {
            use base64::Engine;
            let options = args.first().ok_or("缺少图集参数")?;
            let Some(image) = dialog(&state).add_filter("PNG", &["png"]).pick_file().await else {
                return Ok(Value::Null);
            };
            let expected = base64::engine::general_purpose::STANDARD
                .decode(options["png"].as_str().ok_or("缺少预期 PNG")?)
                .map_err(|error| error.to_string())?;
            let actual = storage::read_file(image.path()).map_err(io_error)?;
            if formats::png_rgba(&actual).map_err(io_error)?
                != formats::png_rgba(&expected).map_err(io_error)?
            {
                return Err("关联 PNG 的尺寸或像素与当前导出设置不一致".into());
            }
            let name = image
                .path()
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy();
            let root = image.path().parent().ok_or("图集目录无效")?;
            let Some(target) = dialog(&state)
                .add_filter("JSON", &["json"])
                .set_directory(root)
                .set_file_name(format!("{name}.json"))
                .save_file()
                .await
            else {
                return Ok(Value::Null);
            };
            if target.path().parent() != Some(root) {
                return Err("请将 JSON 保存到 PNG 同一目录".into());
            }
            let mut metadata = options["metadata"].clone();
            metadata["image"] = json!(files::basename(image.path()));
            storage::write_json(target.path(), &metadata).map_err(io_error)?;
            Ok(json!({"filePath":target.path(),"image":files::basename(image.path())}))
        }
        "quit" => Ok(json!(state.windows.quit(window.app_handle()).await?)),
        _ => Err(format!("不支持的桌面功能：{method}")),
    }
}

#[tauri::command]
fn recovery_write(record: RecoveryInput, state: tauri::State<Backend>) -> Result<(), String> {
    state
        .recovery
        .lock()
        .unwrap()
        .write(record)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn recovery_list(state: tauri::State<Backend>) -> Result<Vec<RecoveryMetadata>, String> {
    state
        .recovery
        .lock()
        .unwrap()
        .list()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn recovery_for_path(
    file_path: String,
    state: tauri::State<Backend>,
) -> Result<Option<RecoveryMetadata>, String> {
    state
        .recovery
        .lock()
        .unwrap()
        .find_by_path(&file_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn recovery_discard(file_path: String, state: tauri::State<Backend>) -> Result<(), String> {
    state
        .recovery
        .lock()
        .unwrap()
        .clear_saved(&file_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn recovery_load(
    id: String,
    previous: bool,
    state: tauri::State<Backend>,
) -> Result<RecoveryDocument, String> {
    state
        .recovery
        .lock()
        .unwrap()
        .read(&id, previous)
        .map_err(|error| error.to_string())
}

pub fn run() {
    let mut context = tauri::generate_context!();
    if let Some(endpoint) = updater::validation_endpoint(&std::env::args().collect::<Vec<_>>())
        .expect("更新验证参数无效")
    {
        let config = context.config_mut().plugins.0.get_mut("updater").unwrap();
        config["endpoints"] = json!([endpoint.as_str()]);
        config["dangerousInsecureTransportProtocol"] = json!(true);
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, arguments, cwd| {
            let paths = files::launch_paths(&arguments, std::path::Path::new(&cwd));
            let app = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let target = app.get_webview_window("main").or_else(|| {
                    app.webview_windows()
                        .into_values()
                        .find(|window| window.label().starts_with("editor-"))
                });
                let Some(target) = target else { return };
                let _ = target.show();
                let _ = target.unminimize();
                let _ = target.set_focus();
                let state = app.state::<Backend>();
                let documents = {
                    let mut files = state.files.lock().unwrap();
                    files
                        .receive_launch(paths)
                        .into_iter()
                        .map(|path| {
                            files.open_for_transfer(&path).unwrap_or_else(
                                |error| json!({"type":"error","message":error.to_string()}),
                            )
                        })
                        .collect::<Vec<_>>()
                };
                for document in documents {
                    let (name, data) = if document["type"] == "error" {
                        ("editor:error", document["message"].clone())
                    } else {
                        ("open-file-data", document)
                    };
                    if let Err(error) = windows::event(&target, name, data) {
                        eprintln!("无法交接文件：{error}");
                    }
                }
            });
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            std::fs::create_dir_all(&root)?;
            let files = files::Files::new(root.clone())?;
            let updates =
                updater::Updates::new(root.clone(), &app.package_info().version.to_string())?;
            app.manage(Backend {
                recovery: Mutex::new(RecoveryStore::new(root.join("recovery"))),
                files: Mutex::new(files),
                locale: Mutex::new("zh".into()),
                dirty: Mutex::new(std::collections::HashMap::new()),
                windows: windows::Windows::default(),
                updates,
            });
            notifications::register(app.handle())?;
            app.state::<Backend>()
                .windows
                .editors
                .lock()
                .unwrap()
                .insert(
                    "main".into(),
                    windows::Editor {
                        home: None,
                        allow_close: false,
                    },
                );
            windows::build_editor(app.handle(), "main")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_call,
            read_project_packed,
            save_project_packed,
            recovery_write,
            recovery_list,
            recovery_for_path,
            recovery_discard,
            recovery_load
        ])
        .run(context)
        .expect("无法启动 MinePix Tauri");
}
