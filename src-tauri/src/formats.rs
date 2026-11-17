use crate::storage::{check_size, read_file, write_atomic};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    fs,
    io::{self, Cursor},
    path::{Path, PathBuf},
};

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

pub fn safe_base(name: &str) -> String {
    let name: String = name
        .chars()
        .take(100)
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                '_'
            } else {
                c
            }
        })
        .collect();
    let name = name.trim_end_matches(['.', ' ']);
    if name.is_empty() {
        "animation".into()
    } else {
        name.into()
    }
}

fn sibling(root: &Path, name: &str) -> io::Result<PathBuf> {
    if name.is_empty()
        || name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || name == "."
        || name == ".."
    {
        return Err(invalid("只允许同目录的文件名"));
    }
    let path = fs::canonicalize(root.join(name))?;
    if path.parent() != Some(fs::canonicalize(root)?.as_path()) {
        return Err(invalid("文件引用超出清单目录"));
    }
    Ok(path)
}

pub fn png_size(bytes: &[u8]) -> io::Result<(u32, u32)> {
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" || &bytes[12..16] != b"IHDR" {
        return Err(invalid("不是有效的 PNG 图像"));
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
    let height = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
    if width == 0 || height == 0 {
        return Err(invalid("PNG 尺寸无效"));
    }
    Ok((width, height))
}

pub fn png_rgba(bytes: &[u8]) -> io::Result<(u32, u32, Vec<u8>)> {
    let (width, height) = png_size(bytes)?;
    let mut decoder = png::Decoder::new(Cursor::new(bytes));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder.read_info().map_err(|e| invalid(&e.to_string()))?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut buffer)
        .map_err(|e| invalid(&e.to_string()))?;
    let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);
    let bytes = &buffer[..info.buffer_size()];
    match info.color_type {
        png::ColorType::Rgba => rgba.extend_from_slice(bytes),
        png::ColorType::Rgb => {
            for pixel in bytes.chunks_exact(3) {
                rgba.extend_from_slice(&[pixel[0], pixel[1], pixel[2], 255]);
            }
        }
        png::ColorType::Grayscale => {
            for &gray in bytes {
                rgba.extend_from_slice(&[gray, gray, gray, 255]);
            }
        }
        png::ColorType::GrayscaleAlpha => {
            for pixel in bytes.chunks_exact(2) {
                rgba.extend_from_slice(&[pixel[0], pixel[0], pixel[0], pixel[1]]);
            }
        }
        _ => return Err(invalid("PNG 解码后仍为索引像素")),
    }
    Ok((width, height, rgba))
}

fn check_animation(width: u32, height: u32, count: usize) -> io::Result<()> {
    if width == 0
        || height == 0
        || width > 4096
        || height > 4096
        || count == 0
        || count > 256
    {
        return Err(invalid("动画尺寸需为正整数、最多 256 帧、单边 4096"));
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDestination {
    pub directory: Option<PathBuf>,
    #[serde(default)]
    pub silent: bool,
    pub file_path: Option<PathBuf>,
    pub folder: Option<PathBuf>,
    pub image_path: Option<PathBuf>,
}

impl ExportDestination {
    pub fn parse(value: Option<&Value>) -> io::Result<Option<Self>> {
        let mut destination = value.filter(|value| !value.is_null())
            .map(|value| serde_json::from_value::<Self>(value.clone()))
            .transpose()?;
        if let Some(value) = destination.as_mut() {
            if value.directory.as_ref().is_some_and(|path| path.as_os_str().is_empty()) {
                value.directory = None;
            }
        }
        if let Some(directory) = destination.as_ref().and_then(|value| value.directory.as_deref()) {
            Self::check_directory(directory)?;
        }
        Ok(destination)
    }

    pub fn check_directory(path: &Path) -> io::Result<()> {
        if !path.is_absolute() || !path.is_dir() {
            return Err(invalid("导出目录无效或不存在"));
        }
        Ok(())
    }

    pub fn file_path(&self) -> io::Result<&Path> {
        let path = self.file_path.as_deref().ok_or_else(|| invalid("缺少静默导出文件路径"))?;
        check_output_file(path)?;
        Ok(path)
    }

    pub fn folder(&self) -> io::Result<&Path> {
        let path = self.folder.as_deref().ok_or_else(|| invalid("缺少静默导出文件夹"))?;
        Self::check_directory(path)?;
        if path.parent().is_none() {
            return Err(invalid("静默导出文件夹不能为根目录"));
        }
        Ok(path)
    }

    pub fn image_path(&self) -> io::Result<&Path> {
        let path = self.image_path.as_deref().ok_or_else(|| invalid("缺少关联 PNG 路径"))?;
        if !path.is_absolute() || !path.is_file() {
            return Err(invalid("关联 PNG 路径无效或不存在"));
        }
        Ok(path)
    }
}

fn check_output_file(path: &Path) -> io::Result<()> {
    if !path.is_absolute() || path.file_name().is_none() || (path.exists() && !path.is_file()) {
        return Err(invalid("导出文件路径无效"));
    }
    ExportDestination::check_directory(path.parent().ok_or_else(|| invalid("导出目录无效"))?)
}

pub fn export_target(destination: Option<&ExportDestination>, name: &str, extension: &str) -> io::Result<Option<PathBuf>> {
    let Some(destination) = destination else { return Ok(None) };
    if destination.silent {
        return Ok(Some(destination.file_path()?.to_path_buf()));
    }
    let Some(directory) = destination.directory.as_deref() else { return Ok(None) };
    if extension.is_empty() || !extension.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err(invalid("导出扩展名无效"));
    }
    let target = directory.join(format!("{}.{extension}", safe_base(name)));
    check_output_file(&target)?;
    Ok(Some(target))
}

pub fn export_parent(destination: Option<&ExportDestination>) -> io::Result<Option<PathBuf>> {
    let Some(destination) = destination else { return Ok(None) };
    if destination.silent {
        return Ok(Some(destination.folder()?.parent().unwrap().to_path_buf()));
    }
    Ok(destination.directory.clone())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationFrame {
    pub duration: u16,
    #[serde(default)]
    pub rgba: Vec<u8>,
    #[serde(default)]
    pub png: String,
    #[serde(skip)]
    pub png_bytes:Vec<u8>,
    pub source_index: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationOptions {
    pub width: u32,
    pub height: u32,
    pub frames: Vec<AnimationFrame>,
    #[serde(default = "default_colors")]
    pub colors: usize,
    #[serde(default = "default_threshold")]
    pub threshold: u8,
    #[serde(default = "default_alpha")]
    pub alpha_mode: String,
    #[serde(default = "default_matte")]
    pub matte: String,
    #[serde(default = "default_loop", rename = "loop")]
    pub looping: bool,
    #[serde(default)]
    pub tags: Vec<Value>,
    #[serde(default)]
    pub name: String,
    pub destination: Option<ExportDestination>,
}

fn default_colors() -> usize {
    256
}
fn default_threshold() -> u8 {
    127
}
fn default_alpha() -> String {
    "threshold".into()
}
fn default_matte() -> String {
    "#ffffff".into()
}
fn default_loop() -> bool {
    true
}

pub fn encode_gif(options: &AnimationOptions) -> io::Result<Vec<u8>> {
    check_animation(options.width, options.height, options.frames.len())?;
    if !(2..=256).contains(&options.colors)
        || !["threshold", "matte"].contains(&options.alpha_mode.as_str())
    {
        return Err(invalid("GIF 色数或透明度设置无效"));
    }
    let matte = u32::from_str_radix(
        options
            .matte
            .strip_prefix('#')
            .filter(|value| value.len() == 6)
            .ok_or_else(|| invalid("GIF 背景色无效"))?,
        16,
    )
    .map_err(|_| invalid("GIF 背景色无效"))?;
    let transparent = options.alpha_mode == "threshold";
    let limit = options.colors - usize::from(transparent);
    let mut output = Vec::new();
    {
        let mut encoder = gif::Encoder::new(
            &mut output,
            options.width as u16,
            options.height as u16,
            &[],
        )
        .map_err(|e| invalid(&e.to_string()))?;
        if options.looping {
            encoder
                .set_repeat(gif::Repeat::Infinite)
                .map_err(|e| invalid(&e.to_string()))?;
        }
        let mut elapsed = 0u32;
        let mut written = 0u32;
        for frame in &options.frames {
            if !(20..=10000).contains(&frame.duration)
                || frame.rgba.len() != options.width as usize * options.height as usize * 4
            {
                return Err(invalid("GIF 帧时长或像素尺寸无效"));
            }
            let mut rgba = frame.rgba.clone();
            let mut unique = HashMap::new();
            let mut palette = Vec::new();
            let mut visible = Vec::new();
            let mut exact = true;
            for pixel in rgba.chunks_exact_mut(4) {
                if transparent && pixel[3] <= options.threshold {
                    pixel[3] = 0;
                    continue;
                }
                if !transparent {
                    let alpha = f32::from(pixel[3]) / 255.0;
                    for (index, shift) in [16, 8, 0].into_iter().enumerate() {
                        pixel[index] = (f32::from(pixel[index]) * alpha
                            + ((matte >> shift) & 255) as f32 * (1.0 - alpha))
                            .round() as u8;
                    }
                }
                pixel[3] = 255;
                let rgb = [pixel[0], pixel[1], pixel[2]];
                if exact && !unique.contains_key(&rgb) {
                    unique.insert(rgb, unique.len());
                    palette.extend_from_slice(&rgb);
                    exact = unique.len() <= limit;
                }
                visible.extend_from_slice(pixel);
            }
            let mut indices = vec![0u8; rgba.len() / 4];
            let offset = usize::from(transparent);
            if exact {
                for (index, pixel) in rgba.chunks_exact(4).enumerate() {
                    if pixel[3] != 0 {
                        indices[index] = (unique[&[pixel[0], pixel[1], pixel[2]]] + offset) as u8;
                    }
                }
            } else {
                // NeuQuant requires at least two entries. Keep only the requested number afterward.
                let quantizer = color_quant::NeuQuant::new(10, limit.max(2), &visible);
                palette = quantizer.color_map_rgb();
                palette.truncate(limit * 3);
                for (index, pixel) in rgba.chunks_exact(4).enumerate() {
                    if pixel[3] == 0 {
                        continue;
                    }
                    let mapped = quantizer.index_of(pixel).min(limit - 1);
                    indices[index] = (mapped + offset) as u8;
                }
            }
            if transparent {
                palette.splice(0..0, [0, 0, 0]);
            }
            while palette.len() < 6 {
                palette.extend_from_slice(&[0, 0, 0]);
            }
            elapsed += u32::from(frame.duration);
            let rounded = (elapsed + 5) / 10;
            let delay = rounded - written;
            written = rounded;
            let encoded = gif::Frame {
                width: options.width as u16,
                height: options.height as u16,
                delay: delay as u16,
                dispose: gif::DisposalMethod::Background,
                transparent: transparent.then_some(0),
                palette: Some(palette),
                buffer: std::borrow::Cow::Owned(indices),
                ..Default::default()
            };
            encoder
                .write_frame(&encoded)
                .map_err(|e| invalid(&e.to_string()))?;
        }
    }
    check_size(output.len() as u64)?;
    Ok(output)
}

fn output_folder(
    parent: &Path,
    base: &str,
    files: &[(String, Vec<u8>)],
    destination: Option<&ExportDestination>,
) -> io::Result<PathBuf> {
    check_size(files.iter().map(|(_, bytes)| bytes.len() as u64).sum())?;
    if let Some(directory) = destination.and_then(|value| value.directory.as_deref()) {
        ExportDestination::check_directory(directory)?;
    }
    for (name, _) in files {
        if Path::new(name).file_name().is_none_or(|value| value != name.as_str())
            || name.contains(['/', '\\'])
            || name.chars().any(|c| c.is_control() || "<>:\"|?*".contains(c))
        {
            return Err(invalid("导出文件名无效"));
        }
    }
    if let Some(destination) = destination.filter(|value| value.silent) {
        let folder = destination.folder()?;
        for (name, data) in files {
            write_atomic(&folder.join(name), data)?;
        }
        return Ok(folder.to_path_buf());
    }
    let mut folder = parent.join(base);
    let mut suffix = 1;
    while folder.exists() {
        folder = parent.join(format!("{base}-{suffix}"));
        suffix += 1;
    }
    let staging = parent.join(format!(".minepix-export-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&staging)?;
    let result = (|| {
        for (name, data) in files {
            write_atomic(&staging.join(name), data)?;
        }
        fs::rename(&staging, &folder)?;
        Ok(folder)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

pub fn export_sequence(parent: &Path, options: &AnimationOptions) -> io::Result<Value> {
    check_animation(options.width, options.height, options.frames.len())?;
    let base = safe_base(&options.name);
    let mut entries = Vec::new();
    let mut files = Vec::new();
    for (index, frame) in options.frames.iter().enumerate() {
        if !(20..=10000).contains(&frame.duration) {
            return Err(invalid("PNG 序列时长无效"));
        }
        let bytes = if !frame.png_bytes.is_empty(){frame.png_bytes.clone()}else{STANDARD
            .decode(&frame.png)
            .map_err(|_| invalid("PNG 编码无效"))?};
        if png_size(&bytes)? != (options.width, options.height) {
            return Err(invalid("PNG 序列尺寸不一致"));
        }
        let file = format!("{base}-{:04}.png", index + 1);
        entries
            .push(json!({"file":file,"duration":frame.duration,"sourceIndex":frame.source_index}));
        files.push((file, bytes));
    }
    files.push(("animation.json".into(), serde_json::to_vec_pretty(&json!({"format":"pixel-studio-png-sequence","version":1,"width":options.width,"height":options.height,"tags":options.tags,"frames":entries}))?));
    let folder = output_folder(parent, &format!("{base}-frames"), &files, options.destination.as_ref())?;
    Ok(json!({"directory":folder.parent(),"folder":folder,"count":options.frames.len()}))
}

pub fn read_sequence(
    paths: &[PathBuf],
    manifest: Option<Value>,
    name: Option<String>,
) -> io::Result<Value> {
    if paths.is_empty() || paths.len() > 256 {
        return Err(invalid("PNG 序列需选择 1–256 张图片"));
    }
    let mut size = None;
    let mut files = Vec::new();
    let mut total = 0u64;
    for path in paths {
        let bytes = read_file(path)?;
        total += bytes.len() as u64;
        check_size(total)?;
        let current = png_size(&bytes)?;
        if size.is_some_and(|previous| previous != current) {
            return Err(invalid("PNG 序列尺寸不一致"));
        }
        size = Some(current);
        check_animation(current.0, current.1, paths.len())?;
        files.push(json!({"name":crate::files::basename(path),"data":STANDARD.encode(bytes)}));
    }
    let (width, height) = size.unwrap();
    if let Some(metadata) = &manifest {
        if metadata["width"] != width || metadata["height"] != height {
            return Err(invalid("PNG 实际尺寸与清单不一致"));
        }
    }
    Ok(
        json!({"type":"sequence","width":width,"height":height,"files":files,"manifest":manifest,"name":name.unwrap_or_else(|| paths[0].file_stem().unwrap_or_default().to_string_lossy().into_owned())}),
    )
}

pub fn read_sequence_manifest(path: &Path) -> io::Result<Value> {
    let metadata: Value = serde_json::from_slice(&read_file(path)?)?;
    if metadata["format"] != "pixel-studio-png-sequence" || metadata["version"] != 1 {
        return Err(invalid("PNG 序列清单无效"));
    }
    let frames = metadata["frames"]
        .as_array()
        .ok_or_else(|| invalid("序列缺少帧列表"))?;
    let root = path.parent().ok_or_else(|| invalid("清单路径无效"))?;
    let mut paths = Vec::new();
    for frame in frames {
        let duration = frame["duration"]
            .as_u64()
            .ok_or_else(|| invalid("帧时长无效"))?;
        if !(20..=10000).contains(&duration) {
            return Err(invalid("帧时长无效"));
        }
        let name = frame["file"]
            .as_str()
            .ok_or_else(|| invalid("PNG 文件名无效"))?;
        if !name.to_lowercase().ends_with(".png") {
            return Err(invalid("序列仅接受 PNG"));
        }
        paths.push(sibling(root, name)?);
    }
    read_sequence(&paths, Some(metadata), Some(crate::files::basename(root)))
}

pub fn read_sheet_manifest(path: &Path) -> io::Result<Value> {
    let bytes = read_file(path)?;
    let metadata: Value = serde_json::from_slice(&bytes)?;
    let name = metadata["image"]
        .as_str()
        .ok_or_else(|| invalid("清单缺少图片文件名"))?;
    if !name.to_lowercase().ends_with(".png") {
        return Err(invalid("图集图片必须为 PNG"));
    }
    let png = read_file(&sibling(
        path.parent().ok_or_else(|| invalid("清单路径无效"))?,
        name,
    )?)?;
    check_size((bytes.len() + png.len()) as u64)?;
    let (width, height) = png_size(&png)?;
    if metadata["size"]["w"] != width || metadata["size"]["h"] != height {
        return Err(invalid("PNG 尺寸与图集清单不一致"));
    }
    Ok(
        json!({"type":"sheet-manifest","name":path.file_stem().unwrap_or_default().to_string_lossy(),"metadata":metadata,"data":STANDARD.encode(png)}),
    )
}

#[cfg(test)]
pub fn export_sheet(parent: &Path, options: &Value) -> io::Result<Value> {
    export_sheet_bytes(parent,options,None)
}
pub fn export_sheet_bytes(parent:&Path,options:&Value,png:Option<&[u8]>)->io::Result<Value>{
    let bytes = if let Some(png)=png{png.to_vec()}else{STANDARD
        .decode(options["png"].as_str().ok_or_else(|| invalid("缺少 PNG"))?)
        .map_err(|_| invalid("PNG 编码无效"))?};
    let (width, height) = png_size(&bytes)?;
    let metadata = &options["metadata"];
    if metadata["size"]["w"] != width || metadata["size"]["h"] != height {
        return Err(invalid("图集尺寸无效"));
    }
    let frames = metadata["frames"]
        .as_array()
        .ok_or_else(|| invalid("图集缺少帧"))?;
    if frames.is_empty() || frames.len() > 256 {
        return Err(invalid("图集帧数无效"));
    }
    for frame in frames {
        let rect = &frame["frame"];
        let read = |key: &str| rect[key].as_u64().ok_or_else(|| invalid("图集帧范围无效"));
        let (x, y, w, h) = (read("x")?, read("y")?, read("w")?, read("h")?);
        if w == 0
            || h == 0
            || x + w > u64::from(width)
            || y + h > u64::from(height)
            || !frame["duration"]
                .as_u64()
                .is_some_and(|v| (20..=10000).contains(&v))
        {
            return Err(invalid("图集帧范围或时长无效"));
        }
    }
    let base = format!(
        "{}-sheet",
        safe_base(options["name"].as_str().unwrap_or("sprite"))
    );
    let image = format!("{base}.png");
    let format = options["engineFormat"].as_str().unwrap_or("native");
    let mut files = vec![(image.clone(), bytes)];
    if let Some(engine_files) = options["engineFiles"].as_object() {
        for (name, text) in engine_files {
            files.push((
                name.clone(),
                text.as_str()
                    .ok_or_else(|| invalid("图集元数据不是文本"))?
                    .as_bytes()
                    .to_vec(),
            ));
        }
    } else {
        let mut metadata = metadata.clone();
        metadata["image"] = json!(image);
        files.push((
            format!("{base}.json"),
            serde_json::to_vec_pretty(&metadata)?,
        ));
    }
    let destination = ExportDestination::parse(options.get("destination"))?;
    let folder = output_folder(parent, &base, &files, destination.as_ref())?;
    Ok(
        json!({"directory":folder.parent(),"folder":folder,"image":image,"metadata":format!("{base}.{}",if format=="godot" {"tres"}else{"json"}),"sourceMetadata":format!("{base}.{}",if format=="native"{"json"}else{"pixpix.json"}),"engineFormat":format}),
    )
}

#[cfg(test)]
pub fn check_sheet_image(image: &Path, options: &Value) -> io::Result<()> {
    check_sheet_image_bytes(image,options,None)
}
pub fn check_sheet_image_bytes(image:&Path,options:&Value,png:Option<&[u8]>)->io::Result<()>{
    let expected = if let Some(png)=png{png.to_vec()}else{STANDARD
        .decode(options["png"].as_str().ok_or_else(|| invalid("缺少预期 PNG"))?)
        .map_err(|_| invalid("PNG 编码无效"))?};
    if png_rgba(&read_file(image)?)? != png_rgba(&expected)? {
        return Err(invalid("关联 PNG 的尺寸或像素与当前导出设置不一致"));
    }
    Ok(())
}

#[cfg(test)]
pub fn export_sheet_metadata(image: &Path, target: &Path, options: &Value) -> io::Result<Value> {
    export_sheet_metadata_bytes(image,target,options,None)
}
pub fn export_sheet_metadata_bytes(image:&Path,target:&Path,options:&Value,png:Option<&[u8]>)->io::Result<Value>{
    check_output_file(target)?;
    let root = image.parent().ok_or_else(|| invalid("图集目录无效"))?;
    if fs::canonicalize(target.parent().unwrap())? != fs::canonicalize(root)? {
        return Err(invalid("请将 JSON 保存到 PNG 同一目录"));
    }
    if target.exists() && fs::canonicalize(target)? == fs::canonicalize(image)? {
        return Err(invalid("JSON 路径不能覆盖关联 PNG"));
    }
    check_sheet_image_bytes(image, options,png)?;
    let mut metadata = options["metadata"].as_object()
        .ok_or_else(|| invalid("图集元数据无效"))?.clone();
    metadata.insert("image".into(), json!(crate::files::basename(image)));
    crate::storage::write_json(target, &metadata)?;
    Ok(json!({"filePath":target,"directory":target.parent(),"imagePath":image,"image":crate::files::basename(image)}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dimensions_are_not_limited_by_total_pixels() {
        let mut bytes = png();
        bytes[16..20].copy_from_slice(&8192u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&4097u32.to_be_bytes());
        assert_eq!(png_size(&bytes).unwrap(), (8192, 4097));
        bytes[16..20].fill(0);
        assert!(png_size(&bytes).is_err());
        assert!(check_animation(4096, 4096, 3).is_ok());
        assert!(check_animation(4096, 4096, 256).is_ok());
        assert!(check_animation(0, 1, 1).is_err());
        assert!(check_animation(4097, 1, 1).is_err());
        assert!(check_animation(1, 1, 257).is_err());
    }
    fn png() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, 2, 1);
            encoder.set_color(png::ColorType::Rgba);
            let mut writer = encoder.write_header().unwrap();
            writer
                .write_image_data(&[255, 0, 0, 255, 0, 0, 255, 0])
                .unwrap();
        }
        bytes
    }
    #[test]
    fn gif_roundtrip_preserves_colors_alpha_and_timing() {
        let options:AnimationOptions=serde_json::from_value(json!({"width":2,"height":1,"frames":[{"duration":25,"rgba":[255,0,0,255,0,0,255,0]},{"duration":25,"rgba":[0,255,0,255,0,0,0,0]}],"colors":4})).unwrap();
        let bytes = encode_gif(&options).unwrap();
        let mut decoder = gif::DecodeOptions::new();
        decoder.set_color_output(gif::ColorOutput::RGBA);
        let mut reader = decoder.read_info(Cursor::new(bytes)).unwrap();
        let first = reader.read_next_frame().unwrap().unwrap();
        assert_eq!(first.delay, 3);
        assert_eq!(&first.buffer[..4], &[255, 0, 0, 255]);
        assert_eq!(first.buffer[7], 0);
        let second = reader.read_next_frame().unwrap().unwrap();
        assert_eq!(second.delay, 2);
        assert_eq!(&second.buffer[..4], &[0, 255, 0, 255]);
        assert!(reader.read_next_frame().unwrap().is_none());
    }
    #[test]
    fn sequence_export_import_and_path_boundary() {
        let root = tempfile::tempdir().unwrap();
        let png = png();
        let options:AnimationOptions=serde_json::from_value(json!({"name":"walk","width":2,"height":1,"tags":[],"frames":[{"duration":80,"png":STANDARD.encode(&png),"sourceIndex":3}]})).unwrap();
        let result = export_sequence(root.path(), &options).unwrap();
        let folder = Path::new(result["folder"].as_str().unwrap());
        let restored = read_sequence_manifest(&folder.join("animation.json")).unwrap();
        assert_eq!(restored["files"][0]["data"], STANDARD.encode(png));
        assert_eq!(restored["manifest"]["frames"][0]["duration"], 80);
        let second = export_sequence(root.path(), &options).unwrap();
        assert_ne!(result["folder"], second["folder"]);
        assert_eq!(result["directory"], json!(root.path()));
        assert_eq!(second["directory"], json!(root.path()));
        let metadata = json!({"format":"pixel-studio-png-sequence","version":1,"width":2,"height":1,"frames":[{"file":"../escape.png","duration":80}]});
        fs::write(
            folder.join("invalid.json"),
            serde_json::to_vec(&metadata).unwrap(),
        )
        .unwrap();
        assert!(read_sequence_manifest(&folder.join("invalid.json")).is_err());
    }
    #[test]
    fn silent_sequence_reuses_exact_folder_and_rejects_missing_destination() {
        let root = tempfile::tempdir().unwrap();
        let mut value = json!({"name":"walk","width":2,"height":1,"frames":[{"duration":80,"png":STANDARD.encode(png())}]});
        let first = export_sequence(root.path(), &serde_json::from_value(value.clone()).unwrap()).unwrap();
        let folder = Path::new(first["folder"].as_str().unwrap());
        fs::write(folder.join("keep.txt"), "unrelated").unwrap();
        value["frames"][0]["duration"] = json!(160);
        value["destination"] = json!({"silent":true,"folder":folder});
        let second = export_sequence(root.path(), &serde_json::from_value(value.clone()).unwrap()).unwrap();
        assert_eq!(second["folder"], first["folder"]);
        assert_eq!(second["directory"], json!(root.path()));
        assert_eq!(read_sequence_manifest(&folder.join("animation.json")).unwrap()["manifest"]["frames"][0]["duration"], 160);
        assert_eq!(fs::read_to_string(folder.join("keep.txt")).unwrap(), "unrelated");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
        for destination in [json!({"silent":true}), json!({"silent":true,"folder":root.path().join("missing")})] {
            value["destination"] = destination;
            assert!(export_sequence(root.path(), &serde_json::from_value(value.clone()).unwrap()).is_err());
        }
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
    }

    #[test]
    fn silent_sheet_reuses_folder_and_validates_all_names_before_writing() {
        let root = tempfile::tempdir().unwrap();
        let mut options = json!({"name":"hero","png":STANDARD.encode(png()),"metadata":{"size":{"w":2,"h":1},"frames":[{"frame":{"x":0,"y":0,"w":2,"h":1},"duration":100}]}});
        let first = export_sheet(root.path(), &options).unwrap();
        let folder = Path::new(first["folder"].as_str().unwrap());
        options["destination"] = json!({"silent":true,"folder":folder});
        options["metadata"]["frames"][0]["duration"] = json!(200);
        let second = export_sheet(root.path(), &options).unwrap();
        assert_eq!(second["folder"], first["folder"]);
        assert_eq!(second["directory"], json!(root.path()));
        assert_eq!(read_sheet_manifest(&folder.join("hero-sheet.json")).unwrap()["metadata"]["frames"][0]["duration"], 200);
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
        let before = fs::read(folder.join("hero-sheet.png")).unwrap();
        options["engineFiles"] = json!({"../escape.json":"invalid"});
        assert!(export_sheet(root.path(), &options).is_err());
        assert_eq!(fs::read(folder.join("hero-sheet.png")).unwrap(), before);
        assert!(!root.path().join("escape.json").exists());
    }

    #[test]
    fn configured_export_directory_resolves_files_and_folder_parent_without_a_picker() {
        let root = tempfile::tempdir().unwrap();
        let destination = ExportDestination::parse(Some(&json!({"directory":root.path()}))).unwrap().unwrap();
        for extension in ["png", "webp", "jpg", "jpeg", "bmp", "ico", "svg", "css", "gif", "aseprite", "json"] {
            let path = export_target(Some(&destination), "work", extension).unwrap().unwrap();
            assert_eq!(path, root.path().join(format!("work.{extension}")));
            write_atomic(&path, b"first").unwrap();
            write_atomic(&path, b"replacement").unwrap();
            assert_eq!(fs::read(path).unwrap(), b"replacement");
        }
        assert_eq!(export_parent(Some(&destination)).unwrap().unwrap(), root.path());
        let sanitized = export_target(Some(&destination), "../work:bad?", "png").unwrap().unwrap();
        assert_eq!(sanitized.parent().unwrap(), root.path());
        assert!(export_target(Some(&destination), "work", "../png").is_err());
        assert!(export_target(Some(&destination), "work", "").is_err());
        fs::create_dir(root.path().join("directory.png")).unwrap();
        assert!(export_target(Some(&destination), "directory", "png").is_err());
    }

    #[test]
    fn unconfigured_exports_still_request_a_picker_and_quick_exports_keep_exact_paths() {
        assert!(export_target(None, "work", "png").unwrap().is_none());
        assert!(export_parent(None).unwrap().is_none());
        let empty = ExportDestination::parse(Some(&json!({"directory":""}))).unwrap().unwrap();
        assert!(export_target(Some(&empty), "work", "png").unwrap().is_none());
        assert!(export_parent(Some(&empty)).unwrap().is_none());
        let root = tempfile::tempdir().unwrap();
        let file = root.path().join("previous-name.webp");
        let folder = root.path().join("previous-folder");
        fs::create_dir(&folder).unwrap();
        let quick = ExportDestination::parse(Some(&json!({"silent":true,"filePath":file,"folder":folder,"directory":root.path()}))).unwrap().unwrap();
        assert_eq!(export_target(Some(&quick), "new-name", "png").unwrap().unwrap(), file);
        assert_eq!(export_parent(Some(&quick)).unwrap().unwrap(), root.path());
        let incomplete = ExportDestination::parse(Some(&json!({"silent":true,"directory":root.path()}))).unwrap().unwrap();
        assert!(export_target(Some(&incomplete), "work", "png").is_err());
        assert!(export_parent(Some(&incomplete)).is_err());
    }

    #[test]
    fn destinations_require_explicit_valid_paths_without_fallbacks() {
        let root = tempfile::tempdir().unwrap();
        assert!(ExportDestination::parse(None).unwrap().is_none());
        assert!(ExportDestination::parse(Some(&Value::Null)).unwrap().is_none());
        assert!(ExportDestination::parse(Some(&json!({"directory":""}))).unwrap().unwrap().directory.is_none());
        for value in [json!(false), json!({"silent":"true"}),
            json!({"directory":"relative"}), json!({"directory":root.path().join("missing")})] {
            assert!(ExportDestination::parse(Some(&value)).is_err());
        }
        let destination = ExportDestination::parse(Some(&json!({"silent":true,"directory":root.path()}))).unwrap().unwrap();
        assert!(destination.file_path().is_err());
        assert!(destination.folder().is_err());
        assert!(destination.image_path().is_err());
        for path in [PathBuf::from("relative.png"), root.path().to_path_buf(), root.path().join("missing/image.png")] {
            let destination = ExportDestination::parse(Some(&json!({"silent":true,"filePath":path}))).unwrap().unwrap();
            assert!(destination.file_path().is_err());
        }
        let path = root.path().join("remembered.png");
        let destination = ExportDestination::parse(Some(&json!({"silent":true,"filePath":path}))).unwrap().unwrap();
        assert_eq!(destination.file_path().unwrap(), path);
        write_atomic(destination.file_path().unwrap(), b"first").unwrap();
        write_atomic(destination.file_path().unwrap(), b"second").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
    }

    #[test]
    fn metadata_export_reuses_exact_image_and_json_paths_and_checks_pixels() {
        let root = tempfile::tempdir().unwrap();
        let image = root.path().join("remembered.png");
        let target = root.path().join("remembered.json");
        fs::write(&image, png()).unwrap();
        let mut options = json!({"png":STANDARD.encode(png()),"metadata":{"image":"old.png","size":{"w":2,"h":1}}});
        let destination = ExportDestination::parse(Some(&json!({"silent":true,"imagePath":image,"filePath":target}))).unwrap().unwrap();
        let result = export_sheet_metadata(destination.image_path().unwrap(), destination.file_path().unwrap(), &options).unwrap();
        assert_eq!(result["filePath"], json!(target));
        assert_eq!(result["imagePath"], json!(image));
        assert_eq!(result["directory"], json!(root.path()));
        assert_eq!(serde_json::from_slice::<Value>(&fs::read(&target).unwrap()).unwrap()["image"], "remembered.png");
        let before = fs::read(&target).unwrap();
        let mut equivalent = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut equivalent, 2, 1);
            encoder.set_color(png::ColorType::Rgba);
            encoder.add_text_chunk("Comment".into(), "same pixels".into()).unwrap();
            encoder.write_header().unwrap().write_image_data(&[255, 0, 0, 255, 0, 0, 255, 0]).unwrap();
        }
        assert_ne!(equivalent, png());
        options["png"] = json!(STANDARD.encode(equivalent));
        export_sheet_metadata(&image, &target, &options).unwrap();
        assert!(export_sheet_metadata(&image, &image, &options).is_err());
        assert_eq!(fs::read(&image).unwrap(), png());
        let mut different = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut different, 2, 1);
            encoder.set_color(png::ColorType::Rgba);
            encoder.write_header().unwrap().write_image_data(&[0; 8]).unwrap();
        }
        options["png"] = json!(STANDARD.encode(different));
        assert!(export_sheet_metadata(&image, &target, &options).is_err());
        assert_eq!(fs::read(&target).unwrap(), before);
        options["png"] = json!(STANDARD.encode(png()));
        let other = tempfile::tempdir().unwrap();
        assert!(export_sheet_metadata(&image, &other.path().join("different.json"), &options).is_err());
        assert!(!other.path().join("different.json").exists());
        fs::remove_file(&image).unwrap();
        assert!(destination.image_path().is_err());
        assert!(export_sheet_metadata(&image, &target, &options).is_err());
        assert_eq!(fs::read(&target).unwrap(), before);
    }

    #[test]
    fn sheet_export_preserves_image_and_metadata() {
        let root = tempfile::tempdir().unwrap();
        let bytes = png();
        let metadata = json!({"format":"test","size":{"w":2,"h":1},"frames":[{"frame":{"x":0,"y":0,"w":2,"h":1},"duration":100}]});
        let result = export_sheet(
            root.path(),
            &json!({"name":"hero","png":STANDARD.encode(&bytes),"metadata":metadata}),
        )
        .unwrap();
        let folder = Path::new(result["folder"].as_str().unwrap());
        let restored = read_sheet_manifest(&folder.join("hero-sheet.json")).unwrap();
        assert_eq!(restored["data"], STANDARD.encode(bytes));
        assert_eq!(restored["metadata"]["image"], "hero-sheet.png");
        assert_eq!(
            png_rgba(&png()).unwrap().2,
            vec![255, 0, 0, 255, 0, 0, 255, 0]
        );
    }
}
