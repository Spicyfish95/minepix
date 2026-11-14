use flate2::{Compression, write::ZlibEncoder};
use serde_json::Value;
use std::{
    collections::HashMap,
    io::{self, Write},
};
mod reader;
pub use reader::decode;

const BLENDS: [&str; 19] = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
    "addition",
    "subtract",
    "divide",
];
fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn array(value: &Value) -> io::Result<&Vec<Value>> {
    value.as_array().ok_or_else(|| invalid("ASE 文档数组无效"))
}
fn number(value: &Value) -> io::Result<u32> {
    value
        .as_u64()
        .and_then(|n| u32::try_from(n).ok())
        .ok_or_else(|| invalid("ASE 数值越界"))
}
fn word(value: u32) -> io::Result<u16> {
    u16::try_from(value).map_err(|_| invalid("ASE 尺寸或数量超出 16-bit"))
}
fn opacity(value: &Value) -> io::Result<u8> {
    let n = value.as_f64().unwrap_or(100.0);
    if !(0.0..=100.0).contains(&n) {
        return Err(invalid("ASE 透明度无效"));
    }
    Ok((n * 255.0 / 100.0).round() as u8)
}
fn color(value: &Value) -> io::Result<[u8; 4]> {
    let text = value
        .as_str()
        .ok_or_else(|| invalid("ASE 色值无效"))?
        .trim_start_matches('#');
    let text = if text.len() == 6 {
        format!("{text}ff")
    } else {
        text.into()
    };
    if text.len() != 8 {
        return Err(invalid("ASE 色值无效"));
    }
    Ok(u32::from_str_radix(&text, 16)
        .map_err(|_| invalid("ASE 色值无效"))?
        .to_be_bytes())
}
#[derive(Default)]
struct Writer(Vec<u8>);
impl Writer {
    fn u8(&mut self, n: u8) {
        self.0.push(n)
    }
    fn u16(&mut self, n: u16) {
        self.0.extend(n.to_le_bytes())
    }
    fn u32(&mut self, n: u32) {
        self.0.extend(n.to_le_bytes())
    }
    fn zero(&mut self, n: usize) {
        self.0.resize(self.0.len() + n, 0)
    }
    fn string(&mut self, text: &str) -> io::Result<()> {
        self.u16(word(text.len() as u32)?);
        self.0.extend(text.as_bytes());
        Ok(())
    }
}
fn chunk(kind: u16, body: Writer) -> Vec<u8> {
    let mut out = Writer::default();
    out.u32((body.0.len() + 6) as u32);
    out.u16(kind);
    out.0.extend(body.0);
    out.0
}
fn order(
    layers: &[Value],
    parent: Option<u32>,
    depth: u16,
    out: &mut Vec<(usize, u16)>,
) -> io::Result<()> {
    if depth > 64 {
        return Err(invalid("ASE 图层组层级无效"));
    }
    for (index, layer) in layers.iter().enumerate() {
        let owner = layer.get("parentId").map(number).transpose()?;
        if owner == parent && layer["type"] != "reference" {
            out.push((index, depth));
            if layer["type"] == "group" {
                order(layers, Some(number(&layer["id"])?), depth + 1, out)?;
            }
        }
    }
    Ok(())
}

pub fn encode(doc: &Value) -> io::Result<Vec<u8>> {
    let width = word(number(&doc["width"])?)?;
    let height = word(number(&doc["height"])?)?;
    let layers = array(&doc["layers"])?;
    let frames = array(&doc["frames"])?;
    if width == 0 || height == 0 || layers.len() > 64 || frames.is_empty() || frames.len() > 256 {
        return Err(invalid("ASE 画布、图层或帧数无效"));
    }
    let mut ordered = Vec::new();
    order(layers, None, 0, &mut ordered)?;
    if ordered.len() != layers.iter().filter(|l| l["type"] != "reference").count()
        || !ordered.iter().any(|(i, _)| layers[*i]["type"] != "group")
    {
        return Err(invalid("没有可导出的像素图层或图层层级无效"));
    }
    let groups: Vec<&Value> = layers.iter().filter(|l| l["type"] == "group").collect();
    if groups.iter().any(|g| g["passThrough"] == true)
        && groups.iter().any(|g| g["passThrough"] != true)
    {
        return Err(invalid("ASE 不能同时保留隔离组与穿透组"));
    }
    let depth = match doc["colorMode"].as_str() {
        Some("indexed") => 8,
        Some("grayscale") => 16,
        _ => 32,
    };
    let palette = doc["palette"].as_array().cloned().unwrap_or_default();
    if palette.len() > 256 || depth == 8 && palette.is_empty() {
        return Err(invalid("ASE 色板数量无效"));
    }
    let mut initial = Vec::new();
    for &(index, level) in &ordered {
        let layer = &layers[index];
        let group = layer["type"] == "group";
        let flags = u16::from(layer["visible"] != false)
            | if layer["locked"] == true { 0 } else { 2 }
            | if layer["type"] == "background" { 8 } else { 0 }
            | if layer["continuous"] == true { 16 } else { 0 }
            | if group && layer["collapsed"] == true {
                32
            } else {
                0
            };
        let mut body = Writer::default();
        body.u16(flags);
        body.u16(u16::from(group));
        body.u16(level);
        body.zero(4);
        let blend = BLENDS
            .iter()
            .position(|mode| *mode == layer["blendMode"].as_str().unwrap_or("normal"))
            .ok_or_else(|| invalid("不支持的 ASE 混合模式"))?;
        body.u16(blend as u16);
        body.u8(opacity(&layer["opacity"])?);
        body.zero(3);
        body.string(layer["name"].as_str().unwrap_or("Layer"))?;
        initial.push(chunk(0x2004, body));
    }
    if !palette.is_empty() {
        let mut body = Writer::default();
        body.u32(palette.len() as u32);
        body.u32(0);
        body.u32(palette.len() as u32 - 1);
        body.zero(8);
        for value in &palette {
            body.u16(0);
            body.0.extend(color(value)?);
        }
        initial.push(chunk(0x2019, body));
    }
    if let Some(tags) = doc["tags"].as_array().filter(|v| !v.is_empty()) {
        let mut body = Writer::default();
        body.u16(word(tags.len() as u32)?);
        body.zero(8);
        for tag in tags {
            let from = number(&tag["from"])?;
            let to = number(&tag["to"])?;
            if from > to || to >= frames.len() as u32 {
                return Err(invalid("ASE 标签范围无效"));
            }
            body.u16(word(from)?);
            body.u16(word(to)?);
            body.u8(match tag["direction"].as_str() {
                Some("forward") => 0,
                Some("reverse") => 1,
                Some("pingpong") => 2,
                _ => return Err(invalid("ASE 标签方向无效")),
            });
            body.zero(8);
            body.0.extend(&color(&tag["color"])?[..3]);
            body.u8(0);
            body.string(tag["name"].as_str().unwrap_or("Tag"))?;
        }
        initial.push(chunk(0x2018, body));
        for tag in tags {
            let mut body = Writer::default();
            body.u32(2);
            body.0.extend(color(&tag["color"])?);
            initial.push(chunk(0x2020, body));
        }
    }
    if let Some(slices) = doc["slices"].as_array() {
        for slice in slices {
            let keys = slice["keys"]
                .as_array()
                .cloned()
                .unwrap_or_else(|| vec![slice.clone()]);
            let center = keys.iter().any(|key| key["center"].is_object());
            let pivot = keys.iter().any(|key| key["pivot"].is_object());
            let mut body = Writer::default();
            body.u32(keys.len() as u32);
            body.u32(u32::from(center) | u32::from(pivot) * 2);
            body.zero(4);
            body.string(slice["name"].as_str().unwrap_or("Slice"))?;
            for key in keys {
                body.u32(key["frame"].as_u64().unwrap_or(0) as u32);
                let bounds = &key["bounds"];
                for field in ["x", "y", "w", "h"] {
                    body.u32(
                        bounds[field]
                            .as_i64()
                            .ok_or_else(|| invalid("ASE 切片矩形无效"))?
                            as u32,
                    );
                }
                if center {
                    for field in ["x", "y", "w", "h"] {
                        body.u32(key["center"][field].as_i64().unwrap_or(
                            if field == "w" || field == "h" {
                                bounds[field].as_i64().unwrap_or(0)
                            } else {
                                0
                            },
                        ) as u32);
                    }
                }
                if pivot {
                    body.u32(key["pivot"]["x"].as_i64().unwrap_or(0) as u32);
                    body.u32(key["pivot"]["y"].as_i64().unwrap_or(0) as u32);
                }
            }
            initial.push(chunk(0x2022, body));
        }
    }
    let mut body = Vec::new();
    let mut links = HashMap::new();
    let mut total_pixels = 0usize;
    for (frame_index, frame) in frames.iter().enumerate() {
        let duration = word(number(&frame["duration"])?)?;
        if !(20..=10000).contains(&duration) {
            return Err(invalid("ASE 帧时长无效"));
        }
        let mut chunks = if frame_index == 0 {
            initial.clone()
        } else {
            Vec::new()
        };
        for (output_index, &(index, _)) in ordered.iter().enumerate() {
            let layer = &layers[index];
            if layer["type"] == "group" {
                continue;
            }
            let id = number(&layer["id"])?;
            let properties = &frame["celProperties"][id.to_string()];
            let mut cel = Writer::default();
            cel.u16(output_index as u16);
            for axis in ["x", "y"] {
                let n = properties[axis].as_i64().unwrap_or(0);
                let n = i16::try_from(n).map_err(|_| invalid("ASE cel 位置越界"))?;
                cel.u16(n as u16);
            }
            cel.u8(opacity(&properties["opacity"])?);
            let link = frame["links"][id.to_string()].as_str();
            let link_key = (index, link.unwrap_or("").to_string());
            if let Some(previous) = link.and_then(|_| links.get(&link_key)) {
                cel.u16(1);
                cel.zero(7);
                cel.u16(*previous);
                chunks.push(chunk(0x2005, cel));
                continue;
            }
            let w = word(properties["width"].as_u64().unwrap_or(u64::from(width)) as u32)?;
            let h = word(properties["height"].as_u64().unwrap_or(u64::from(height)) as u32)?;
            if w == 0 || h == 0 {
                return Err(invalid("ASE cel 尺寸无效"));
            }
            let pixels = array(&frame["cels"][index])?;
            if pixels.len() != usize::from(w) * usize::from(h) {
                return Err(invalid("ASE cel 像素尺寸不一致"));
            }
            total_pixels += pixels.len();
            if total_pixels > 32 * 1024 * 1024 {
                return Err(invalid("ASE 原始像素超过 32M"));
            }
            let mut raw = Vec::with_capacity(pixels.len() * (depth / 8));
            for (i, pixel) in pixels.iter().enumerate() {
                let pixel = number(pixel)?;
                match depth {
                    8 => {
                        let value = number(&frame["indices"][index][i])?;
                        if value >= palette.len() as u32 {
                            return Err(invalid("ASE 索引像素超出色板"));
                        }
                        raw.push(value as u8);
                    }
                    16 => raw.extend([(pixel >> 24) as u8, pixel as u8]),
                    _ => raw.extend(pixel.to_be_bytes()),
                }
            }
            let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
            encoder.write_all(&raw)?;
            cel.u16(2);
            cel.zero(7);
            cel.u16(w);
            cel.u16(h);
            cel.0.extend(encoder.finish()?);
            chunks.push(chunk(0x2005, cel));
            if link.is_some() {
                links.insert(link_key, frame_index as u16);
            }
        }
        let mut header = Writer::default();
        header.u32((16 + chunks.iter().map(Vec::len).sum::<usize>()) as u32);
        header.u16(0xf1fa);
        header.u16(word(chunks.len() as u32)?);
        header.u16(duration);
        header.zero(2);
        header.u32(chunks.len() as u32);
        body.extend(header.0);
        for chunk in chunks {
            body.extend(chunk);
        }
    }
    let mut header = Writer::default();
    header.u32((128 + body.len()) as u32);
    header.u16(0xa5e0);
    header.u16(frames.len() as u16);
    header.u16(width);
    header.u16(height);
    header.u16(depth as u16);
    header.u32(
        if !groups.is_empty() && groups.iter().all(|g| g["passThrough"] != true) {
            3
        } else {
            1
        },
    );
    header.u16(number(&frames[0]["duration"])? as u16);
    header.zero(8);
    let transparent = doc["transparentIndex"].as_u64().unwrap_or(0);
    if depth == 8 && transparent >= palette.len() as u64 {
        return Err(invalid("ASE 透明索引无效"));
    }
    header.u8(transparent as u8);
    header.zero(3);
    header.u16(palette.len() as u16);
    header.u8(1);
    header.u8(1);
    header.zero(92);
    header.0.extend(body);
    crate::storage::check_size(header.0.len() as u64)?;
    Ok(header.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Read;
    fn u16_at(b: &[u8], p: usize) -> u16 {
        u16::from_le_bytes(b[p..p + 2].try_into().unwrap())
    }
    fn u32_at(b: &[u8], p: usize) -> u32 {
        u32::from_le_bytes(b[p..p + 4].try_into().unwrap())
    }
    fn chunks(bytes: &[u8]) -> Vec<Vec<(u16, Vec<u8>)>> {
        assert_eq!(bytes.len(), u32_at(bytes, 0) as usize);
        assert_eq!(u16_at(bytes, 4), 0xa5e0);
        let mut p = 128;
        let mut frames = Vec::new();
        while p < bytes.len() {
            let end = p + u32_at(bytes, p) as usize;
            assert_eq!(u16_at(bytes, p + 4), 0xf1fa);
            let count = u32_at(bytes, p + 12);
            p += 16;
            let mut chunks = Vec::new();
            for _ in 0..count {
                let len = u32_at(bytes, p) as usize;
                chunks.push((u16_at(bytes, p + 4), bytes[p + 6..p + len].to_vec()));
                p += len;
            }
            assert_eq!(p, end);
            frames.push(chunks);
        }
        frames
    }
    fn document() -> Value {
        json!({"width":2,"height":1,"layers":[{"id":1,"name":"像素","visible":true,"opacity":100,"continuous":true}],"palette":["#11223344","#8899aaff"],"frames":[{"duration":80,"cels":[[0x11223344u32,0x8899aaffu32]],"indices":[[0,1]],"links":{"1":"shared"},"celProperties":{"1":{"x":-2,"y":3,"width":2,"height":1,"opacity":50}}},{"duration":120,"cels":[[0x11223344u32,0x8899aaffu32]],"indices":[[0,1]],"links":{"1":"shared"}}]})
    }
    #[test]
    fn writes_pixel_modes_and_linked_cels() {
        for (mode, depth, expected) in [
            (
                "rgba",
                32,
                vec![0x11, 0x22, 0x33, 0x44, 0x88, 0x99, 0xaa, 0xff],
            ),
            ("grayscale", 16, vec![0x11, 0x44, 0x88, 0xff]),
            ("indexed", 8, vec![0, 1]),
        ] {
            let mut doc = document();
            doc["colorMode"] = json!(mode);
            let bytes = encode(&doc).unwrap();
            assert_eq!(u16_at(&bytes, 12), depth);
            let frames = chunks(&bytes);
            let cel = &frames[0].iter().find(|c| c.0 == 0x2005).unwrap().1;
            assert_eq!(u16_at(cel, 2) as i16, -2);
            assert_eq!(cel[6], 128);
            let mut raw = Vec::new();
            flate2::read::ZlibDecoder::new(&cel[20..])
                .read_to_end(&mut raw)
                .unwrap();
            assert_eq!(raw, expected);
            let link = &frames[1].iter().find(|c| c.0 == 0x2005).unwrap().1;
            assert_eq!(u16_at(link, 7), 1);
            assert_eq!(u16_at(link, 16), 0);
            assert_eq!(u16_at(&frames[0][0].1, 0) & 16, 16);
        }
    }
    #[test]
    fn writes_groups_tags_and_slice_keys() {
        let mut doc = document();
        doc["layers"][0]["parentId"] = json!(2);
        doc["layers"].as_array_mut().unwrap().push(json!({"id":2,"name":"组","type":"group","collapsed":true,"opacity":100,"blendMode":"multiply"}));
        doc["tags"] =
            json!([{"name":"Walk","from":0,"to":1,"direction":"reverse","color":"#123456"}]);
        doc["slices"] = json!([{"name":"Body","keys":[{"frame":0,"bounds":{"x":0,"y":0,"w":2,"h":1},"pivot":{"x":-1,"y":1}}]}]);
        let bytes = encode(&doc).unwrap();
        let frames = chunks(&bytes);
        assert_eq!(u32_at(&bytes, 14), 3);
        let layers: Vec<_> = frames[0].iter().filter(|c| c.0 == 0x2004).collect();
        assert_eq!(u16_at(&layers[0].1, 0) & 32, 32);
        assert_eq!(u16_at(&layers[0].1, 10), 1);
        assert_eq!(u16_at(&layers[1].1, 4), 1);
        let tag = &frames[0].iter().find(|c| c.0 == 0x2018).unwrap().1;
        assert_eq!(u16_at(tag, 10), 0);
        assert_eq!(u16_at(tag, 12), 1);
        assert_eq!(tag[14], 1);
        assert!(frames[0].iter().any(|c| c.0 == 0x2020));
        let slice = &frames[0].iter().find(|c| c.0 == 0x2022).unwrap().1;
        assert_eq!(u32_at(slice, 0), 1);
        assert_eq!(u32_at(slice, 4), 2);
        assert_eq!(u32_at(slice, 30), 2);
        assert_eq!(u32_at(slice, 34), 1);
        assert_eq!(u32_at(slice, 38) as i32, -1);
        assert_eq!(u32_at(slice, 42), 1);
    }
    #[test]
    fn rejects_mixed_group_modes_and_empty_export() {
        let mut partial = document();
        partial["layers"]
            .as_array_mut()
            .unwrap()
            .push(json!({"id":2,"type":"reference"}));
        assert_eq!(
            chunks(&encode(&partial).unwrap())[0]
                .iter()
                .filter(|c| c.0 == 0x2004)
                .count(),
            1
        );
        let mut doc = document();
        doc["layers"][0]["type"] = json!("reference");
        assert!(encode(&doc).is_err());
        let mut doc = document();
        doc["layers"].as_array_mut().unwrap().extend([
            json!({"id":2,"type":"group","passThrough":true}),
            json!({"id":3,"type":"group"}),
        ]);
        assert!(encode(&doc).is_err());
    }
}
