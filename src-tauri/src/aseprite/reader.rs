use super::{BLENDS, invalid};
use flate2::read::ZlibDecoder;
use serde_json::{Map, Value, json};
use std::{
    collections::{HashMap, VecDeque},
    io::{self, Read},
    rc::Rc,
};

const MAX_PIXELS: usize = 32 * 1024 * 1024;

struct Reader<'a> {
    bytes: &'a [u8],
    p: usize,
}
impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, p: 0 }
    }
    fn take(&mut self, n: usize) -> io::Result<&'a [u8]> {
        let end = self.p.checked_add(n).ok_or_else(|| invalid("ASE 块越界"))?;
        let result = self
            .bytes
            .get(self.p..end)
            .ok_or_else(|| invalid("ASE 数据截断"))?;
        self.p = end;
        Ok(result)
    }
    fn skip(&mut self, n: usize) -> io::Result<()> {
        self.take(n).map(|_| ())
    }
    fn u8(&mut self) -> io::Result<u8> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> io::Result<u16> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn i16(&mut self) -> io::Result<i16> {
        Ok(self.u16()? as i16)
    }
    fn u32(&mut self) -> io::Result<u32> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i32(&mut self) -> io::Result<i32> {
        Ok(self.u32()? as i32)
    }
    fn string(&mut self) -> io::Result<String> {
        let n = self.u16()? as usize;
        String::from_utf8(self.take(n)?.to_vec()).map_err(|_| invalid("ASE 字符串不是 UTF-8"))
    }
    fn rest(&self) -> &'a [u8] {
        &self.bytes[self.p..]
    }
}

fn pixels(w: usize, h: usize) -> io::Result<usize> {
    let count = w
        .checked_mul(h)
        .ok_or_else(|| invalid("ASE 像素超过 32M"))?;
    if w == 0 || h == 0 || count > MAX_PIXELS {
        return Err(invalid("ASE 尺寸无效或像素超过 32M"));
    }
    Ok(count)
}
fn charge(total: &mut usize, amount: usize) -> io::Result<()> {
    *total = total
        .checked_add(amount)
        .ok_or_else(|| invalid("ASE 像素超过 32M"))?;
    if *total > MAX_PIXELS {
        return Err(invalid("ASE 像素超过 32M"));
    }
    Ok(())
}
fn inflate(data: &[u8], size: usize) -> io::Result<Vec<u8>> {
    let mut result = Vec::new();
    let mut decoder = ZlibDecoder::new(data).take(size as u64 + 1);
    decoder.read_to_end(&mut result)?;
    if result.len() != size {
        return Err(invalid("ASE 解压尺寸不一致"));
    }
    Ok(result)
}
fn warn(warnings: &mut Vec<String>, message: impl Into<String>) {
    let message = message.into();
    if !warnings.contains(&message) {
        warnings.push(message);
    }
}
fn hex(rgba: u32) -> String {
    format!("#{rgba:08x}")
}
fn color(r: &mut Reader<'_>) -> io::Result<u32> {
    Ok(u32::from_be_bytes(r.take(4)?.try_into().unwrap()))
}
fn palette_entry(
    palette: &[Option<u32>],
    index: u8,
    transparent: u8,
    background: bool,
) -> io::Result<u32> {
    if !background && index == transparent {
        return Ok(0);
    }
    let pixel = palette
        .get(index as usize)
        .copied()
        .flatten()
        .ok_or_else(|| invalid("ASE 像素引用缺失色板项"))?;
    Ok(if background { pixel | 255 } else { pixel })
}

struct TileFormat {
    bits: usize,
    id: u32,
    x: u32,
    y: u32,
    diagonal: u32,
}
struct Cel<'a> {
    x: i16,
    y: i16,
    opacity: u8,
    kind: u16,
    link: usize,
    w: usize,
    h: usize,
    tiles: Option<TileFormat>,
    data: &'a [u8],
}
struct Frame<'a> {
    duration: u16,
    cels: HashMap<usize, Cel<'a>>,
}
struct Tileset {
    flags: u32,
    count: usize,
    w: usize,
    h: usize,
    data: Vec<u8>,
}
struct Image {
    w: usize,
    h: usize,
    raw: Vec<u8>,
    tilemap: bool,
}

fn tileset(r: &mut Reader<'_>, bpp: usize, total: &mut usize) -> io::Result<(u32, Tileset)> {
    let id = r.u32()?;
    let flags = r.u32()?;
    let count = r.u32()? as usize;
    let w = r.u16()? as usize;
    let h = r.u16()? as usize;
    r.skip(16)?;
    r.string()?;
    if flags & 1 != 0 {
        r.skip(8)?;
    }
    if flags & 2 == 0 {
        return Err(invalid("ASE 不支持未内嵌像素的外部瓦片集"));
    }
    if count == 0 {
        return Err(invalid("ASE 瓦片集数量无效"));
    }
    let n = pixels(w, h)?
        .checked_mul(count)
        .ok_or_else(|| invalid("ASE 瓦片集超过 32M"))?;
    charge(total, n)?;
    let size = r.u32()? as usize;
    let data = inflate(r.take(size)?, n * bpp)?;
    Ok((
        id,
        Tileset {
            flags,
            count,
            w,
            h,
            data,
        },
    ))
}

fn rasterize(
    cel: &Cel<'_>,
    set: &Tileset,
    bpp: usize,
    transparent: u8,
    total: &mut usize,
) -> io::Result<Image> {
    let format = cel
        .tiles
        .as_ref()
        .ok_or_else(|| invalid("ASE tilemap 格式缺失"))?;
    let w = cel
        .w
        .checked_mul(set.w)
        .ok_or_else(|| invalid("ASE tilemap 尺寸越界"))?;
    let h = cel
        .h
        .checked_mul(set.h)
        .ok_or_else(|| invalid("ASE tilemap 尺寸越界"))?;
    let n = pixels(w, h)?;
    charge(total, n)?;
    let stride = format.bits / 8;
    let tiles = inflate(cel.data, pixels(cel.w, cel.h)? * stride)?;
    let mut raw = vec![if bpp == 1 { transparent } else { 0 }; n * bpp];
    for row in 0..cel.h {
        for col in 0..cel.w {
            let at = (row * cel.w + col) * stride;
            let mut bytes = [0; 4];
            bytes[..stride].copy_from_slice(&tiles[at..at + stride]);
            let value = u32::from_le_bytes(bytes);
            let id = (value & format.id) as usize;
            let empty = if set.flags & 4 != 0 {
                id == 0
            } else {
                value == (u32::MAX >> (32 - format.bits))
            };
            if empty {
                continue;
            }
            if id >= set.count {
                return Err(invalid("ASE tilemap 引用越界瓦片"));
            }
            for y in 0..set.h {
                for x in 0..set.w {
                    let mut sx = if value & format.x != 0 {
                        set.w - 1 - x
                    } else {
                        x
                    };
                    let mut sy = if value & format.y != 0 {
                        set.h - 1 - y
                    } else {
                        y
                    };
                    if value & format.diagonal != 0 {
                        std::mem::swap(&mut sx, &mut sy);
                    }
                    if sx >= set.w || sy >= set.h {
                        continue;
                    }
                    let source = ((id * set.h + sy) * set.w + sx) * bpp;
                    let target = ((row * set.h + y) * w + col * set.w + x) * bpp;
                    raw[target..target + bpp].copy_from_slice(&set.data[source..source + bpp]);
                }
            }
        }
    }
    Ok(Image {
        w,
        h,
        raw,
        tilemap: true,
    })
}

/// Decode an ASE file into the editor memory model; native PIX storage stays independent.
pub fn decode(bytes: &[u8], name: &str) -> io::Result<Value> {
    crate::storage::check_size(bytes.len() as u64)?;
    let mut r = Reader::new(bytes);
    if bytes.len() < 128 || r.u32()? as usize != bytes.len() || r.u16()? != 0xa5e0 {
        return Err(invalid("不是完整的 ASE 文件"));
    }
    let count = r.u16()? as usize;
    let width = r.u16()? as usize;
    let height = r.u16()? as usize;
    let depth = r.u16()? as usize;
    if ![8, 16, 32].contains(&depth) {
        return Err(invalid("ASE 仅支持索引、灰度或 RGBA"));
    }
    let area = pixels(width, height)?;
    if count == 0 || count > 256 || area * count > MAX_PIXELS {
        return Err(invalid("ASE 帧数无效或像素超过 32M"));
    }
    let flags = r.u32()?;
    let speed = r.u16()?;
    r.skip(8)?;
    let transparent = r.u8()?;
    r.skip(3)?;
    let colors = match r.u16()? {
        0 => 256,
        n => n as usize,
    };
    r.skip(94)?;
    let bpp = depth / 8;
    let mut layers: Vec<Value> = Vec::new();
    let mut parents: Vec<Option<usize>> = Vec::new();
    let mut frames = Vec::new();
    let mut palette: Vec<Option<u32>> = Vec::new();
    let mut legacy_palette: Vec<Option<u32>> = Vec::new();
    let mut tags: Vec<Value> = Vec::new();
    let mut slices = Vec::new();
    let mut tag_queue = VecDeque::new();
    let mut warnings = Vec::new();
    let mut layer_sets = HashMap::new();
    let mut sets = HashMap::new();
    let mut raw_pixels = 0;
    for f in 0..count {
        let length = r.u32()? as usize;
        if length < 16 {
            return Err(invalid("ASE 帧长度无效"));
        }
        let mut frame_reader = Reader::new(r.take(length - 4)?);
        if frame_reader.u16()? != 0xf1fa {
            return Err(invalid("ASE 帧损坏"));
        }
        let old_chunks = frame_reader.u16()? as usize;
        let duration = match frame_reader.u16()? {
            0 => {
                if speed == 0 {
                    100
                } else {
                    speed
                }
            }
            n => n,
        };
        frame_reader.skip(2)?;
        let chunks = match frame_reader.u32()? {
            0 => old_chunks,
            n => n as usize,
        };
        let adjusted = duration.clamp(20, 10000);
        if duration != adjusted {
            warn(&mut warnings, "短 / 超长帧时长已调整到 20–10000 ms");
        }
        let mut frame = Frame {
            duration: adjusted,
            cels: HashMap::new(),
        };
        for _ in 0..chunks {
            let size = frame_reader.u32()? as usize;
            let kind = frame_reader.u16()?;
            if size < 6 {
                return Err(invalid("ASE 块长度无效"));
            }
            let mut chunk = Reader::new(frame_reader.take(size - 6)?);
            if kind != 0x2020 && kind != 0x2018 {
                tag_queue.clear();
            }
            match kind {
                0x2004 => {
                    let lf = chunk.u16()?;
                    let layer_kind = chunk.u16()?;
                    let level = chunk.u16()? as usize;
                    chunk.skip(4)?;
                    let blend = chunk.u16()? as usize;
                    let opacity = chunk.u8()?;
                    chunk.skip(3)?;
                    let layer_name = chunk.string()?;
                    if f != 0
                        || layer_kind > 2
                        || level > 63
                        || blend >= BLENDS.len()
                        || lf & 64 != 0
                    {
                        return Err(invalid("ASE 不支持未知混合模式、图层类型或参考图层"));
                    }
                    if layers.len() >= 64 {
                        return Err(invalid("ASE 图层超过 64"));
                    }
                    let id = layers.len() + 1;
                    let mut layer = json!({"id":id,"name":layer_name,"visible":lf&1!=0,"locked":lf&2==0,
                        "opacity":if layer_kind==1 && flags&2==0 {100.0} else if flags&1!=0 {opacity as f64*100.0/255.0} else {100.0}});
                    if level > 0 {
                        let parent = parents
                            .get(level - 1)
                            .copied()
                            .flatten()
                            .ok_or_else(|| invalid("ASE 图层组层级无效"))?;
                        layer["parentId"] = json!(parent);
                    }
                    if layer_kind == 1 {
                        layer["type"] = json!("group");
                        layer["collapsed"] = json!(lf & 32 != 0);
                        if flags & 2 == 0 {
                            layer["passThrough"] = json!(true);
                        }
                    } else {
                        if lf & 16 != 0 {
                            layer["continuous"] = json!(true);
                        }
                        if lf & 8 != 0 {
                            layer["type"] = json!("background");
                            layer["clearColor"] = json!(255);
                        }
                    }
                    if blend > 0 && (layer_kind != 1 || flags & 2 != 0) {
                        layer["blendMode"] = json!(BLENDS[blend]);
                    }
                    if layer_kind == 2 {
                        layer_sets.insert(id - 1, chunk.u32()?);
                        warn(
                            &mut warnings,
                            "Tilemap 图层已自动转换为普通像素图层（不保留瓦片关联）",
                        );
                    }
                    if flags & 4 != 0 {
                        chunk.skip(16)?;
                    }
                    parents.truncate(level);
                    parents.push(if layer_kind == 1 { Some(id) } else { None });
                    layers.push(layer);
                }
                0x2005 => {
                    let layer = chunk.u16()? as usize;
                    if layer >= 64 || frame.cels.contains_key(&layer) {
                        return Err(invalid("ASE cel 图层越界或重复"));
                    }
                    let x = chunk.i16()?;
                    let y = chunk.i16()?;
                    let opacity = chunk.u8()?;
                    let kind = chunk.u16()?;
                    let z = chunk.i16()?;
                    chunk.skip(5)?;
                    if z != 0 || kind > 3 {
                        return Err(invalid("ASE 不支持 cel Z 排序或未知 cel"));
                    }
                    let mut cel = Cel {
                        x,
                        y,
                        opacity,
                        kind,
                        link: 0,
                        w: 0,
                        h: 0,
                        tiles: None,
                        data: &[],
                    };
                    if kind == 1 {
                        cel.link = chunk.u16()? as usize;
                        if cel.link >= f {
                            return Err(invalid("链接 cel 必须引用之前的帧"));
                        }
                    } else {
                        cel.w = chunk.u16()? as usize;
                        cel.h = chunk.u16()? as usize;
                        charge(&mut raw_pixels, pixels(cel.w, cel.h)?)?;
                        if kind == 3 {
                            let bits = chunk.u16()? as usize;
                            if ![8, 16, 32].contains(&bits) {
                                return Err(invalid("ASE 不支持的瓦片位深"));
                            }
                            cel.tiles = Some(TileFormat {
                                bits,
                                id: chunk.u32()?,
                                x: chunk.u32()?,
                                y: chunk.u32()?,
                                diagonal: chunk.u32()?,
                            });
                            chunk.skip(10)?;
                        }
                        cel.data = chunk.rest();
                    }
                    frame.cels.insert(layer, cel);
                }
                0x2018 => {
                    let n = chunk.u16()? as usize;
                    if tags.len() + n > 256 {
                        return Err(invalid("ASE 标签超过 256"));
                    }
                    chunk.skip(8)?;
                    tag_queue.clear();
                    for _ in 0..n {
                        let from = chunk.u16()?;
                        let to = chunk.u16()?;
                        let direction = chunk.u8()? as usize;
                        let repeat = chunk.u16()?;
                        chunk.skip(6)?;
                        let rgb = chunk.take(3)?;
                        let color = format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]);
                        chunk.skip(1)?;
                        let tag_name = chunk.string()?;
                        if direction > 2
                            || from > to
                            || to as usize >= count
                            || tag_name.trim().is_empty()
                        {
                            return Err(invalid("ASE 标签范围、名称或方向不支持"));
                        }
                        if repeat != 0 {
                            warn(&mut warnings, "标签重复次数未保留");
                        }
                        tag_queue.push_back(tags.len());
                        tags.push(json!({"id":format!("ase-tag-{}",tags.len()),"name":tag_name,"from":from,"to":to,
                            "direction":(["forward","reverse","pingpong"][direction]),"color":color}));
                    }
                }
                0x2019 => {
                    let n = chunk.u32()? as usize;
                    let first = chunk.u32()? as usize;
                    let last = chunk.u32()? as usize;
                    chunk.skip(8)?;
                    if n > 256 || last >= n || first > last {
                        return Err(invalid("ASE 色板超出 256 或范围无效"));
                    }
                    let mut next = palette.clone();
                    next.resize(n, None);
                    for item in next.iter_mut().take(last + 1).skip(first) {
                        let pf = chunk.u16()?;
                        *item = Some(color(&mut chunk)?);
                        if pf & 1 != 0 {
                            chunk.string()?;
                        }
                    }
                    if f > 0 && depth == 8 && next != palette {
                        return Err(invalid("索引色逐帧色板尚不支持，请先转换 RGBA"));
                    }
                    if f > 0 && depth != 8 {
                        warn(&mut warnings, "只保留最终色板");
                    }
                    palette = next;
                }
                4 | 17 => {
                    let packets = chunk.u16()?;
                    let mut index = 0;
                    let mut next = legacy_palette.clone();
                    for _ in 0..packets {
                        index += chunk.u8()? as usize;
                        let n = match chunk.u8()? {
                            0 => 256,
                            n => n as usize,
                        };
                        if index + n > 256 {
                            return Err(invalid("ASE 旧色板超出 256"));
                        }
                        if next.len() < index + n {
                            next.resize(index + n, None);
                        }
                        for _ in 0..n {
                            let rgb = chunk.take(3)?;
                            if kind == 17 && rgb.iter().any(|v| *v > 63) {
                                return Err(invalid("ASE 旧色板通道无效"));
                            }
                            let scale = |v: u8| {
                                if kind == 17 {
                                    (u32::from(v) * 255 + 31) / 63
                                } else {
                                    u32::from(v)
                                }
                            };
                            next[index] = Some(
                                (scale(rgb[0]) << 24)
                                    | (scale(rgb[1]) << 16)
                                    | (scale(rgb[2]) << 8)
                                    | 255,
                            );
                            index += 1;
                        }
                    }
                    if f > 0 && depth == 8 && palette.is_empty() && next != legacy_palette {
                        return Err(invalid("索引色逐帧色板尚不支持，请先转换 RGBA"));
                    }
                    legacy_palette = next;
                }
                0x2022 => {
                    let n = chunk.u32()? as usize;
                    let sf = chunk.u32()?;
                    chunk.skip(4)?;
                    let slice_name = chunk.string()?;
                    if n == 0 || n > count || slices.len() >= 256 {
                        return Err(invalid("ASE Slice 关键帧数量无效"));
                    }
                    let mut keys: Vec<Value> = Vec::new();
                    for _ in 0..n {
                        let frame = chunk.u32()? as usize;
                        if frame >= count
                            || keys
                                .last()
                                .is_some_and(|k| k["frame"].as_u64().unwrap() >= frame as u64)
                        {
                            return Err(invalid("ASE Slice 关键帧顺序无效"));
                        }
                        let mut key = json!({"frame":frame,"bounds":{"x":chunk.i32()?,"y":chunk.i32()?,"w":chunk.u32()?,"h":chunk.u32()?}});
                        if sf & 1 != 0 {
                            let center = json!({"x":chunk.i32()?,"y":chunk.i32()?,"w":chunk.u32()?,"h":chunk.u32()?});
                            if key["bounds"]["w"] != 0 && key["bounds"]["h"] != 0 {
                                key["center"] = center;
                            }
                        }
                        if sf & 2 != 0 {
                            key["pivot"] = json!({"x":chunk.i32()?,"y":chunk.i32()?});
                        }
                        keys.push(key);
                    }
                    let mut slice = keys[0].clone();
                    slice.as_object_mut().unwrap().remove("frame");
                    slice["id"] = json!(format!("ase-slice-{}", slices.len()));
                    slice["name"] = json!(slice_name);
                    if keys.len() != 1 || keys[0]["frame"] != 0 {
                        slice["keys"] = json!(keys);
                    }
                    slices.push(slice);
                }
                0x2007 => {
                    let profile = chunk.u16()?;
                    let pf = chunk.u16()?;
                    if profile > 1 || pf != 0 {
                        return Err(invalid("ASE ICC / 特殊 gamma 尚不支持"));
                    }
                    chunk.skip(12)?;
                }
                0x2020 => {
                    let uf = chunk.u32()?;
                    if uf & 1 != 0 {
                        chunk.string()?;
                        warn(&mut warnings, "用户文字未保留");
                    }
                    let tag = tag_queue.pop_front();
                    if uf & 2 != 0 {
                        let rgba = chunk.take(4)?;
                        let color = format!("#{:02x}{:02x}{:02x}", rgba[0], rgba[1], rgba[2]);
                        if let Some(index) = tag {
                            tags[index]["color"] = json!(color);
                        } else {
                            warn(&mut warnings, "对象用户颜色未保留");
                        }
                    }
                    if uf & 4 != 0 {
                        warn(&mut warnings, "用户属性未保留");
                    }
                }
                0x2023 => {
                    let (id, set) = tileset(&mut chunk, bpp, &mut raw_pixels)?;
                    if sets.insert(id, set).is_some() {
                        return Err(invalid("ASE 重复瓦片集 ID"));
                    }
                }
                0x2006 | 0x2008 => return Err(invalid("ASE 不支持精确 cel 边界或外部依赖")),
                _ => warn(&mut warnings, format!("未保留块 0x{kind:x}")),
            }
        }
        if !frame_reader.rest().is_empty() {
            return Err(invalid("ASE 帧长度不一致"));
        }
        frames.push(frame);
    }
    if !r.rest().is_empty() {
        return Err(invalid("ASE 文件尾存在额外数据"));
    }
    if layers.is_empty() || area * layers.len() * count > MAX_PIXELS {
        return Err(invalid("ASE 图层无效或总像素超过 32M"));
    }
    if palette.is_empty() {
        palette = legacy_palette;
    }
    if depth == 8 {
        if palette.is_empty() || colors > 256 || transparent as usize >= colors.max(palette.len()) {
            return Err(invalid("ASE 色板或透明索引无效"));
        }
        palette.resize(colors.max(palette.len()), Some(255));
    }
    for layer in &mut layers {
        if layer["type"] == "background" {
            if depth == 8 {
                layer["clearIndex"] = json!(0);
                layer["clearColor"] = json!(palette_entry(&palette, 0, transparent, true)?);
            }
            if layer["parentId"] != Value::Null
                || layer["opacity"].as_f64() != Some(100.0)
                || layer["blendMode"] != Value::Null
            {
                return Err(invalid("ASE 背景层必须不透明并使用正常混合"));
            }
        }
    }
    let mut images: Vec<HashMap<usize, Rc<Image>>> = Vec::new();
    let mut output_frames: Vec<Value> = Vec::new();
    let mut output_pixels = 0;
    for frame in &frames {
        if frame.cels.keys().any(|l| *l >= layers.len()) {
            return Err(invalid("ASE cel 引用未知图层"));
        }
        let mut frame_images = HashMap::new();
        let mut cels = Vec::new();
        let mut indices = Vec::new();
        let mut properties = Map::new();
        for (l, layer) in layers.iter().enumerate() {
            let background = layer["type"] == "background";
            let group = layer["type"] == "group";
            let cel = frame.cels.get(&l);
            if group && cel.is_some() {
                return Err(invalid("ASE 图层组不能包含 cel"));
            }
            let image = if let Some(cel) = cel {
                let image = if cel.kind == 1 {
                    images[cel.link]
                        .get(&l)
                        .cloned()
                        .ok_or_else(|| invalid("链接目标 cel 不存在"))?
                } else if cel.kind == 3 {
                    let set = layer_sets
                        .get(&l)
                        .and_then(|id| sets.get(id))
                        .ok_or_else(|| invalid("ASE tilemap 引用缺失的瓦片集"))?;
                    Rc::new(rasterize(cel, set, bpp, transparent, &mut raw_pixels)?)
                } else {
                    let n = pixels(cel.w, cel.h)? * bpp;
                    let raw = if cel.kind == 2 {
                        inflate(cel.data, n)?
                    } else {
                        if cel.data.len() != n {
                            return Err(invalid("ASE cel 原始尺寸不一致"));
                        }
                        cel.data.to_vec()
                    };
                    Rc::new(Image {
                        w: cel.w,
                        h: cel.h,
                        raw,
                        tilemap: false,
                    })
                };
                frame_images.insert(l, Rc::clone(&image));
                Some(image)
            } else {
                None
            };
            let (w, h) = image
                .as_ref()
                .map(|image| {
                    if image.tilemap {
                        (width, height)
                    } else {
                        (width.max(image.w), height.max(image.h))
                    }
                })
                .unwrap_or((width, height));
            charge(&mut output_pixels, pixels(w, h)?)?;
            let default = if background {
                layer["clearColor"].as_u64().unwrap() as u32
            } else {
                0
            };
            let mut out = vec![default; w * h];
            let mut indexed = if depth == 8 && !group {
                Some(vec![if background { 0 } else { transparent }; w * h])
            } else {
                None
            };
            if let (Some(cel), Some(image)) = (cel, image) {
                if background
                    && (cel.x != 0 || cel.y != 0 || cel.opacity != 255 || w != width || h != height)
                {
                    return Err(invalid("背景 cel 位置、尺寸或透明度不支持"));
                }
                if !image.tilemap
                    && (cel.x != 0 || cel.y != 0 || cel.opacity != 255 || w != width || h != height)
                {
                    properties.insert((l+1).to_string(),json!({"x":cel.x,"y":cel.y,"width":w,"height":h,"opacity":cel.opacity as f64*100.0/255.0}));
                }
                for y in 0..image.h {
                    for x in 0..image.w {
                        let px = x as i64 + if image.tilemap { cel.x as i64 } else { 0 };
                        let py = y as i64 + if image.tilemap { cel.y as i64 } else { 0 };
                        if px < 0 || py < 0 || px >= w as i64 || py >= h as i64 {
                            continue;
                        }
                        let at = py as usize * w + px as usize;
                        let i = (y * image.w + x) * bpp;
                        out[at] = if depth == 8 {
                            let index = image.raw[i];
                            indexed.as_mut().unwrap()[at] = index;
                            palette_entry(&palette, index, transparent, background)?
                        } else {
                            let r = image.raw[i] as u32;
                            let g = if depth == 16 {
                                r
                            } else {
                                image.raw[i + 1] as u32
                            };
                            let b = if depth == 16 {
                                r
                            } else {
                                image.raw[i + 2] as u32
                            };
                            let a = image.raw[i + bpp - 1] as u32;
                            let a = if image.tilemap {
                                (a * u32::from(cel.opacity) + 127) / 255
                            } else {
                                a
                            };
                            let pixel = (r << 24) | (g << 16) | (b << 8) | a;
                            if background { over_black(pixel) } else { pixel }
                        };
                    }
                }
            }
            cels.push(json!(out));
            indices.push(json!(indexed));
        }
        let mut output = json!({"duration":frame.duration,"cels":cels});
        if depth == 8 {
            output["indices"] = json!(indices);
        }
        if !properties.is_empty() {
            output["celProperties"] = json!(properties);
        }
        // Pixel links share image content, while each cel keeps its own placement.
        for (&l, cel) in &frame.cels {
            if cel.kind != 1 {
                continue;
            }
            let target = &mut output_frames[cel.link];
            if output["cels"][l] == target["cels"][l]
                && (depth != 8 || output["indices"][l] == target["indices"][l])
            {
                let key = (l + 1).to_string();
                let id = target["links"][&key]
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| format!("ase-link-{l}-{}", cel.link));
                if target["links"].is_null() {
                    target["links"] = json!({});
                }
                target["links"][&key] = json!(id);
                if output["links"].is_null() {
                    output["links"] = json!({});
                }
                output["links"][&key] = json!(id);
            } else {
                warn(
                    &mut warnings,
                    "位移或透明度不同的链接 cel 已展开，保留外观但不共享编辑",
                );
            }
        }
        images.push(frame_images);
        output_frames.push(output);
    }
    // The editor stores groups after their children; ASE stores groups before them.
    let mut order = Vec::new();
    postorder(&layers, None, &mut order);
    let ordered_layers: Vec<_> = order.iter().map(|i| layers[*i].clone()).collect();
    let background_positions: Vec<_> = ordered_layers
        .iter()
        .enumerate()
        .filter(|(_, l)| l["type"] == "background")
        .map(|(i, _)| i)
        .collect();
    if background_positions.len() > 1 || background_positions.first().is_some_and(|p| *p != 0) {
        return Err(invalid("背景层必须位于最底层"));
    }
    for frame in &mut output_frames {
        frame["cels"] = json!(
            order
                .iter()
                .map(|i| frame["cels"][*i].clone())
                .collect::<Vec<_>>()
        );
        if depth == 8 {
            frame["indices"] = json!(
                order
                    .iter()
                    .map(|i| frame["indices"][*i].clone())
                    .collect::<Vec<_>>()
            );
        }
    }
    let mut doc = json!({"format":"pixel-studio","version":2,"requiredFeatures":[],"name":name,
        "width":width,"height":height,"layers":ordered_layers,"frames":output_frames,
        "palette":palette.iter().map(|p|hex(p.unwrap_or(0))).collect::<Vec<_>>(),"tags":tags,"slices":slices});
    if depth == 8 {
        doc["colorMode"] = json!("indexed");
        doc["transparentIndex"] = json!(transparent);
    } else if depth == 16 {
        doc["colorMode"] = json!("grayscale");
    }
    Ok(json!({"doc":doc,"warnings":warnings}))
}
fn over_black(pixel: u32) -> u32 {
    let a = pixel & 255;
    let channel = |shift: u32| (((pixel >> shift) & 255u32) * a + 127) / 255;
    (channel(24) << 24) | (channel(16) << 16) | (channel(8) << 8) | 255
}
fn postorder(layers: &[Value], parent: Option<u64>, out: &mut Vec<usize>) {
    for (i, layer) in layers.iter().enumerate() {
        if layer["parentId"].as_u64() == parent {
            if layer["type"] == "group" {
                postorder(layers, layer["id"].as_u64(), out);
            }
            out.push(i);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::{Writer, chunk, encode};
    use super::*;
    use flate2::{Compression, write::ZlibEncoder};
    use std::io::Write;

    const RGBA: &[u8] = include_bytes!("../../../tests/fixtures/rgba-linked.aseprite");
    const META: &[u8] = include_bytes!("../../../tests/fixtures/metadata-roundtrip.aseprite");
    fn compressed(bytes: &[u8]) -> Vec<u8> {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(bytes).unwrap();
        encoder.finish().unwrap()
    }
    fn document(bytes: &[u8]) -> Value {
        decode(bytes, "test").unwrap()["doc"].clone()
    }
    fn offsets(bytes: &[u8]) -> Vec<(usize, u16)> {
        let end = 128 + u32::from_le_bytes(bytes[128..132].try_into().unwrap()) as usize;
        let mut p = 144;
        let mut out = Vec::new();
        while p < end {
            out.push((
                p,
                u16::from_le_bytes(bytes[p + 4..p + 6].try_into().unwrap()),
            ));
            p += u32::from_le_bytes(bytes[p..p + 4].try_into().unwrap()) as usize;
        }
        out
    }
    fn append(bytes: &[u8], kind: u16, body: &[u8]) -> Vec<u8> {
        let mut writer = Writer::default();
        writer.0.extend(body);
        let extra = chunk(kind, writer);
        let end = 128 + u32::from_le_bytes(bytes[128..132].try_into().unwrap()) as usize;
        let mut out = bytes[..end].to_vec();
        out.extend(&extra);
        out.extend(&bytes[end..]);
        let length = out.len() as u32;
        out[..4].copy_from_slice(&length.to_le_bytes());
        out[128..132].copy_from_slice(&((end - 128 + extra.len()) as u32).to_le_bytes());
        let count = u16::from_le_bytes(bytes[134..136].try_into().unwrap()) + 1;
        out[134..136].copy_from_slice(&count.to_le_bytes());
        out[140..144].copy_from_slice(&(count as u32).to_le_bytes());
        out
    }
    fn tile_fixture(values: &[u32], set_flags: u32) -> Vec<u8> {
        let mut layer = Writer::default();
        layer.u16(3);
        layer.u16(2);
        layer.u16(0);
        layer.zero(4);
        layer.u16(0);
        layer.u8(128);
        layer.zero(3);
        layer.string("TM").unwrap();
        layer.u32(7);
        let mut set = Writer::default();
        set.u32(7);
        set.u32(set_flags);
        set.u32(2);
        set.u16(2);
        set.u16(2);
        set.zero(16);
        set.string("").unwrap();
        if set_flags & 1 != 0 {
            set.zero(8);
        }
        let raw = [
            0u32, 0, 0, 0, 0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffffffff,
        ];
        let data: Vec<_> = raw.iter().flat_map(|p| p.to_be_bytes()).collect();
        let data = compressed(&data);
        set.u32(data.len() as u32);
        set.0.extend(data);
        let mut cel = Writer::default();
        cel.u16(0);
        cel.u16(1);
        cel.u16(0);
        cel.u8(255);
        cel.u16(3);
        cel.zero(7);
        cel.u16(values.len() as u16);
        cel.u16(1);
        cel.u16(32);
        cel.u32(0x1fffffff);
        cel.u32(0x80000000);
        cel.u32(0x40000000);
        cel.u32(0x20000000);
        cel.zero(10);
        cel.0.extend(compressed(
            &values
                .iter()
                .flat_map(|v| v.to_le_bytes())
                .collect::<Vec<_>>(),
        ));
        let body: Vec<_> = [chunk(0x2004, layer), chunk(0x2023, set), chunk(0x2005, cel)].concat();
        let mut frame = Writer::default();
        frame.u32(body.len() as u32 + 16);
        frame.u16(0xf1fa);
        frame.u16(3);
        frame.u16(100);
        frame.zero(2);
        frame.u32(3);
        frame.0.extend(body);
        let mut header = Writer::default();
        header.u32(128 + frame.0.len() as u32);
        header.u16(0xa5e0);
        header.u16(1);
        header.u16(values.len() as u16 * 2 + 1);
        header.u16(2);
        header.u16(32);
        header.u32(1);
        header.zero(110);
        header.0.extend(frame.0);
        header.0
    }
    #[test]
    fn reads_independent_pixel_fixtures_and_links() {
        let doc = document(RGBA);
        assert_eq!(doc["width"], 2);
        assert_eq!(doc["layers"].as_array().unwrap().len(), 2);
        assert_eq!(doc["layers"][1]["locked"], true);
        assert_eq!(
            doc["layers"][1]["opacity"].as_f64().unwrap(),
            128.0 * 100.0 / 255.0
        );
        assert_eq!(doc["frames"][0]["duration"], 60);
        assert_eq!(doc["frames"][1]["duration"], 120);
        assert_eq!(doc["frames"][0]["cels"][0][0], 0xff0000ffu32);
        assert_eq!(doc["frames"][0]["cels"][0][2], 0x0000ff80u32);
        assert_eq!(doc["frames"][0]["cels"][0], doc["frames"][1]["cels"][0]);
        assert_eq!(
            doc["frames"][0]["links"]["1"],
            doc["frames"][1]["links"]["1"]
        );
        assert_eq!(doc["frames"][1]["celProperties"]["1"]["x"], 1);
        for (bytes, mode) in [
            (
                include_bytes!("../../../tests/fixtures/grayscale-linked.aseprite").as_slice(),
                "grayscale",
            ),
            (
                include_bytes!("../../../tests/fixtures/indexed-linked.aseprite").as_slice(),
                "indexed",
            ),
        ] {
            let doc = document(bytes);
            assert_eq!(doc["colorMode"], mode);
            assert_eq!(doc["frames"][0]["cels"][0], doc["frames"][1]["cels"][0]);
            assert!(!doc["frames"][0]["links"]["1"].is_null());
            if mode == "indexed" {
                assert_eq!(
                    doc["frames"][0]["indices"][0],
                    doc["frames"][1]["indices"][0]
                );
            }
        }
        let doc = document(META);
        assert_eq!(
            (doc["width"].clone(), doc["height"].clone()),
            (json!(4), json!(3))
        );
        assert_eq!(doc["frames"][0]["cels"][0][11], 0xabcdef01u32);
        assert_eq!(doc["tags"][0]["color"], "#123456");
        assert_eq!(doc["tags"][1]["direction"], "reverse");
        assert_eq!(doc["slices"][0]["center"]["w"], 2);
        assert_eq!(doc["slices"][0]["pivot"]["x"], 2);
        assert!(
            decode(META, "meta").unwrap()["warnings"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
    #[test]
    fn roundtrip_preserves_groups_metadata_and_flags() {
        let mut doc = document(RGBA);
        doc["layers"][0]["continuous"] = json!(true);
        doc["layers"][0]["parentId"] = json!(3);
        doc["layers"].as_array_mut().unwrap().insert(1,json!({"id":3,"name":"组","type":"group","collapsed":true,"visible":true,"locked":false,"opacity":100,"blendMode":"multiply"}));
        for frame in doc["frames"].as_array_mut().unwrap() {
            frame["cels"]
                .as_array_mut()
                .unwrap()
                .insert(1, json!([0, 0, 0, 0]));
        }
        doc["slices"][0]["keys"] = json!([
            {"frame":0,"bounds":{"x":0,"y":0,"w":2,"h":2},"center":{"x":0,"y":0,"w":1,"h":1},"pivot":{"x":1,"y":1}},
            {"frame":1,"bounds":{"x":1,"y":0,"w":1,"h":2},"center":{"x":0,"y":0,"w":1,"h":1},"pivot":{"x":0,"y":1}}]);
        let imported = document(&encode(&doc).unwrap());
        assert_eq!(imported["layers"][0]["continuous"], true);
        assert_eq!(imported["layers"][1]["type"], "group");
        assert_eq!(imported["layers"][1]["collapsed"], true);
        assert_eq!(imported["layers"][1]["blendMode"], "multiply");
        assert_eq!(
            imported["layers"][0]["parentId"],
            imported["layers"][1]["id"]
        );
        assert_eq!(imported["slices"][0]["keys"], doc["slices"][0]["keys"]);
        assert_eq!(imported["tags"], doc["tags"]);
        assert_eq!(imported["frames"][0]["cels"], doc["frames"][0]["cels"]);
        // ASE can store either pass-through or isolated groups globally.
        doc["layers"][1]["passThrough"] = json!(true);
        let imported = document(&encode(&doc).unwrap());
        assert_eq!(imported["layers"][1]["passThrough"], true);
        assert_eq!(imported["layers"][1]["opacity"].as_f64(), Some(100.0));
    }
    #[test]
    fn rasterizes_embedded_tiles_and_flips() {
        let bytes = tile_fixture(&[1, 0x80000001, 0x40000001, 0x20000001, 0], 6);
        let imported = decode(&bytes, "tile").unwrap();
        let doc = &imported["doc"];
        let (r, g, b, w) = (0xff0000ffu32, 0x00ff00ffu32, 0x0000ffffu32, 0xffffffffu32);
        assert_eq!(
            doc["frames"][0]["cels"][0],
            json!([
                0, r, g, g, r, b, w, r, b, 0, 0, 0, b, w, w, b, r, g, g, w, 0, 0
            ])
        );
        assert!(
            imported["warnings"][0]
                .as_str()
                .unwrap()
                .contains("普通像素图层")
        );
        let grass = document(include_bytes!("../../../tests/fixtures/grass.ase"));
        assert_eq!(grass["colorMode"], "indexed");
        assert_eq!(grass["width"], 128);
        assert_eq!(
            grass["frames"][0]["cels"][1]
                .as_array()
                .unwrap()
                .iter()
                .filter(|p| p.as_u64().unwrap() & 255 != 0)
                .count(),
            9086
        );
        assert!(
            decode(&tile_fixture(&[99], 6), "bad")
                .unwrap_err()
                .to_string()
                .contains("越界瓦片")
        );
        assert!(
            decode(&tile_fixture(&[1], 1), "bad")
                .unwrap_err()
                .to_string()
                .contains("外部瓦片集")
        );
    }
    #[test]
    fn rejects_corruption_limits_and_unsupported_semantics() {
        for n in [0, 4, 127, RGBA.len() - 1] {
            assert!(decode(&RGBA[..n], "bad").is_err());
        }
        let mut bytes = RGBA.to_vec();
        bytes[8..12].fill(255);
        assert!(
            decode(&bytes, "big")
                .unwrap_err()
                .to_string()
                .contains("32M")
        );
        let mut bytes = RGBA.to_vec();
        bytes[12..14].copy_from_slice(&24u16.to_le_bytes());
        assert!(decode(&bytes, "depth").is_err());
        let layer = offsets(META).iter().find(|c| c.1 == 0x2004).unwrap().0;
        let cel = offsets(META).iter().find(|c| c.1 == 0x2005).unwrap().0;
        let mut bytes = META.to_vec();
        bytes[layer + 6] |= 64;
        assert!(
            decode(&bytes, "ref")
                .unwrap_err()
                .to_string()
                .contains("参考")
        );
        let mut bytes = META.to_vec();
        bytes[cel + 15] = 1;
        assert!(
            decode(&bytes, "z")
                .unwrap_err()
                .to_string()
                .contains("排序")
        );
        for kind in [0x2006, 0x2008] {
            assert!(decode(&append(META, kind, &[]), "bad").is_err());
        }
        assert!(
            decode(&append(META, 0x2007, &[2, 0, 0, 0]), "icc")
                .unwrap_err()
                .to_string()
                .contains("ICC")
        );
        let result = decode(&append(META, 0xbeef, &[]), "unknown").unwrap();
        assert!(
            result["warnings"]
                .as_array()
                .unwrap()
                .contains(&json!("未保留块 0xbeef"))
        );
        let result = decode(&append(META, 0x2020, &[1, 0, 0, 0, 1, 0, 65]), "text").unwrap();
        assert!(
            result["warnings"]
                .as_array()
                .unwrap()
                .contains(&json!("用户文字未保留"))
        );
        let mut bytes = tile_fixture(&[1], 6);
        let end = bytes.len();
        bytes[end - 1] ^= 255;
        assert!(decode(&bytes, "zip").is_err());
        // Wider than 512 is valid when the total pixel budget allows it.
        let mut bytes = RGBA.to_vec();
        bytes[8..10].copy_from_slice(&513u16.to_le_bytes());
        assert_eq!(document(&bytes)["width"], 513);
        // Every prefix must report a parse error without indexing outside the buffer.
        for n in 128..META.len() {
            let mut truncated = META[..n].to_vec();
            truncated[..4].copy_from_slice(&(n as u32).to_le_bytes());
            assert!(decode(&truncated, "truncated").is_err());
        }
    }
}
