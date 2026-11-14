use std::sync::{Arc, Mutex};
use tauri::{PhysicalSize, WebviewWindow};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE, WM_NCDESTROY},
    },
};

#[derive(Default)]
struct MoveState {
    active: bool,
    size: Option<PhysicalSize<u32>>,
}

struct Context {
    window: WebviewWindow,
    state: Arc<Mutex<MoveState>>,
}

fn apply_size(window: &WebviewWindow, size: PhysicalSize<u32>) {
    if matches!(window.is_maximized(), Ok(false)) && matches!(window.is_fullscreen(), Ok(false)) {
        if let Err(error) = window.set_size(size) {
            eprintln!("跨屏后无法保持窗口客户区尺寸：{error}");
        }
    }
}

unsafe extern "system" fn subclass(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    let context = unsafe { &*(data as *const Context) };
    if message == WM_ENTERSIZEMOVE {
        context.state.lock().unwrap().active = true;
    }
    let result = unsafe { DefSubclassProc(hwnd, message, wparam, lparam) };
    if message == WM_EXITSIZEMOVE {
        let size = {
            let mut state = context.state.lock().unwrap();
            state.active = false;
            state.size.take()
        };
        // Windows' modal move loop can overwrite a resize on every mouse step.
        // Apply Tao's intended client size only after that loop finishes.
        if let Some(size) = size {
            apply_size(&context.window, size);
        }
    } else if message == WM_NCDESTROY {
        unsafe {
            let _ = RemoveWindowSubclass(hwnd, Some(subclass), id);
            drop(Box::from_raw(data as *mut Context));
        }
    }
    result
}

pub fn register(window: &WebviewWindow) -> tauri::Result<()> {
    let hwnd = HWND(window.hwnd()?.0);
    let state = Arc::new(Mutex::new(MoveState::default()));
    let context = Box::into_raw(Box::new(Context {
        window: window.clone(),
        state: Arc::clone(&state),
    }));
    if !unsafe { SetWindowSubclass(hwnd, Some(subclass), 1, context as usize) }.as_bool() {
        unsafe { drop(Box::from_raw(context)) };
        return Err(std::io::Error::other("无法注册跨DPI窗口尺寸处理").into());
    }
    let target = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::ScaleFactorChanged { new_inner_size, .. } = event {
            let size = *new_inner_size;
            {
                let mut state = state.lock().unwrap();
                if state.active {
                    state.size = Some(size);
                    return;
                }
            }
            let window = target.clone();
            tauri::async_runtime::spawn(async move {
                apply_size(&window, size);
            });
        }
    });
    Ok(())
}
