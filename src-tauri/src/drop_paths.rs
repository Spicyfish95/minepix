use serde_json::{Value, json};
use tauri::WebviewWindow;
use webview2_com::{
    CoTaskMemPWSTR,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
    },
    WebMessageReceivedEventHandler,
};
use windows::core::{Interface, PWSTR};

fn local_source(source: &str) -> bool {
    let Ok(url) = tauri::Url::parse(source) else {
        return false;
    };
    matches!(url.path(), "/" | "/index.html" | "/panel.html")
        && ((url.scheme() == "tauri" && url.host_str() == Some("localhost"))
            || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost"))
            || (cfg!(debug_assertions)
                && url.scheme() == "http"
                && url.host_str() == Some("127.0.0.1")
                && url.port() == Some(14200)))
}

// Keep HTML drag/drop enabled. WebView2 exposes the actual path only for an OS-backed File.
pub fn register(window: &WebviewWindow) -> tauri::Result<()> {
    let target = window.clone();
    window.with_webview(move |webview| unsafe {
        let result = (|| -> windows::core::Result<()> {
            let core = webview.controller().CoreWebView2()?;
            let mut token = 0;
            core.add_WebMessageReceived(
                &WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else { return Ok(()) };
                    let Ok(extra) = args.cast::<ICoreWebView2WebMessageReceivedEventArgs2>() else {
                        return Ok(());
                    };
                    let objects = extra.AdditionalObjects()?;
                    let mut count = 0;
                    objects.Count(&mut count)?;
                    // Normal Tauri IPC has no additional objects. Do not copy or parse its payload.
                    if count != 1 {
                        return Ok(());
                    }
                    let mut raw = PWSTR::null();
                    args.TryGetWebMessageAsString(&mut raw)?;
                    let message: Value =
                        match serde_json::from_str(&CoTaskMemPWSTR::from(raw).to_string()) {
                            Ok(message) => message,
                            Err(_) => return Ok(()),
                        };
                    let Some(id) = message["minepixFilePath"].as_u64() else {
                        return Ok(());
                    };
                    let mut source = PWSTR::null();
                    args.Source(&mut source)?;
                    if !local_source(&CoTaskMemPWSTR::from(source).to_string()) {
                        return Ok(());
                    }
                    let path = (|| -> windows::core::Result<String> {
                        let file = objects.GetValueAtIndex(0)?.cast::<ICoreWebView2File>()?;
                        let mut raw = PWSTR::null();
                        file.Path(&mut raw)?;
                        Ok(CoTaskMemPWSTR::from(raw).to_string())
                    })();
                    let result = match path {
                        Ok(path) if !path.is_empty() => json!({"id":id,"path":path}),
                        Ok(_) => {
                            json!({"id":id,"error":"拖入文件没有本地磁盘路径，请使用本地文件"})
                        }
                        Err(error) => {
                            json!({"id":id,"error":format!("无法读取拖入文件路径：{error}")})
                        }
                    };
                    if let Err(error) = crate::windows::event(&target, "drop:path", result) {
                        eprintln!("无法返回拖入文件路径：{error}");
                    }
                    Ok(())
                })),
                &mut token,
            )
        })();
        if let Err(error) = result {
            eprintln!("无法注册WebView2文件路径接收器：{error}");
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_own_frontend_pages() {
        assert!(local_source("http://tauri.localhost/"));
        assert!(local_source("http://tauri.localhost/index.html"));
        assert!(local_source("tauri://localhost/panel.html"));
        assert_eq!(
            local_source("http://127.0.0.1:14200/index.html"),
            cfg!(debug_assertions)
        );
        for source in [
            "https://example.com/index.html",
            "http://tauri.localhost.attacker/index.html",
            "http://127.0.0.1:14201/index.html",
            "http://tauri.localhost/other.html",
            "about:blank",
        ] {
            assert!(!local_source(source), "{source}");
        }
    }
}
