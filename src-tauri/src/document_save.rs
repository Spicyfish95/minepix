use std::{io,path::Path};
use serde_json::json;
pub const FORMATS: &[&str] = &["pix","aseprite","ase","png","webp","jpg","jpeg","svg","ico","gif"];
pub const IMAGES: &[&str] = &["png","webp","jpg","jpeg","svg","ico","gif"];
pub fn format(path: &Path) -> io::Result<String> {
    let extension = path.extension().unwrap_or_default().to_string_lossy().to_ascii_lowercase();
    if !FORMATS.contains(&extension.as_str()) { return Err(io::Error::new(io::ErrorKind::InvalidInput,"不支持的保存格式")); }
    Ok(extension)
}
pub fn image_bytes(format: &str, bytes: &[u8]) -> io::Result<Vec<u8>> {
    if !IMAGES.contains(&format) { return Err(io::Error::new(io::ErrorKind::InvalidInput,"不是单图保存格式")); }
    if format != "gif" { return Ok(bytes.to_vec()); }
    let (width,height,rgba) = crate::formats::png_rgba(bytes)?;
    let options = serde_json::from_value(json!({"width":width,"height":height,"frames":[{"duration":100,"rgba":rgba}],"loop":false}))?;
    crate::formats::encode_gif(&options)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn supported_extensions_match_chosen_file_not_default() {
        for extension in FORMATS { assert_eq!(format(Path::new(&format!("image.{}",extension.to_uppercase()))).unwrap(),*extension); }
        assert!(format(Path::new("image.exe")).is_err());assert!(format(Path::new("no-extension")).is_err());
    }
    #[test]
    fn gif_is_encoded_as_one_frame_without_animation_loop() {
        let png = include_bytes!("../../tests/fixtures/gif-frame.png");
        let expected = crate::formats::png_rgba(png).unwrap();let bytes = image_bytes("gif",png).unwrap();
        assert_eq!(&bytes[..3],b"GIF");assert!(!bytes.windows(11).any(|part| part==b"NETSCAPE2.0"));
        let mut options = gif::DecodeOptions::new();options.set_color_output(gif::ColorOutput::RGBA);
        let mut reader = options.read_info(std::io::Cursor::new(bytes)).unwrap();assert_eq!(reader.width() as u32,expected.0);assert_eq!(reader.height() as u32,expected.1);
        assert!(reader.read_next_frame().unwrap().is_some());assert!(reader.read_next_frame().unwrap().is_none());
    }
    #[test]
    fn non_gif_image_bytes_are_preserved() {
        for extension in IMAGES.iter().filter(|extension| **extension!="gif") { assert_eq!(image_bytes(extension,b"encoded image").unwrap(),b"encoded image"); }
        assert!(image_bytes("pix",b"image").is_err());
    }
}
