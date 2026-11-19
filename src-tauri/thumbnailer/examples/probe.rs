use std::{
    env,
    ffi::c_void,
    fs,
    mem::{size_of, transmute},
    ptr,
};
use windows::{
    Win32::{
        Foundation::{FreeLibrary, S_FALSE, S_OK, SIZE},
        Graphics::Gdi::{
            BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, CreateCompatibleDC, DIB_RGB_COLORS,
            DeleteDC, DeleteObject, GetDIBits, GetObjectW, HBITMAP,
        },
        System::{
            Com::{
                COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize, IClassFactory, STGM_READ,
                STGM_SHARE_DENY_WRITE,
            },
            LibraryLoader::{
                GetProcAddress, LOAD_LIBRARY_SEARCH_DEFAULT_DIRS, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR,
                LoadLibraryExW,
            },
        },
        UI::Shell::{
            IShellItemImageFactory, IThumbnailProvider, PropertiesSystem::IInitializeWithStream,
            SHCreateItemFromParsingName, SHCreateStreamOnFileEx, SIIGBF_SCALEUP,
            SIIGBF_THUMBNAILONLY, WTS_ALPHATYPE, WTSAT_ARGB,
        },
    },
    core::{GUID, HRESULT, HSTRING, Interface, s},
};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.len() != 5 {
        return Err("probe <dll|shell> <input> <size> <raw BGRA output> <repeat>".into());
    }
    let input = HSTRING::from(
        fs::canonicalize(&args[1])?
            .to_string_lossy()
            .trim_start_matches("\\\\?\\"),
    );
    let size: u32 = args[2].parse()?;
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;
    }
    let bitmap = if args[0] == "shell" {
        let factory: IShellItemImageFactory = unsafe { SHCreateItemFromParsingName(&input, None)? };
        unsafe {
            factory.GetImage(
                SIZE {
                    cx: size as i32,
                    cy: size as i32,
                },
                SIIGBF_THUMBNAILONLY | SIIGBF_SCALEUP,
            )?
        }
    } else {
        let dll = HSTRING::from(fs::canonicalize(&args[0])?.to_string_lossy().as_ref());
        let module = unsafe {
            LoadLibraryExW(
                &dll,
                None,
                LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS,
            )?
        };
        type GetClass =
            unsafe extern "system" fn(*const GUID, *const GUID, *mut *mut c_void) -> HRESULT;
        type CanUnload = unsafe extern "system" fn() -> HRESULT;
        let get: GetClass = unsafe {
            transmute(
                GetProcAddress(module, s!("DllGetClassObject")).ok_or("Missing class factory")?,
            )
        };
        let unload: CanUnload = unsafe {
            transmute(GetProcAddress(module, s!("DllCanUnloadNow")).ok_or("Missing unload export")?)
        };
        assert_eq!(unsafe { unload() }, S_OK);
        let mut raw = ptr::null_mut();
        unsafe {
            get(
                &GUID::from_u128(0xb7972150_427a_4999_8fb5_8b1661c2510b),
                &IClassFactory::IID,
                &mut raw,
            )
            .ok()?;
        }
        let factory = unsafe { IClassFactory::from_raw(raw) };
        assert_eq!(unsafe { unload() }, S_FALSE);
        let provider: IThumbnailProvider = unsafe { factory.CreateInstance(None)? };
        let init: IInitializeWithStream = provider.cast()?;
        let stream = unsafe {
            SHCreateStreamOnFileEx(
                &input,
                (STGM_READ | STGM_SHARE_DENY_WRITE).0,
                0,
                false,
                None,
            )?
        };
        unsafe {
            init.Initialize(&stream, STGM_READ.0)?;
        }
        let mut bitmap = HBITMAP::default();
        let mut alpha = WTS_ALPHATYPE::default();
        for _ in 0..args[4].parse::<u32>()? {
            if !bitmap.is_invalid() {
                unsafe {
                    DeleteObject(bitmap.into()).ok()?;
                }
            }
            unsafe {
                provider.GetThumbnail(size, &mut bitmap, &mut alpha)?;
            }
            assert_eq!(alpha, WTSAT_ARGB);
        }
        drop(stream);
        drop(init);
        drop(provider);
        drop(factory);
        assert_eq!(unsafe { unload() }, S_OK);
        unsafe {
            FreeLibrary(module)?;
        }
        bitmap
    };
    let mut object = BITMAP::default();
    if unsafe {
        GetObjectW(
            bitmap.into(),
            size_of::<BITMAP>() as i32,
            Some((&mut object as *mut BITMAP).cast()),
        )
    } == 0
    {
        return Err("GetObject failed".into());
    }
    let (w, h) = (object.bmWidth, object.bmHeight.abs());
    let mut info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w,
            biHeight: -h,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let mut bytes = vec![0u8; (w * h * 4) as usize];
    unsafe {
        let dc = CreateCompatibleDC(None);
        let rows = GetDIBits(
            dc,
            bitmap,
            0,
            h as u32,
            Some(bytes.as_mut_ptr().cast()),
            &mut info,
            DIB_RGB_COLORS,
        );
        DeleteDC(dc).ok()?;
        DeleteObject(bitmap.into()).ok()?;
        if rows != h {
            return Err("GetDIBits failed".into());
        }
        CoUninitialize();
    }
    fs::write(&args[3], bytes)?;
    println!(
        "{}",
        serde_json::json!({"width":w,"height":h,"source":args[0],"repeat":args[4]})
    );
    Ok(())
}
