use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct Owner(Mutex<String>);
impl Default for Owner { fn default() -> Self { Self(Mutex::new("main".into())) } }
pub fn focus(app: &AppHandle, label: &str) { *app.state::<Owner>().0.lock().unwrap() = label.into(); }

#[derive(Debug, PartialEq)]
enum Action { None, Request, Cancel }
#[derive(Default)]
struct Shortcut { down: bool, cancelled: bool }
impl Shortcut {
    fn update(&mut self, alt: bool, plain: bool, outside: bool) -> Action {
        let previous = self.down;self.down = alt;
        if !alt { self.cancelled = false;return if previous { Action::Cancel } else { Action::None }; }
        if !plain {
            let first = !self.cancelled;self.cancelled = true;
            return if first { Action::Cancel } else { Action::None };
        }
        if !previous && outside { self.cancelled = false;Action::Request } else { Action::None }
    }
}

#[cfg(windows)]
mod native {
    use std::ffi::c_void;
    #[repr(C)]
    #[derive(Default)]
    struct Point { x: i32, y: i32 }
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetAsyncKeyState(key: i32) -> i16;
        fn GetCursorPos(point: *mut Point) -> i32;
        fn WindowFromPoint(point: Point) -> *mut c_void;
        fn GetAncestor(window: *mut c_void, flags: u32) -> *mut c_void;
        fn GetWindowThreadProcessId(window: *mut c_void, process: *mut u32) -> u32;
    }
    pub fn alt_down() -> bool { unsafe { GetAsyncKeyState(18) < 0 } }
    pub fn plain_alt() -> bool { unsafe { !(8..=254).filter(|key| ![18,164,165].contains(key)).any(|key| GetAsyncKeyState(key) < 0) } }
    pub fn outside() -> bool {
        let mut point = Point::default();let mut process = 0;
        unsafe {
            if GetCursorPos(&mut point) == 0 { return false; }
            let window = GetAncestor(WindowFromPoint(point), 2);
            GetWindowThreadProcessId(window, &mut process);
        }
        process != std::process::id()
    }
}

pub fn alt_down() -> bool {
    #[cfg(windows)] { native::alt_down() }
    #[cfg(not(windows))] { false }
}
pub fn start(app: &AppHandle) {
    #[cfg(windows)] {
        let app = app.clone();
        std::thread::spawn(move || {
            let mut shortcut = Shortcut::default();
            loop {
                std::thread::sleep(std::time::Duration::from_millis(20));
                let alt = native::alt_down();let plain = alt && native::plain_alt();
                let action = shortcut.update(alt, plain, alt && plain && native::outside());
                if action == Action::None { continue; }
                let label = app.state::<Owner>().0.lock().unwrap().clone();
                let Some(window) = app.get_webview_window(&label) else { continue; };
                match action {
                    Action::Request => { let _ = crate::windows::event(&window, "capture:request-color", serde_json::Value::Null); }
                    Action::Cancel => { let _ = crate::screen_capture::cancel_color(&window); }
                    Action::None => (),
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn outside_press_requests_once_and_release_cancels() {
        let mut shortcut = Shortcut::default();
        assert_eq!(shortcut.update(false,false,true),Action::None);
        assert_eq!(shortcut.update(true,true,true),Action::Request);
        assert_eq!(shortcut.update(true,true,true),Action::None);
        assert_eq!(shortcut.update(false,false,true),Action::Cancel);
        assert_eq!(shortcut.update(true,true,true),Action::Request);
    }
    #[test]
    fn inside_press_is_left_to_editor_and_combinations_do_not_retrigger() {
        let mut shortcut = Shortcut::default();
        assert_eq!(shortcut.update(true,true,false),Action::None);
        assert_eq!(shortcut.update(true,true,true),Action::None);
        assert_eq!(shortcut.update(true,false,true),Action::Cancel);
        assert_eq!(shortcut.update(true,false,true),Action::None);
        assert_eq!(shortcut.update(true,true,true),Action::None);
        assert_eq!(shortcut.update(false,false,true),Action::Cancel);
    }
}
