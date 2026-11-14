use serde_json::{Value, json};
use tauri::{AppHandle, Listener, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

pub const UPDATE_READY: &str = "minepix:update-ready";
#[derive(serde::Deserialize)]
struct Ready {
    version: String,
}

pub fn completed(previous: &str, next: &str) -> bool {
    previous == "downloading" && next == "downloaded"
}

fn update_text(version: &str, locale: &str) -> (&'static str, String) {
    if locale == "en" {
        (
            "MinePix update downloaded",
            format!("Version {version} is ready. Click to return and choose Restart and update."),
        )
    } else {
        (
            "MinePix 更新已下载",
            format!("版本 {version} 已就绪，点击返回软件并选择“重启并更新”。"),
        )
    }
}

fn update_notice(ready: &Ready, focused: bool, locale: &str) -> Option<(&'static str, String)> {
    (!focused).then(|| update_text(&ready.version, locale))
}

fn recognized_action(purpose: Option<&str>) -> Option<&str> {
    purpose.filter(|purpose| matches!(*purpose, "update" | "test"))
}

fn send<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: &str,
    purpose: &str,
) -> Result<(), String> {
    app.notification()
        .builder()
        .id(if purpose == "update" { 1 } else { 2 })
        .title(title)
        .body(body)
        .extra("minepixAction", purpose)
        .show()
        .map_err(|error| error.to_string())
}

pub fn send_test<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let locale = app.state::<crate::Backend>().locale.lock().unwrap().clone();
    let (title, body) = if locale == "en" {
        ("MinePix notification test", "Click to return to MinePix.")
    } else {
        ("MinePix 通知测试", "点击此通知返回 MinePix。")
    };
    send(app, title, body, "test")
}

fn return_to_editor<R: Runtime>(app: &AppHandle<R>, purpose: &str) -> Result<(), String> {
    let target = app.get_webview_window("main").or_else(|| {
        app.webview_windows()
            .into_values()
            .find(|window| window.label().starts_with("editor-"))
    });
    let Some(window) = target else { return Ok(()) };
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    crate::windows::event(&window, "notification:action", json!(purpose))
}

pub fn register<R: Runtime>(app: &AppHandle<R>) -> tauri_plugin_notification::Result<()> {
    let application = app.clone();
    app.listen(UPDATE_READY, move |event| {
        let focused = application
            .webview_windows()
            .into_values()
            .any(|window| window.is_focused().unwrap_or(false));
        let ready: Ready = match serde_json::from_str(event.payload()) {
            Ok(ready) => ready,
            Err(error) => {
                eprintln!("更新完成通知事件无效：{error}");
                return;
            }
        };
        let locale = application
            .state::<crate::Backend>()
            .locale
            .lock()
            .unwrap()
            .clone();
        let Some((title, body)) = update_notice(&ready, focused, &locale) else {
            return;
        };
        if let Err(error) = send(&application, title, &body, "update") {
            eprintln!("系统更新通知提交失败：{error}");
        }
    });
    let application = app.clone();
    app.notification().on_action(move |action| {
        let purpose = action
            .notification()
            .and_then(|notification| notification.extra().get("minepixAction"))
            .and_then(Value::as_str);
        let Some(purpose) = recognized_action(purpose) else {
            return;
        };
        let purpose = purpose.to_owned();
        let app = application.clone();
        if let Err(error) = application.run_on_main_thread(move || {
            if let Err(error) = return_to_editor(&app, &purpose) {
                eprintln!("无法从系统通知返回编辑器：{error}");
            }
        }) {
            eprintln!("无法处理系统通知点击：{error}");
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_verified_completion_transition_requests_notification() {
        assert!(completed("downloading", "downloaded"));
        for (previous, next) in [
            ("checking", "available"),
            ("downloading", "cancelled"),
            ("downloading", "error"),
            ("downloaded", "downloaded"),
            ("preparing", "downloaded"),
        ] {
            assert!(!completed(previous, next));
        }
    }

    #[test]
    fn messages_are_localized_and_return_actions_are_explicit() {
        let (title, body) = update_text("2.0.0-alpha.2", "zh");
        assert_eq!(title, "MinePix 更新已下载");
        assert!(body.contains("2.0.0-alpha.2") && body.contains("重启并更新"));
        let (title, body) = update_text("2.0.0-alpha.2", "en");
        assert_eq!(title, "MinePix update downloaded");
        assert!(body.contains("2.0.0-alpha.2") && body.contains("Restart and update"));
        assert_eq!(recognized_action(Some("update")), Some("update"));
        assert_eq!(recognized_action(Some("test")), Some("test"));
        assert_eq!(recognized_action(Some("install")), None);
        assert_eq!(recognized_action(None), None);
    }

    #[test]
    fn foreground_editor_or_floating_panel_suppresses_automatic_notice() {
        let ready = Ready {
            version: "2.0.0-alpha.2".into(),
        };
        assert!(update_notice(&ready, true, "zh").is_none());
        let (_, body) = update_notice(&ready, false, "en").unwrap();
        assert!(body.contains("2.0.0-alpha.2") && body.contains("Restart and update"));
    }

    #[test]
    fn return_routes_only_to_existing_document_windows() {
        use std::sync::{Arc, Mutex};
        for (labels, expected) in [
            (vec!["main", "editor-1", "panel-colors"], Some("main")),
            (vec!["editor-1", "panel-colors"], Some("editor-1")),
            (vec!["panel-colors"], None),
        ] {
            let app = tauri::test::mock_builder()
                .build(tauri::test::mock_context(tauri::test::noop_assets()))
                .unwrap();
            let received = Arc::new(Mutex::new(Vec::<(String, Value)>::new()));
            for label in labels {
                let window =
                    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::default())
                        .build()
                        .unwrap();
                let received = received.clone();
                window.listen("desktop:event", move |event| {
                    received
                        .lock()
                        .unwrap()
                        .push((label.into(), serde_json::from_str(event.payload()).unwrap()));
                });
            }
            return_to_editor(app.handle(), "test").unwrap();
            let received = received.lock().unwrap();
            if let Some(expected) = expected {
                assert_eq!(received.len(), 1);
                assert_eq!(received[0].0, expected);
                assert_eq!(
                    received[0].1,
                    json!({"name":"notification:action","data":"test"})
                );
            } else {
                assert!(received.is_empty());
            }
        }
    }
}
