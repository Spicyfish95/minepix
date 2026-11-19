#![allow(non_snake_case)]
use std::{
    cell::RefCell,
    ffi::c_void,
    mem::size_of,
    ptr,
    sync::atomic::{AtomicI32, Ordering},
};
use windows::{
    Win32::{
        Foundation::{
            CLASS_E_CLASSNOTAVAILABLE, CLASS_E_NOAGGREGATION, E_FAIL, E_INVALIDARG, E_POINTER,
            S_FALSE, S_OK,
        },
        Graphics::Gdi::{
            BI_RGB, BITMAPINFO, BITMAPINFOHEADER, CreateDIBSection, DIB_RGB_COLORS, HBITMAP,
        },
        System::Com::{
            IClassFactory, IClassFactory_Impl, IStream, STATFLAG_NONAME, STATSTG, STREAM_SEEK_SET,
        },
        UI::Shell::{
            IThumbnailProvider, IThumbnailProvider_Impl,
            PropertiesSystem::{IInitializeWithStream, IInitializeWithStream_Impl},
            WTS_ALPHATYPE, WTSAT_ARGB,
        },
    },
    core::{BOOL, Error, GUID, HRESULT, IUnknown, Interface, Ref, Result, implement},
};

pub const CLSID: GUID = GUID::from_u128(0xb7972150_427a_4999_8fb5_8b1661c2510b);
static OBJECTS: AtomicI32 = AtomicI32::new(0);
static LOCKS: AtomicI32 = AtomicI32::new(0);

#[implement(IInitializeWithStream, IThumbnailProvider)]
struct Handler {
    stream: RefCell<Option<IStream>>,
}
impl Handler {
    fn new() -> Self {
        OBJECTS.fetch_add(1, Ordering::SeqCst);
        Self {
            stream: RefCell::new(None),
        }
    }
}
impl Drop for Handler {
    fn drop(&mut self) {
        OBJECTS.fetch_sub(1, Ordering::SeqCst);
    }
}
impl IInitializeWithStream_Impl for Handler_Impl {
    fn Initialize(&self, pstream: Ref<IStream>, _mode: u32) -> Result<()> {
        let mut stream = self.stream.borrow_mut();
        if stream.is_some() {
            return Err(Error::from_hresult(E_FAIL));
        }
        *stream = Some(
            pstream
                .as_ref()
                .ok_or_else(|| Error::from_hresult(E_POINTER))?
                .clone(),
        );
        Ok(())
    }
}
impl IThumbnailProvider_Impl for Handler_Impl {
    fn GetThumbnail(&self, cx: u32, phbmp: *mut HBITMAP, alpha: *mut WTS_ALPHATYPE) -> Result<()> {
        if phbmp.is_null() || alpha.is_null() {
            return Err(Error::from_hresult(E_POINTER));
        }
        unsafe {
            *phbmp = HBITMAP::default();
            *alpha = WTS_ALPHATYPE::default();
        }
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            self.bitmap(cx, phbmp, alpha)
        }))
        .unwrap_or_else(|_| Err(Error::from_hresult(E_FAIL)))
    }
}
impl Handler_Impl {
    fn bitmap(&self, cx: u32, phbmp: *mut HBITMAP, alpha: *mut WTS_ALPHATYPE) -> Result<()> {
        if !(1..=1024).contains(&cx) {
            return Err(Error::from_hresult(E_INVALIDARG));
        }
        let stream = self.stream.borrow();
        let stream = stream.as_ref().ok_or_else(|| Error::from_hresult(E_FAIL))?;
        let mut stat = STATSTG::default();
        unsafe {
            stream.Stat(&mut stat, STATFLAG_NONAME)?;
        }
        crate::storage::check_size(stat.cbSize).map_err(|_| Error::from_hresult(E_FAIL))?;
        let mut bytes = vec![0; stat.cbSize as usize];
        unsafe {
            stream.Seek(0, STREAM_SEEK_SET, None)?;
        }
        let mut offset = 0;
        while offset < bytes.len() {
            let count = (bytes.len() - offset).min(65536) as u32;
            let mut read = 0;
            unsafe {
                stream
                    .Read(
                        bytes.as_mut_ptr().add(offset).cast(),
                        count,
                        Some(&mut read),
                    )
                    .ok()?;
            }
            if read == 0 || read > count {
                return Err(Error::from_hresult(E_FAIL));
            }
            offset += read as usize;
        }
        let image = crate::thumbnail(&bytes, cx).map_err(|_| Error::from_hresult(E_FAIL))?;
        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: image.width as i32,
                biHeight: -(image.height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut data = ptr::null_mut();
        let bitmap = unsafe { CreateDIBSection(None, &info, DIB_RGB_COLORS, &mut data, None, 0)? };
        let output = unsafe { std::slice::from_raw_parts_mut(data.cast::<u8>(), image.rgba.len()) };
        for (rgba, bgra) in image.rgba.chunks_exact(4).zip(output.chunks_exact_mut(4)) {
            let a = rgba[3] as u32;
            bgra.copy_from_slice(&[
                ((rgba[2] as u32 * a + 127) / 255) as u8,
                ((rgba[1] as u32 * a + 127) / 255) as u8,
                ((rgba[0] as u32 * a + 127) / 255) as u8,
                rgba[3],
            ]);
        }
        unsafe {
            *phbmp = bitmap;
            *alpha = WTSAT_ARGB;
        }
        Ok(())
    }
}

#[implement(IClassFactory)]
struct Factory;
impl Factory {
    fn new() -> Self {
        OBJECTS.fetch_add(1, Ordering::SeqCst);
        Self
    }
}
impl Drop for Factory {
    fn drop(&mut self) {
        OBJECTS.fetch_sub(1, Ordering::SeqCst);
    }
}
impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        outer: Ref<IUnknown>,
        riid: *const GUID,
        object: *mut *mut c_void,
    ) -> Result<()> {
        if object.is_null() || riid.is_null() {
            return Err(Error::from_hresult(E_POINTER));
        }
        unsafe {
            *object = ptr::null_mut();
        }
        if outer.as_ref().is_some() {
            return Err(Error::from_hresult(CLASS_E_NOAGGREGATION));
        }
        let handler: IUnknown = Handler::new().into();
        unsafe { handler.query(riid, object).ok() }
    }
    fn LockServer(&self, lock: BOOL) -> Result<()> {
        LOCKS.fetch_add(if lock.as_bool() { 1 } else { -1 }, Ordering::SeqCst);
        Ok(())
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "system" fn DllGetClassObject(
    clsid: *const GUID,
    riid: *const GUID,
    object: *mut *mut c_void,
) -> HRESULT {
    if object.is_null() || riid.is_null() || clsid.is_null() {
        return E_POINTER;
    }
    unsafe {
        *object = ptr::null_mut();
        if *clsid != CLSID {
            return CLASS_E_CLASSNOTAVAILABLE;
        }
    }
    let factory: IUnknown = Factory::new().into();
    unsafe { factory.query(riid, object) }
}
#[unsafe(no_mangle)]
pub extern "system" fn DllCanUnloadNow() -> HRESULT {
    if OBJECTS.load(Ordering::SeqCst) == 0 && LOCKS.load(Ordering::SeqCst) == 0 {
        S_OK
    } else {
        S_FALSE
    }
}
