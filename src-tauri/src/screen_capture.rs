use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow};

pub struct Image {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}
struct Session {
    image: Image,
    owner: String,
}
#[derive(Default)]
pub struct Capture(Mutex<Option<Session>>);

impl Image {
    fn crop(&self, x: u32, y: u32, width: u32, height: u32) -> Result<Image, String> {
        if width == 0
            || height == 0
            || x.checked_add(width).is_none_or(|v| v > self.width)
            || y.checked_add(height).is_none_or(|v| v > self.height)
        {
            return Err("截图选区超出屏幕".into());
        }
        let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);
        for row in y..y + height {
            let from = (row as usize * self.width as usize + x as usize) * 4;
            rgba.extend_from_slice(&self.rgba[from..from + width as usize * 4]);
        }
        Ok(Image {
            width,
            height,
            rgba,
        })
    }
    fn png(&self) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, self.width, self.height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            encoder
                .write_header()
                .map_err(|e| e.to_string())?
                .write_image_data(&self.rgba)
                .map_err(|e| e.to_string())?;
        }
        Ok(bytes)
    }
    fn file(&self) -> Result<Value, String> {
        Ok(
            json!({"type":"image","name":"截图.png","mime":"image/png","data":STANDARD.encode(self.png()?)}),
        )
    }
}

pub fn start(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle();
    let state = app.state::<Capture>();
    let mut active = state.0.lock().unwrap();
    if active.is_some() {
        return Ok(());
    }
    let (image, x, y) = native::capture()?;
    let (width, height) = (image.width, image.height);
    *active = Some(Session {
        image,
        owner: window.label().into(),
    });
    let result = tauri::WebviewWindowBuilder::new(
        app,
        "screen-capture",
        WebviewUrl::App("capture.html".into()),
    )
    .title("MinePix · 截图")
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .disable_drag_drop_handler()
    .build()
    .and_then(|overlay| {
        overlay.set_position(PhysicalPosition::new(x, y))?;
        overlay.set_size(PhysicalSize::new(width, height))?;
        overlay.show()?;
        overlay.set_focus()?;
        let handle = app.clone();
        overlay.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                handle.state::<Capture>().0.lock().unwrap().take();
            }
        });
        Ok(())
    });
    if let Err(error) = result {
        active.take();
        if let Some(overlay) = app.get_webview_window("screen-capture") {
            let _ = overlay.destroy();
        }
        return Err(error.to_string());
    }
    Ok(())
}

pub fn image(app: &AppHandle) -> Result<Value, String> {
    let state = app.state::<Capture>();
    let active = state.0.lock().unwrap();
    active.as_ref().ok_or("截图已结束")?.image.file()
}

pub fn finish(app: &AppHandle, region: Option<[u32; 4]>) -> Result<(), String> {
    let state = app.state::<Capture>();
    let mut active = state.0.lock().unwrap();
    let session = active.as_ref().ok_or("截图已结束")?;
    let owner = app.get_webview_window(&session.owner);
    if let Some([x, y, width, height]) = region {
        let image = session.image.crop(x, y, width, height)?;
        let overlay = app
            .get_webview_window("screen-capture")
            .ok_or("截图窗口已关闭")?;
        native::write_clipboard(&image, &overlay)?;
        if let Some(owner) = &owner {
            crate::windows::event(owner, "capture:complete", image.file()?)?;
        }
    }
    active.take();
    drop(active);
    if let Some(overlay) = app.get_webview_window("screen-capture") {
        overlay.destroy().map_err(|e| e.to_string())?;
    }
    if let Some(owner) = owner {
        let _ = owner.set_focus();
    }
    Ok(())
}

pub fn clipboard() -> Result<Value, String> {
    native::read_clipboard()
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::{ffi::c_void, mem::size_of, ptr::null_mut};
    type Handle = *mut c_void;
    #[repr(C)]
    #[derive(Default)]
    struct BitmapInfo {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bits: u16,
        compression: u32,
        image_size: u32,
        x: i32,
        y: i32,
        used: u32,
        important: u32,
    }
    #[repr(C)]
    #[derive(Default)]
    struct Bitmap {
        kind: i32,
        width: i32,
        height: i32,
        width_bytes: i32,
        planes: u16,
        bits: u16,
        data: Handle,
    }
    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetDC(window: Handle) -> Handle;
        fn ReleaseDC(window: Handle, dc: Handle) -> i32;
        fn GetSystemMetrics(index: i32) -> i32;
        fn OpenClipboard(window: Handle) -> i32;
        fn CloseClipboard() -> i32;
        fn EmptyClipboard() -> i32;
        fn GetClipboardData(format: u32) -> Handle;
        fn SetClipboardData(format: u32, memory: Handle) -> Handle;
        fn IsClipboardFormatAvailable(format: u32) -> i32;
        fn RegisterClipboardFormatW(name: *const u16) -> u32;
    }
    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn CreateCompatibleDC(dc: Handle) -> Handle;
        fn CreateCompatibleBitmap(dc: Handle, width: i32, height: i32) -> Handle;
        fn SelectObject(dc: Handle, object: Handle) -> Handle;
        fn BitBlt(
            dest: Handle,
            x: i32,
            y: i32,
            width: i32,
            height: i32,
            source: Handle,
            sx: i32,
            sy: i32,
            rop: u32,
        ) -> i32;
        fn GetDIBits(
            dc: Handle,
            bitmap: Handle,
            start: u32,
            lines: u32,
            data: *mut c_void,
            info: *mut BitmapInfo,
            usage: u32,
        ) -> i32;
        fn GetObjectW(object: Handle, bytes: i32, data: *mut c_void) -> i32;
        fn CreateDIBitmap(
            dc: Handle,
            header: *const BitmapInfo,
            initialize: u32,
            data: *const c_void,
            info: *const BitmapInfo,
            usage: u32,
        ) -> Handle;
        fn DeleteObject(object: Handle) -> i32;
        fn DeleteDC(dc: Handle) -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GlobalAlloc(flags: u32, size: usize) -> Handle;
        fn GlobalLock(memory: Handle) -> *mut c_void;
        fn GlobalUnlock(memory: Handle) -> i32;
        fn GlobalFree(memory: Handle) -> Handle;
        fn GlobalSize(memory: Handle) -> usize;
    }
    #[link(name = "shell32")]
    unsafe extern "system" {
        fn DragQueryFileW(drop: Handle, index: u32, path: *mut u16, length: u32) -> u32;
    }
    struct Clipboard;
    impl Clipboard {
        fn open(owner: Handle) -> Result<Self, String> {
            for _ in 0..10 {
                if unsafe { OpenClipboard(owner) } != 0 {
                    return Ok(Self);
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            Err("剪贴板正在被其他程序使用，请重试".into())
        }
    }
    impl Drop for Clipboard {
        fn drop(&mut self) {
            unsafe {
                CloseClipboard();
            }
        }
    }
    fn info(width: u32, height: u32) -> BitmapInfo {
        BitmapInfo {
            size: size_of::<BitmapInfo>() as u32,
            width: width as i32,
            height: -(height as i32),
            planes: 1,
            bits: 32,
            ..Default::default()
        }
    }
    fn bitmap_image(dc: Handle, bitmap: Handle, width: u32, height: u32) -> Result<Image, String> {
        if width == 0 || height == 0 || width as u64 * height as u64 > 134_217_728 {
            return Err("截图或剪贴板图像尺寸无效".into());
        }
        let mut rgba = vec![0; width as usize * height as usize * 4];
        if unsafe {
            GetDIBits(
                dc,
                bitmap,
                0,
                height,
                rgba.as_mut_ptr().cast(),
                &mut info(width, height),
                0,
            )
        } != height as i32
        {
            return Err("读取屏幕像素失败".into());
        }
        for pixel in rgba.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            pixel[3] = 255;
        }
        Ok(Image {
            width,
            height,
            rgba,
        })
    }
    pub fn capture() -> Result<(Image, i32, i32), String> {
        unsafe {
            let (x, y, width, height) = (
                GetSystemMetrics(76),
                GetSystemMetrics(77),
                GetSystemMetrics(78),
                GetSystemMetrics(79),
            );
            if width <= 0 || height <= 0 {
                return Err("无法读取屏幕范围".into());
            }
            let screen = GetDC(null_mut());
            if screen.is_null() {
                return Err("无法访问屏幕".into());
            }
            let dc = CreateCompatibleDC(screen);
            let bitmap = CreateCompatibleBitmap(screen, width, height);
            if dc.is_null() || bitmap.is_null() {
                if !dc.is_null() {
                    DeleteDC(dc);
                }
                if !bitmap.is_null() {
                    DeleteObject(bitmap);
                }
                ReleaseDC(null_mut(), screen);
                return Err("无法分配截图缓冲区".into());
            }
            let previous = SelectObject(dc, bitmap);
            let copied = BitBlt(dc, 0, 0, width, height, screen, x, y, 0x40CC0020);
            SelectObject(dc, previous);
            let result = if copied != 0 {
                bitmap_image(screen, bitmap, width as u32, height as u32)
            } else {
                Err("屏幕截图失败".into())
            };
            DeleteObject(bitmap);
            DeleteDC(dc);
            ReleaseDC(null_mut(), screen);
            result.map(|image| (image, x, y))
        }
    }
    pub fn write_clipboard(image: &Image, owner: &WebviewWindow) -> Result<(), String> {
        let hwnd = owner.hwnd().map_err(|e| e.to_string())?.0;
        let mut bytes = vec![0u8; 40 + image.rgba.len()];
        bytes[0..4].copy_from_slice(&40u32.to_le_bytes());
        bytes[4..8].copy_from_slice(&(image.width as i32).to_le_bytes());
        bytes[8..12].copy_from_slice(&(-(image.height as i32)).to_le_bytes());
        bytes[12..14].copy_from_slice(&1u16.to_le_bytes());
        bytes[14..16].copy_from_slice(&32u16.to_le_bytes());
        for (source, dest) in image
            .rgba
            .chunks_exact(4)
            .zip(bytes[40..].chunks_exact_mut(4))
        {
            dest.copy_from_slice(&[source[2], source[1], source[0], 255]);
        }
        unsafe {
            let mut header = info(image.width, image.height);
            let dc = GetDC(null_mut());
            let bitmap =
                CreateDIBitmap(dc, &header, 4, bytes[40..].as_ptr().cast(), &mut header, 0);
            ReleaseDC(null_mut(), dc);
            if bitmap.is_null() {
                return Err("无法生成剪贴板位图".into());
            }
            let memory = GlobalAlloc(2, bytes.len());
            if memory.is_null() {
                DeleteObject(bitmap);
                return Err("无法分配剪贴板图片".into());
            }
            let target = GlobalLock(memory);
            if target.is_null() {
                GlobalFree(memory);
                DeleteObject(bitmap);
                return Err("无法写入剪贴板图片".into());
            }
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), target.cast(), bytes.len());
            GlobalUnlock(memory);
            let clipboard = match Clipboard::open(hwnd) {
                Ok(v) => v,
                Err(e) => {
                    GlobalFree(memory);
                    DeleteObject(bitmap);
                    return Err(e);
                }
            };
            if EmptyClipboard() == 0 || SetClipboardData(8, memory).is_null() {
                GlobalFree(memory);
                DeleteObject(bitmap);
                return Err("复制截图失败".into());
            }
            if SetClipboardData(2, bitmap).is_null() {
                DeleteObject(bitmap);
                return Err("复制截图位图失败".into());
            }
            drop(clipboard);
        }
        Ok(())
    }
    pub fn read_clipboard() -> Result<Value, String> {
        let _clipboard = Clipboard::open(null_mut())?;
        unsafe {
            if IsClipboardFormatAvailable(15) != 0 {
                let drop = GetClipboardData(15);
                if drop.is_null() {
                    return Err("无法读取剪贴板文件".into());
                }
                let count = DragQueryFileW(drop, u32::MAX, null_mut(), 0);
                let mut files = Vec::new();
                for index in 0..count {
                    let length = DragQueryFileW(drop, index, null_mut(), 0);
                    let mut name = vec![0u16; length as usize + 1];
                    DragQueryFileW(drop, index, name.as_mut_ptr(), length + 1);
                    let path = std::path::PathBuf::from(String::from_utf16_lossy(
                        &name[..length as usize],
                    ));
                    if !path.extension().is_some_and(|ext| {
                        ["png", "jpg", "jpeg", "webp", "gif", "bmp"]
                            .contains(&ext.to_string_lossy().to_lowercase().as_str())
                    }) {
                        continue;
                    }
                    let bytes = crate::storage::read_file(&path).map_err(|e| e.to_string())?;
                    files.push(
                        crate::files::decode_bytes(&crate::files::basename(&path), &bytes, None)
                            .map_err(|e| e.to_string())?,
                    );
                }
                return Ok(json!(files));
            }
            let png_name: Vec<u16> = "PNG\0".encode_utf16().collect();
            let format = RegisterClipboardFormatW(png_name.as_ptr());
            if format != 0 && IsClipboardFormatAvailable(format) != 0 {
                let memory = GetClipboardData(format);
                if memory.is_null() {
                    return Err("无法读取剪贴板 PNG".into());
                }
                let length = GlobalSize(memory);
                if length == 0 || length > 512 * 1024 * 1024 {
                    return Err("剪贴板 PNG 大小无效".into());
                }
                let data = GlobalLock(memory);
                if data.is_null() {
                    return Err("无法读取剪贴板 PNG".into());
                }
                let bytes = std::slice::from_raw_parts(data.cast::<u8>(), length).to_vec();
                GlobalUnlock(memory);
                return crate::files::decode_bytes("剪贴板.png", &bytes, None)
                    .map(|file| json!([file]))
                    .map_err(|e| e.to_string());
            }
            if IsClipboardFormatAvailable(2) == 0 {
                return Ok(json!([]));
            }
            let bitmap = GetClipboardData(2);
            let mut object = Bitmap::default();
            if bitmap.is_null()
                || GetObjectW(
                    bitmap,
                    size_of::<Bitmap>() as i32,
                    (&mut object as *mut Bitmap).cast(),
                ) == 0
            {
                return Err("无法读取剪贴板图片".into());
            }
            let dc = GetDC(null_mut());
            let image = bitmap_image(
                dc,
                bitmap,
                object.width as u32,
                object.height.unsigned_abs(),
            );
            ReleaseDC(null_mut(), dc);
            Ok(json!([image?.file()?]))
        }
    }
}

#[cfg(not(windows))]
mod native {
    use super::*;
    pub fn capture() -> Result<(Image, i32, i32), String> {
        Err("截图仅支持 Windows".into())
    }
    pub fn write_clipboard(_: &Image, _: &WebviewWindow) -> Result<(), String> {
        Err("图片剪贴板仅支持 Windows".into())
    }
    pub fn read_clipboard() -> Result<Value, String> {
        Err("图片剪贴板仅支持 Windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn crop_preserves_exact_rows_and_rejects_invalid_regions() {
        let image = Image {
            width: 3,
            height: 2,
            rgba: (0..24).collect(),
        };
        let cropped = image.crop(1, 0, 2, 2).unwrap();
        assert_eq!(
            cropped.rgba,
            [4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23]
        );
        for region in [
            [0, 0, 0, 2],
            [2, 0, 2, 1],
            [0, 1, 3, 2],
            [u32::MAX, 0, 2, 1],
        ] {
            assert!(
                image
                    .crop(region[0], region[1], region[2], region[3])
                    .is_err()
            );
        }
    }
    #[test]
    fn screenshot_png_roundtrip_preserves_dimensions_and_pixels() {
        let image = Image {
            width: 2,
            height: 1,
            rgba: vec![12, 34, 56, 255, 78, 90, 123, 255],
        };
        let bytes = image.png().unwrap();
        let mut reader = png::Decoder::new(std::io::Cursor::new(bytes))
            .read_info()
            .unwrap();
        let mut output = vec![0; reader.output_buffer_size()];
        let frame = reader.next_frame(&mut output).unwrap();
        assert_eq!((frame.width, frame.height), (2, 1));
        assert_eq!(output, image.rgba);
    }
}
