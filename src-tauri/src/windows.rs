use serde_json::{Value, json};
use std::{
    collections::HashMap,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow};
use tokio::sync::oneshot;

struct Pending {
    sender: String,
    reply: oneshot::Sender<Result<Value, String>>,
}

pub struct Editor {
    pub home: Option<String>,
    pub allow_close: bool,
}

#[derive(Default)]
pub struct Windows {
    serial: AtomicU64,
    pending: Mutex<HashMap<u64, Pending>>,
    ready: Mutex<HashMap<String, oneshot::Sender<()>>>,
    pub editors: Mutex<HashMap<String, Editor>>,
}

pub fn event<R: tauri::Runtime>(
    window: &WebviewWindow<R>,
    name: &str,
    data: Value,
) -> Result<(), String> {
    window
        .emit_to(
            tauri::EventTarget::WebviewWindow {
                label: window.label().into(),
            },
            "desktop:event",
            json!({"name":name,"data":data}),
        )
        .map_err(|error| error.to_string())
}

impl Windows {
    pub async fn request(
        &self,
        window: &WebviewWindow,
        operation: &str,
        data: Value,
    ) -> Result<Value, String> {
        let id = self.serial.fetch_add(1, Ordering::Relaxed) + 1;
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().unwrap().insert(
            id,
            Pending {
                sender: window.label().into(),
                reply: sender,
            },
        );
        if let Err(error) = event(
            window,
            "editor:request",
            json!({"requestId":id,"operation":operation,"data":data}),
        ) {
            self.pending.lock().unwrap().remove(&id);
            return Err(error);
        }
        let result = tokio::time::timeout(Duration::from_secs(30), receiver).await;
        self.pending.lock().unwrap().remove(&id);
        result
            .map_err(|_| "文档窗口响应超时".to_string())?
            .map_err(|_| "文档窗口已关闭".to_string())?
    }

    pub fn reply(&self, window: &str, reply: &Value) -> Result<(), String> {
        let id = reply["requestId"].as_u64().ok_or("文档请求编号无效")?;
        let mut pending = self.pending.lock().unwrap();
        if pending.get(&id).is_none_or(|entry| entry.sender != window) {
            return Err("文档请求已结束或来源不匹配".into());
        }
        let entry = pending.remove(&id).unwrap();
        let result = if let Some(error) = reply["error"].as_str() {
            Err(error.into())
        } else {
            Ok(reply["result"].clone())
        };
        let _ = entry.reply.send(result);
        Ok(())
    }

    pub fn mark_ready(&self, label: &str) {
        if let Some(sender) = self.ready.lock().unwrap().remove(label) {
            let _ = sender.send(());
        }
    }

    pub fn destroyed(&self, label: &str) {
        self.editors.lock().unwrap().remove(label);
        self.ready.lock().unwrap().remove(label);
        self.pending
            .lock()
            .unwrap()
            .retain(|_, entry| entry.sender != label);
    }

    pub async fn create(&self, app: &AppHandle, home: &str) -> Result<WebviewWindow, String> {
        let label = format!("editor-{}", uuid::Uuid::new_v4());
        let (sender, receiver) = oneshot::channel();
        self.ready.lock().unwrap().insert(label.clone(), sender);
        self.editors.lock().unwrap().insert(
            label.clone(),
            Editor {
                home: Some(home.into()),
                allow_close: false,
            },
        );
        let window = match build_editor(app, &label) {
            Ok(window) => window,
            Err(error) => {
                self.destroyed(&label);
                return Err(error.to_string());
            }
        };
        if !matches!(
            tokio::time::timeout(Duration::from_secs(30), receiver).await,
            Ok(Ok(()))
        ) {
            self.allow_close(&label);
            let _ = window.destroy();
            return Err("新文档窗口启动超时".into());
        }
        Ok(window)
    }

    pub fn allow_close(&self, label: &str) {
        if let Some(editor) = self.editors.lock().unwrap().get_mut(label) {
            editor.allow_close = true;
        }
    }

    pub async fn remove_document(&self, window: &WebviewWindow, id: Value) -> Result<(), String> {
        let detached = self
            .editors
            .lock()
            .unwrap()
            .get(window.label())
            .is_some_and(|editor| editor.home.is_some());
        let result = self
            .request(window, "remove", json!({"id":id,"keepWindow":!detached}))
            .await?;
        if detached && result["empty"] == true {
            self.allow_close(window.label());
            window.close().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn close(&self, app: &AppHandle, label: &str) -> Result<(), String> {
        let window = app.get_webview_window(label).ok_or("窗口已关闭")?;
        let target = {
            let editors = self.editors.lock().unwrap();
            editors
                .get(label)
                .and_then(|editor| editor.home.as_ref())
                .and_then(|home| {
                    if editors.contains_key(home) {
                        Some(home.clone())
                    } else {
                        editors
                            .keys()
                            .find(|other| other.as_str() != label)
                            .cloned()
                    }
                })
        };
        if let Some(target) = target.and_then(|target| app.get_webview_window(&target)) {
            let states = self.request(&window, "take-all", json!({})).await?;
            self.request(&target, "adopt", json!({"states":states}))
                .await?;
            self.allow_close(label);
            window.close().map_err(|error| error.to_string())?;
        } else {
            event(&window, "command", json!("request-close"))?;
        }
        Ok(())
    }

    pub async fn confirm_all(&self, app: &AppHandle) -> Result<bool, String> {
        let mut labels: Vec<String> = self.editors.lock().unwrap().keys().cloned().collect();
        labels.sort_by_key(|label| (label != "main", label.clone()));
        for label in &labels {
            if let Some(window) = app.get_webview_window(label) {
                if self.request(&window, "close-check", json!({})).await? != true {
                    return Ok(false);
                }
            }
        }
        Ok(true)
    }

    pub async fn quit(&self, app: &AppHandle) -> Result<bool, String> {
        if !self.confirm_all(app).await? {
            return Ok(false);
        }
        let labels: Vec<String> = self.editors.lock().unwrap().keys().cloned().collect();
        for label in labels {
            self.allow_close(&label);
            if let Some(window) = app.get_webview_window(&label) {
                window.close().map_err(|e| e.to_string())?;
            }
        }
        Ok(true)
    }
}

pub fn build_editor(app: &AppHandle, label: &str) -> tauri::Result<WebviewWindow> {
    let handle = app.clone();
    let window = tauri::WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("MinePix")
        .inner_size(1440.0, 960.0)
        .min_inner_size(1000.0, 700.0)
        .decorations(false)
        .disable_drag_drop_handler()
        .on_new_window(move |url, features| {
            let local = url.path() == "/panel.html"
                && ((url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                    || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost"))
                    || (cfg!(debug_assertions)
                        && url.scheme() == "http"
                        && url.host_str() == Some("127.0.0.1")
                        && url.port() == Some(14200)));
            if !local {
                return tauri::webview::NewWindowResponse::Deny;
            }
            let label = format!("panel-{}", uuid::Uuid::new_v4());
            match tauri::WebviewWindowBuilder::new(
                &handle,
                &label,
                WebviewUrl::External("about:blank".parse().unwrap()),
            )
            .window_features(features)
            .decorations(false)
            .disable_drag_drop_handler()
            .min_inner_size(260.0, 200.0)
            .initialization_script(format!("window.__MINEPIX_PANEL_LABEL__ = '{}';", label))
            .on_document_title_changed(|window, title| {
                let _ = window.set_title(&title);
            })
            .build()
            .and_then(|window| {
                crate::drop_paths::register(&window)?;
                crate::window_dpi::register(&window)?;
                Ok(window)
            })
            {
                Ok(window) => tauri::webview::NewWindowResponse::Create { window },
                Err(error) => {
                    eprintln!("无法打开面板窗口：{error}");
                    tauri::webview::NewWindowResponse::Deny
                }
            }
        })
        .build()?;
    crate::drop_paths::register(&window)?;
    crate::window_dpi::register(&window)?;
    let handle = app.clone();
    let label = label.to_string();
    window.on_window_event(move |event| {
        let state = handle.state::<crate::Backend>();
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let allowed = state
                    .windows
                    .editors
                    .lock()
                    .unwrap()
                    .get(&label)
                    .is_some_and(|editor| editor.allow_close);
                if !allowed {
                    api.prevent_close();
                    let app = handle.clone();
                    let label = label.clone();
                    tauri::async_runtime::spawn(async move {
                        let state = app.state::<crate::Backend>();
                        if let Err(error) = state.windows.close(&app, &label).await {
                            if let Some(window) = app.get_webview_window(&label) {
                                let _ =
                                    crate::windows::event(&window, "editor:error", json!(error));
                            }
                        }
                    });
                }
            }
            tauri::WindowEvent::Destroyed => {
                state.windows.destroyed(&label);
                state.files.lock().unwrap().active.remove(&label);
                state.dirty.lock().unwrap().remove(&label);
            }
            _ => (),
        }
    });
    Ok(window)
}
