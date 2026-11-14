use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    io,
    path::PathBuf,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::oneshot;

pub const RELEASES: &str = "https://github.com/Spicyfish95/minepix/releases/tag/tauri-latest";
const RESTART_TAIL: &str = "--minepix-updated";

fn nsis_restart_tail(arguments: &[String]) -> Option<&'static str> {
    // NSIS GetOptions removes matching quotes around the entire /ARGS value.
    // An unquoted final switch preserves the quotes around individual paths.
    (arguments.last().map(String::as_str) != Some(RESTART_TAIL)).then_some(RESTART_TAIL)
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    auto_update: bool,
}

pub fn validation_endpoint(arguments: &[String]) -> io::Result<Option<Url>> {
    let Some(endpoint) = arguments
        .iter()
        .find_map(|arg| arg.strip_prefix("--update-validation="))
    else {
        return Ok(None);
    };
    let url = Url::parse(endpoint)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "更新验证地址无效"))?;
    if url.scheme() != "http"
        || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"))
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "更新验证仅允许本机回环 HTTP",
        ));
    }
    Ok(Some(url))
}

pub struct Updates {
    settings_path: PathBuf,
    auto_update: AtomicBool,
    snapshot: Mutex<Value>,
    available: Mutex<Option<Update>>,
    downloaded: Mutex<Option<Vec<u8>>>,
    cancel: Mutex<Option<oneshot::Sender<()>>>,
    operation: tokio::sync::Mutex<()>,
}
impl Updates {
    pub fn new(root: PathBuf, current: &str) -> io::Result<Self> {
        let settings_path = root.join("updater-settings.json");
        let settings: Settings = if settings_path.exists() {
            serde_json::from_slice(&crate::storage::read_file(&settings_path)?)?
        } else {
            Settings::default()
        };
        Ok(Self {
            settings_path,
            auto_update: AtomicBool::new(settings.auto_update),
            snapshot: Mutex::new(
                json!({"status":"idle","current":current,"releaseUrl":RELEASES,"configured":true}),
            ),
            available: Mutex::new(None),
            downloaded: Mutex::new(None),
            cancel: Mutex::new(None),
            operation: tokio::sync::Mutex::new(()),
        })
    }
    pub fn automatic(&self) -> bool {
        self.auto_update.load(Ordering::Relaxed)
    }
    pub fn set_automatic(&self, enabled: bool) -> io::Result<()> {
        crate::storage::write_json(
            &self.settings_path,
            &Settings {
                auto_update: enabled,
            },
        )?;
        self.auto_update.store(enabled, Ordering::Relaxed);
        Ok(())
    }
    pub fn state(&self) -> Value {
        self.snapshot.lock().unwrap().clone()
    }
    fn publish<R: tauri::Runtime>(&self, app: &AppHandle<R>, patch: Value) -> Value {
        let (state, completed) = {
            let mut state = self.snapshot.lock().unwrap();
            let previous = state["status"].as_str().unwrap().to_owned();
            for (key, value) in patch.as_object().unwrap() {
                state[key] = value.clone();
            }
            let completed = crate::notifications::completed(&previous, state["status"].as_str().unwrap());
            (state.clone(), completed)
        };
        if completed {
            if let Err(error) = app.emit(crate::notifications::UPDATE_READY, state.clone()) {
                eprintln!("无法发送更新下载完成通知事件：{error}");
            }
        }
        for window in app
            .webview_windows()
            .into_values()
            .filter(|window| window.label() == "main" || window.label().starts_with("editor-"))
        {
            if let Err(error) = crate::windows::event(&window, "update:state", state.clone()) {
                eprintln!("无法发送更新状态：{error}");
            }
        }
        state
    }
    fn fail<R: tauri::Runtime>(
        &self,
        app: &AppHandle<R>,
        operation: &str,
        error: impl ToString,
    ) -> Value {
        self.publish(app,json!({"status":"error","notice":null,"error":{"operation":operation,"message":error.to_string()}}))
    }
    pub async fn check<R: tauri::Runtime>(&self, app: &AppHandle<R>) -> Value {
        let Ok(_operation) = self.operation.try_lock() else {
            return self.state();
        };
        if self.state()["status"] == "downloaded" {
            return self.state();
        }
        self.publish(
            app,
            json!({"status":"checking","error":null,"notice":null,"progress":null,"transfer":null}),
        );
        let mut builder = app.updater_builder().timeout(Duration::from_secs(120));
        if let Some(tail) = nsis_restart_tail(&std::env::args().collect::<Vec<_>>()) {
            builder = builder.installer_arg(tail);
        }
        let updater = match builder.build() {
            Ok(updater) => updater,
            Err(error) => return self.fail(app, "check", error),
        };
        match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                let notes = update.body.clone().unwrap_or_default();
                *self.available.lock().unwrap() = Some(update);
                *self.downloaded.lock().unwrap() = None;
                self.publish(
                    app,
                    json!({"status":"available","version":version,"notes":notes}),
                )
            }
            Ok(None) => {
                *self.available.lock().unwrap() = None;
                *self.downloaded.lock().unwrap() = None;
                self.publish(app, json!({"status":"current","version":null,"notes":""}))
            }
            Err(error) => self.fail(app, "check", error),
        }
    }
    pub async fn download<R: tauri::Runtime>(&self, app: &AppHandle<R>) -> Value {
        let Ok(_operation) = self.operation.try_lock() else {
            return self.state();
        };
        if self.state()["status"] == "downloaded" {
            return self.state();
        }
        let Some(update) = self.available.lock().unwrap().clone() else {
            return self.fail(app, "check", "请先检查更新");
        };
        let (sender, mut receiver) = oneshot::channel();
        *self.cancel.lock().unwrap() = Some(sender);
        self.publish(app,json!({"status":"downloading","error":null,"notice":null,"transfer":null,"progress":{"percent":0,"transferred":0,"total":0,"bytesPerSecond":0}}));
        let started = Instant::now();
        let mut last_report: Option<Instant> = None;
        let mut last_mode="";
        let transfer=crate::differential::download(&update,self.settings_path.parent().unwrap(),|transfer|{
            if transfer.mode!=last_mode || last_report.is_none_or(|last|last.elapsed()>=Duration::from_millis(100)) {
                last_mode=transfer.mode;
                last_report=Some(Instant::now());
                let transferred=transfer.downloaded_bytes;let total=transfer.total_bytes;
                let percent=total.filter(|n|*n>0).map(|n|(transferred as f64*100.0/n as f64).min(100.0)).unwrap_or(0.0);
                self.publish(app,json!({"transfer":transfer,"notice":if transfer.fallback_reason.is_some(){Some("differential-fallback")}else{None},"progress":{"transferred":transferred,"total":total,"percent":percent,"bytesPerSecond":transferred as f64/started.elapsed().as_secs_f64().max(0.001)}}));
            }
        });
        tokio::pin!(transfer);
        let result = tokio::select! { biased;
            _=&mut receiver=>None,
            result=&mut transfer=>Some(result),
        };
        self.cancel.lock().unwrap().take();
        match result {
            None => self.publish(app, json!({"status":"cancelled","progress":null})),
            Some(Err(error)) => self.fail(app, "download", error),
            Some(Ok((bytes,mut transfer))) => {
                if let Err(error) = crate::differential::cache_verified(self.settings_path.parent().unwrap(),&bytes) {
                    eprintln!("无法保存已验证更新缓存：{error}");
                    transfer.cache_error=Some(error.to_string());
                }
                *self.downloaded.lock().unwrap() = Some(bytes);
                self.publish(
                    app,
                    json!({"status":"downloaded","progress":null,"error":null,"transfer":transfer}),
                )
            }
        }
    }
    pub fn cancel<R: tauri::Runtime>(&self, app: &AppHandle<R>) -> Value {
        let sender = self.cancel.lock().unwrap().take();
        if let Some(sender) = sender {
            self.publish(app, json!({"status":"cancelling"}));
            let _ = sender.send(());
        }
        self.state()
    }
    pub async fn install(&self, app: &AppHandle) -> Value {
        let Ok(_operation) = self.operation.try_lock() else {
            return self.state();
        };
        if self.downloaded.lock().unwrap().is_none() {
            return self.fail(app, "download", "更新尚未下载并验证");
        }
        self.publish(
            app,
            json!({"status":"preparing","error":null,"notice":null}),
        );
        let state = app.state::<crate::Backend>();
        match state.windows.confirm_all(app).await {
            Ok(true) => {}
            Ok(false) => {
                return self.publish(
                    app,
                    json!({"status":"downloaded","notice":"install-cancelled"}),
                );
            }
            Err(error) => return self.fail(app, "install", error),
        }
        self.publish(app, json!({"status":"installing"}));
        let update = self.available.lock().unwrap().clone().unwrap();
        // The official updater re-verifies bytes, starts NSIS and exits only after launch succeeds.
        let bytes = self.downloaded.lock().unwrap();
        match update.install(bytes.as_ref().unwrap()) {
            Ok(()) => self.state(),
            Err(error) => self.fail(app, "install", error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    #[test]
    fn nsis_restart_tail_preserves_quoted_paths_without_accumulating() {
        let arguments = vec![
            "minepix-tauri.exe".into(),
            "--update-validation=http://127.0.0.1:19412/latest.json".into(),
            r"C:\作品 文件.pix".into(),
        ];
        assert_eq!(nsis_restart_tail(&arguments), Some(RESTART_TAIL));
        let mut restarted = arguments.clone();
        restarted.push(RESTART_TAIL.into());
        assert_eq!(nsis_restart_tail(&restarted), None);
        restarted.push(r"C:\其他 文件.pix".into());
        assert_eq!(nsis_restart_tail(&restarted), Some(RESTART_TAIL));
        assert_eq!(
            crate::files::launch_paths(&[arguments[0].clone(), RESTART_TAIL.into()], std::path::Path::new(".")),
            Vec::<PathBuf>::new()
        );
    }

    fn signed_feed(mode: &str) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}/manifest", listener.local_addr().unwrap());
        let artifact = format!("http://{}/payload", listener.local_addr().unwrap());
        let mode = mode.to_owned();
        let handle = thread::spawn(move || {
            let signature = include_str!("../../tests/fixtures/updater-protocol.bin.sig").trim();
            let version = if mode == "current" {
                "0.1.0"
            } else if mode == "version-mismatch" {
                "3.0.0"
            } else {
                "2.0.0-alpha.2"
            };
            let manifest=serde_json::to_vec(&json!({"version":version,"platforms":{"windows-x86_64":{"url":artifact,"signature":signature}}})).unwrap();
            let calls = if mode == "current" {
                1
            } else if mode == "cancel" {
                3
            } else {
                2
            };
            for _ in 0..calls {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut request = Vec::new();
                loop {
                    let mut bytes = [0; 1024];
                    let n = stream.read(&mut bytes).unwrap();
                    assert!(n > 0 && request.len() + n <= 8192);
                    request.extend(&bytes[..n]);
                    if request.windows(4).any(|s| s == b"\r\n\r\n") {
                        break;
                    }
                }
                let manifest_request = request.starts_with(b"GET /manifest ");
                let mut body = if manifest_request {
                    manifest.clone()
                } else {
                    include_bytes!("../../tests/fixtures/updater-protocol.bin").to_vec()
                };
                if !manifest_request && mode == "bad-signature" {
                    body[0] ^= 1;
                }
                let code = if !manifest_request && mode == "http-error" {
                    "503 Service Unavailable"
                } else {
                    "200 OK"
                };
                let length = body.len() + usize::from(!manifest_request && mode == "truncated");
                write!(stream,"HTTP/1.1 {code}\r\nContent-Type: application/json\r\nContent-Length: {length}\r\nConnection: close\r\n\r\n").unwrap();
                if !manifest_request && mode == "cancel" {
                    for part in body.chunks(4) {
                        if stream.write_all(part).is_err() {
                            break;
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                } else {
                    stream.write_all(&body).unwrap();
                }
            }
        });
        (endpoint, handle)
    }

    fn mock_updater_app(endpoint: &str) -> tauri::App<tauri::test::MockRuntime> {
        let production: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let mut context = tauri::test::mock_context(tauri::test::noop_assets());
        context.config_mut().plugins.0.insert(
            "updater".into(),
            json!({
                "pubkey":production["plugins"]["updater"]["pubkey"],"endpoints":[endpoint],
                "requireSignedVersion":true,"dangerousInsecureTransportProtocol":true
            }),
        );
        tauri::test::mock_builder()
            .plugin(tauri_plugin_updater::Builder::new().build())
            .build(context)
            .unwrap()
    }

    #[test]
    fn state_machine_reports_errors_cancellation_and_retry() {
        use tauri::Listener;
        let (endpoint, server) = signed_feed("cancel");
        let app = mock_updater_app(&endpoint);
        let notices = std::sync::Arc::new(Mutex::new(Vec::<Value>::new()));
        let received = notices.clone();
        app.listen(crate::notifications::UPDATE_READY, move |event| {
            received.lock().unwrap().push(serde_json::from_str(event.payload()).unwrap());
        });
        let root = tempfile::tempdir().unwrap();
        let updates = Updates::new(root.path().into(), "0.1.0").unwrap();
        tauri::async_runtime::block_on(async {
            assert_eq!(updates.check(app.handle()).await["status"], "available");
            let download = updates.download(app.handle());
            let cancel = async {
                tokio::time::timeout(Duration::from_secs(2), async {
                    while updates.state()["progress"]["transferred"]
                        .as_u64()
                        .unwrap_or(0)
                        == 0
                    {
                        tokio::time::sleep(Duration::from_millis(1)).await;
                    }
                })
                .await
                .unwrap();
                assert_eq!(updates.cancel(app.handle())["status"], "cancelling");
            };
            let (result, ()) = tokio::join!(download, cancel);
            assert_eq!(result["status"], "cancelled");
            assert!(updates.downloaded.lock().unwrap().is_none());
            assert!(notices.lock().unwrap().is_empty());
            let retried = updates.download(app.handle()).await;
            assert_eq!(retried["status"], "downloaded");
            assert_eq!(
                updates.downloaded.lock().unwrap().as_ref().unwrap(),
                include_bytes!("../../tests/fixtures/updater-protocol.bin")
            );
            assert_eq!(updates.check(app.handle()).await["status"], "downloaded");
            assert_eq!(updates.download(app.handle()).await["status"], "downloaded");
            let notices = notices.lock().unwrap();
            assert_eq!(notices.len(), 1);
            assert_eq!(notices[0]["version"], "2.0.0-alpha.2");
        });
        server.join().unwrap();
        let (endpoint, server) = signed_feed("bad-signature");
        let app = mock_updater_app(&endpoint);
        let bad_notices = std::sync::Arc::new(Mutex::new(Vec::<Value>::new()));
        let received = bad_notices.clone();
        app.listen(crate::notifications::UPDATE_READY, move |event| {
            received.lock().unwrap().push(serde_json::from_str(event.payload()).unwrap());
        });
        let root = tempfile::tempdir().unwrap();
        let updates = Updates::new(root.path().into(), "0.1.0").unwrap();
        tauri::async_runtime::block_on(async {
            assert_eq!(updates.check(app.handle()).await["status"], "available");
            let state = updates.download(app.handle()).await;
            assert_eq!(state["status"], "error");
            assert_eq!(state["error"]["operation"], "download");
            assert!(updates.downloaded.lock().unwrap().is_none());
            assert!(bad_notices.lock().unwrap().is_empty());
        });
        server.join().unwrap();
    }

    #[test]
    fn differential_state_cancels_without_fallback_retries_and_caches_verified_bytes() {
        use crate::differential::{self,tests::{feed,app,base,TARGET}};
        let feed=feed("slow");let app=app(&feed.endpoint);let root=tempfile::tempdir().unwrap();
        differential::cache_verified(root.path(),&base()).unwrap();
        let updates=Updates::new(root.path().into(),"0.1.0").unwrap();
        tauri::async_runtime::block_on(async{
            assert_eq!(updates.check(app.handle()).await["status"],"available");
            let cancel=async{
                tokio::time::timeout(Duration::from_secs(3),async{
                    while updates.state()["progress"]["transferred"].as_u64().unwrap_or(0)==0 {tokio::time::sleep(Duration::from_millis(1)).await;}
                }).await.unwrap();
                updates.cancel(app.handle());
            };
            let (state,())=tokio::join!(updates.download(app.handle()),cancel);
            assert_eq!(state["status"],"cancelled");assert!(updates.downloaded.lock().unwrap().is_none());
            assert_eq!(crate::storage::read_file(&differential::cache_path(root.path())).unwrap(),base());
            assert_eq!(feed.traffic.lock().unwrap().full,0);
            let state=updates.download(app.handle()).await;
            assert_eq!(state["status"],"downloaded");assert_eq!(state["transfer"]["mode"],"differential");assert!(state["transfer"]["reusedBytes"].as_u64().unwrap()>0);
            assert_eq!(updates.downloaded.lock().unwrap().as_deref(),Some(TARGET));
            assert_eq!(crate::storage::read_file(&differential::cache_path(root.path())).unwrap(),TARGET);
        });
    }

    #[test]
    fn differential_fallback_errors_and_cache_failure_remain_visible() {
        use crate::differential::{self,tests::{feed,app,base,TARGET}};
        for mode in ["corrupt-range","bad-signature","version","cache-failure"] {
            let feed=feed(mode);let app=app(&feed.endpoint);let root=tempfile::tempdir().unwrap();
            if mode=="cache-failure" {std::fs::write(root.path().join("update-cache"),b"not a directory").unwrap();}
            else {differential::cache_verified(root.path(),&base()).unwrap();}
            let updates=Updates::new(root.path().into(),"0.1.0").unwrap();
            tauri::async_runtime::block_on(async{
                assert_eq!(updates.check(app.handle()).await["status"],"available");
                let state=updates.download(app.handle()).await;
                if ["bad-signature","version"].contains(&mode) {
                    assert_eq!(state["status"],"error","{mode}");assert!(updates.downloaded.lock().unwrap().is_none());
                    assert_eq!(crate::storage::read_file(&differential::cache_path(root.path())).unwrap(),base());
                } else {
                    assert_eq!(state["status"],"downloaded","{mode}");
                    if mode!="cache-failure" {assert_eq!(state["transfer"]["mode"],"full-fallback");assert!(state["transfer"]["fallbackReason"].is_string());}
                    assert_eq!(updates.downloaded.lock().unwrap().as_deref(),Some(TARGET));
                    if mode=="cache-failure" {assert!(state["transfer"]["cacheError"].is_string());}
                    else {assert_eq!(crate::storage::read_file(&differential::cache_path(root.path())).unwrap(),TARGET);}
                }
            });
        }
    }

    #[test]
    fn official_plugin_checks_local_feed_and_verifies_payloads() {
        for mode in [
            "current",
            "valid",
            "bad-signature",
            "version-mismatch",
            "http-error",
            "truncated",
        ] {
            let (endpoint, server) = signed_feed(mode);
            let app = mock_updater_app(&endpoint);
            tauri::async_runtime::block_on(async {
                let updater = app
                    .updater_builder()
                    .no_proxy()
                    .timeout(Duration::from_secs(3))
                    .build()
                    .unwrap();
                let update = updater.check().await.unwrap();
                if mode == "current" {
                    assert!(update.is_none());
                    return;
                }
                let update = update.unwrap();
                let mut received = 0;
                let downloaded = update
                    .download(
                        |bytes, total| {
                            received += bytes;
                            assert!(total.unwrap() > 0);
                        },
                        || {},
                    )
                    .await;
                if mode == "valid" {
                    let bytes = downloaded.unwrap();
                    assert_eq!(
                        bytes,
                        include_bytes!("../../tests/fixtures/updater-protocol.bin")
                    );
                    assert_eq!(received, bytes.len());
                    update.verify(&bytes).unwrap();
                } else {
                    let error = downloaded.unwrap_err().to_string();
                    assert!(!error.is_empty(), "{mode} must report a reason");
                }
            });
            server.join().unwrap();
        }
    }

    #[test]
    fn settings_persist_and_channels_are_independent() {
        let root = tempfile::tempdir().unwrap();
        let updater = Updates::new(root.path().into(), "2.0.0-alpha.1").unwrap();
        assert!(!updater.automatic());
        updater.set_automatic(true).unwrap();
        assert!(
            Updates::new(root.path().into(), "2.0.0-alpha.1")
                .unwrap()
                .automatic()
        );
        updater.set_automatic(false).unwrap();
        assert!(
            !Updates::new(root.path().into(), "2.0.0-alpha.1")
                .unwrap()
                .automatic()
        );
        assert!(RELEASES.ends_with("/tauri-latest"));
        assert_eq!(updater.state()["status"], "idle");
        assert!(validation_endpoint(&["app.exe".into()]).unwrap().is_none());
        assert!(
            validation_endpoint(&["--update-validation=http://127.0.0.1:19412/latest.json".into()])
                .unwrap()
                .is_some()
        );
        for url in [
            "https://github.com/",
            "http://192.168.1.1/latest.json",
            "http://user@localhost/latest.json",
            "bad",
        ] {
            assert!(validation_endpoint(&[format!("--update-validation={url}")]).is_err());
        }
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(config["plugins"]["updater"]["requireSignedVersion"], true);
        assert!(
            config["plugins"]["updater"]["endpoints"][0]
                .as_str()
                .unwrap()
                .contains("/tauri-latest/latest.json")
        );
        assert!(
            !config["plugins"]["updater"]["pubkey"]
                .as_str()
                .unwrap()
                .is_empty()
        );
        assert!(config["plugins"]["updater"]["dangerousInsecureTransportProtocol"].is_null());
    }
}
