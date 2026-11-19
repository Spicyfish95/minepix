fn main() {
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        let source = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("exports.def");
        println!("cargo:rustc-cdylib-link-arg=/DEF:{}", source.display());
        println!("cargo:rerun-if-changed=exports.def");
    }
}
