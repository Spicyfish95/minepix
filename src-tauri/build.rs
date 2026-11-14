fn main() {
    let windows = if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        // Embed the common-controls dependency once, including in unit tests and examples.
        // Tauri's resource manifest would duplicate this linker-generated manifest.
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'"
        );
        tauri_build::WindowsAttributes::new_without_app_manifest()
    } else {
        tauri_build::WindowsAttributes::new()
    };
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("无法生成 Tauri 构建资源");
}
