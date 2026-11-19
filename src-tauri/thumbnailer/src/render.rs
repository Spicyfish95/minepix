use crate::Thumbnail;
use serde_json::Value;
use std::collections::HashMap;
use std::io;

#[derive(Clone, Copy)]
pub struct Plane<'a> {
    pub raw: &'a [u8],
    pub width: usize,
}
impl Plane<'_> {
    fn get(&self, index: usize) -> u32 {
        let at = index * self.width;
        match self.width {
            1 => self.raw[at] as u32,
            2 => u16::from_le_bytes(self.raw[at..at + 2].try_into().unwrap()) as u32,
            _ => u32::from_le_bytes(self.raw[at..at + 4].try_into().unwrap()),
        }
    }
}

fn invalid() -> io::Error {
    io::Error::other("Invalid thumbnail document")
}
fn integer(v: &Value) -> io::Result<usize> {
    usize::try_from(v.as_u64().ok_or_else(invalid)?).map_err(|_| invalid())
}
fn percent(v: &Value) -> io::Result<f64> {
    let value = v.as_f64().unwrap_or(100.0);
    if !(0.0..=100.0).contains(&value) {
        return Err(invalid());
    }
    Ok(value / 100.0)
}
fn rgba(v: &Value) -> io::Result<u32> {
    let text = v
        .as_str()
        .ok_or_else(invalid)?
        .strip_prefix('#')
        .ok_or_else(invalid)?;
    match text.len() {
        6 => u32::from_str_radix(text, 16)
            .map(|c| c << 8 | 255)
            .map_err(|_| invalid()),
        8 => u32::from_str_radix(text, 16).map_err(|_| invalid()),
        _ => Err(invalid()),
    }
}
struct Layer<'a> {
    id: usize,
    parent: Option<usize>,
    visible: bool,
    group: bool,
    pass: bool,
    opacity: f64,
    mode: String,
    x: i64,
    y: i64,
    w: usize,
    h: usize,
    pixels: Option<Plane<'a>>,
    background: Option<u32>,
}
pub fn thumbnail(
    doc: &Value,
    planes: &HashMap<&str, Plane<'_>>,
    size: u32,
) -> io::Result<Thumbnail> {
    if doc["version"].as_u64().is_some_and(|v| v != 2) {
        return Err(invalid());
    }
    if let Some(features) = doc["requiredFeatures"].as_array() {
        if features.iter().any(|v| {
            !matches!(
                v.as_str(),
                Some(
                    "cel-properties"
                        | "slice-keyframes"
                        | "slices"
                        | "layer-blending"
                        | "layer-groups"
                        | "layer-types"
                        | "linked-cels"
                        | "color-modes"
                        | "indexed-16"
                        | "reference-board"
                        | "tileset"
                )
            )
        }) {
            return Err(invalid());
        }
    }
    let width = integer(&doc["width"])?;
    let height = integer(&doc["height"])?;
    if width == 0 || height == 0 || width > i32::MAX as usize || height > i32::MAX as usize {
        return Err(invalid());
    }
    let raw_layers = doc["layers"].as_array().ok_or_else(invalid)?;
    if raw_layers.is_empty() || raw_layers.len() > 64 {
        return Err(invalid());
    }
    let frame = doc["frames"]
        .as_array()
        .and_then(|f| f.first())
        .ok_or_else(invalid)?;
    let cels = frame["cels"].as_array().ok_or_else(invalid)?;
    if cels.len() != raw_layers.len() {
        return Err(invalid());
    }
    let indexed = doc["colorMode"] == "indexed";
    let palette = if indexed {
        doc["palette"]
            .as_array()
            .ok_or_else(invalid)?
            .iter()
            .map(rgba)
            .collect::<io::Result<Vec<_>>>()?
    } else {
        Vec::new()
    };
    let transparent = if indexed {
        integer(&doc["transparentIndex"])?
    } else {
        0
    };
    if indexed && (transparent >= 65536 || transparent >= palette.len()) {
        return Err(invalid());
    }
    let mut layers = Vec::new();
    for (l, value) in raw_layers.iter().enumerate() {
        let id = integer(&value["id"])?;
        if layers.iter().any(|layer: &Layer| layer.id == id) {
            return Err(invalid());
        }
        let group = value["type"] == "group";
        let reference = value["type"] == "reference";
        let background = if value["type"] == "background" {
            Some(u32::try_from(integer(&value["clearColor"])?).map_err(|_| invalid())?)
        } else {
            None
        };
        let p = &frame["celProperties"][id.to_string()];
        let w = p["width"].as_u64().map(|v| v as usize).unwrap_or(width);
        let h = p["height"].as_u64().map(|v| v as usize).unwrap_or(height);
        let mut pixels = None;
        if !group && !reference {
            let path = format!("/frames/0/{}/{l}", if indexed { "indices" } else { "cels" });
            let plane = *planes.get(path.as_str()).ok_or_else(invalid)?;
            if (indexed && plane.width > 2)
                || (!indexed && plane.width != 4)
                || w == 0
                || h == 0
                || w.checked_mul(h) != Some(plane.raw.len() / plane.width)
            {
                return Err(invalid());
            }
            if indexed {
                for i in 0..plane.raw.len() / plane.width {
                    if plane.get(i) as usize >= palette.len() {
                        return Err(invalid());
                    }
                }
            }
            pixels = Some(plane);
        }
        let mode = value["blendMode"].as_str().unwrap_or("normal");
        if ![
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
        ]
        .contains(&mode)
        {
            return Err(invalid());
        }
        layers.push(Layer {
            id,
            parent: if value["parentId"].is_null() {
                None
            } else {
                Some(integer(&value["parentId"])?)
            },
            visible: value["visible"] != false && !reference,
            group,
            pass: value["passThrough"] == true,
            opacity: percent(&value["opacity"])? * percent(&p["opacity"])?,
            mode: mode.into(),
            x: p["x"].as_i64().unwrap_or(0),
            y: p["y"].as_i64().unwrap_or(0),
            w,
            h,
            pixels,
            background,
        });
    }
    // Every layer must reach a root through group parents. Reject cycles before painting.
    for layer in &layers {
        let mut parent = layer.parent;
        let mut steps = 0;
        while let Some(id) = parent {
            let owner = layers
                .iter()
                .find(|l| l.id == id && l.group)
                .ok_or_else(invalid)?;
            steps += 1;
            if steps > layers.len() {
                return Err(invalid());
            }
            parent = owner.parent;
        }
    }
    let longest = width.max(height) as u64;
    let w = ((size as u64 * width as u64 / longest).max(1)) as u32;
    let h = ((size as u64 * height as u64 / longest).max(1)) as u32;
    let mut output = vec![0; w as usize * h as usize * 4];
    paint(
        &layers,
        None,
        &mut output,
        w as usize,
        h as usize,
        width,
        height,
        if indexed {
            Some((&palette, transparent))
        } else {
            None
        },
    );
    Ok(Thumbnail {
        width: w,
        height: h,
        rgba: output,
    })
}
fn byte(n: f64) -> u8 {
    n.clamp(0.0, 255.0).round_ties_even() as u8
}
fn background(pixel: u32, bg: u32) -> u32 {
    let a = (pixel & 255) as f64 / 255.0;
    let channel = |shift: u32| {
        ((((pixel >> shift) & 255u32) as f64 * a + ((bg >> shift) & 255u32) as f64 * (1.0 - a))
            .round() as u32)
            << shift
    };
    channel(24) | channel(16) | channel(8) | 255
}
fn paint(
    layers: &[Layer<'_>],
    parent: Option<usize>,
    out: &mut [u8],
    w: usize,
    h: usize,
    canvas_w: usize,
    canvas_h: usize,
    indexed: Option<(&[u32], usize)>,
) {
    for layer in layers
        .iter()
        .filter(|l| l.parent == parent && l.visible && l.opacity > 0.0)
    {
        if layer.group && layer.pass {
            paint(
                layers,
                Some(layer.id),
                out,
                w,
                h,
                canvas_w,
                canvas_h,
                indexed,
            );
            continue;
        }
        let mut group = Vec::new();
        if layer.group {
            group.resize(out.len(), 0);
            paint(
                layers,
                Some(layer.id),
                &mut group,
                w,
                h,
                canvas_w,
                canvas_h,
                indexed,
            );
        }
        for y in 0..h {
            for x in 0..w {
                let at = (y * w + x) * 4;
                let mut pixel = if layer.group {
                    u32::from_be_bytes(group[at..at + 4].try_into().unwrap())
                } else {
                    let sx = (x as u64 * canvas_w as u64 / w as u64) as i64 - layer.x;
                    let sy = (y as u64 * canvas_h as u64 / h as u64) as i64 - layer.y;
                    if sx >= 0 && sy >= 0 && (sx as usize) < layer.w && (sy as usize) < layer.h {
                        let pixel = layer
                            .pixels
                            .unwrap()
                            .get(sy as usize * layer.w + sx as usize);
                        if let Some((palette, transparent)) = indexed {
                            if layer.background.is_some() {
                                palette[pixel as usize] | 255
                            } else if pixel as usize == transparent {
                                0
                            } else {
                                palette[pixel as usize]
                            }
                        } else {
                            pixel
                        }
                    } else {
                        0
                    }
                };
                if let Some(bg) = layer.background {
                    pixel = background(pixel, bg);
                }
                let sa = (pixel & 255) as f64 / 255.0 * layer.opacity;
                if sa == 0.0 {
                    continue;
                }
                let da = out[at + 3] as f64 / 255.0;
                let oa = sa + da * (1.0 - sa);
                let s = [
                    (pixel >> 24) as f64 / 255.0,
                    ((pixel >> 16) & 255) as f64 / 255.0,
                    ((pixel >> 8) & 255) as f64 / 255.0,
                ];
                let b = [
                    out[at] as f64 / 255.0,
                    out[at + 1] as f64 / 255.0,
                    out[at + 2] as f64 / 255.0,
                ];
                let mixed = blend(b, s, &layer.mode);
                let weight = if layer.mode == "normal" {
                    0.0
                } else {
                    da + da * sa * (1.0 - da)
                };
                for c in 0..3 {
                    out[at + c] = byte(
                        255.0
                            * (sa * ((1.0 - weight) * s[c] + weight * mixed[c])
                                + (1.0 - sa) * da * b[c])
                            / oa,
                    );
                }
                out[at + 3] = byte(oa * 255.0);
            }
        }
    }
}
fn lum(c: [f64; 3]) -> f64 {
    0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
}
fn sat(c: [f64; 3]) -> f64 {
    c.into_iter().fold(f64::NEG_INFINITY, f64::max) - c.into_iter().fold(f64::INFINITY, f64::min)
}
fn set_lum(c: [f64; 3], l: f64) -> [f64; 3] {
    let d = l - lum(c);
    let mut c = c.map(|v| v + d);
    let l = lum(c);
    let n = c.into_iter().fold(f64::INFINITY, f64::min);
    let x = c.into_iter().fold(f64::NEG_INFINITY, f64::max);
    if n < 0.0 {
        c = c.map(|v| l + (v - l) * l / (l - n));
    }
    if x > 1.0 {
        c = c.map(|v| l + (v - l) * (1.0 - l) / (x - l));
    }
    c
}
fn set_sat(c: [f64; 3], s: f64) -> [f64; 3] {
    let mut order = [0, 1, 2];
    order.sort_by(|&a, &b| c[a].total_cmp(&c[b]));
    let [lo, mid, hi] = order;
    let mut out = [0.0; 3];
    if c[hi] > c[lo] {
        out[mid] = (c[mid] - c[lo]) * s / (c[hi] - c[lo]);
        out[hi] = s;
    }
    out
}
fn hard(b: f64, s: f64) -> f64 {
    if s <= 0.5 {
        2.0 * b * s
    } else {
        1.0 - 2.0 * (1.0 - b) * (1.0 - s)
    }
}
fn blend(b: [f64; 3], s: [f64; 3], mode: &str) -> [f64; 3] {
    match mode {
        "hue" => return set_lum(set_sat(s, sat(b)), lum(b)),
        "saturation" => return set_lum(set_sat(b, sat(s)), lum(b)),
        "color" => return set_lum(s, lum(b)),
        "luminosity" => return set_lum(b, lum(s)),
        _ => {}
    }
    std::array::from_fn(|i| {
        let (b, s) = (b[i], s[i]);
        match mode {
            "multiply" => b * s,
            "screen" => b + s - b * s,
            "overlay" => hard(s, b),
            "darken" => b.min(s),
            "lighten" => b.max(s),
            "color-dodge" => {
                if b == 0.0 {
                    0.0
                } else if s == 1.0 {
                    1.0
                } else {
                    (b / (1.0 - s)).min(1.0)
                }
            }
            "color-burn" => {
                if b == 1.0 {
                    1.0
                } else if s == 0.0 {
                    0.0
                } else {
                    1.0 - ((1.0 - b) / s).min(1.0)
                }
            }
            "hard-light" => hard(b, s),
            "soft-light" => {
                if s <= 0.5 {
                    b - (1.0 - 2.0 * s) * b * (1.0 - b)
                } else {
                    b + (2.0 * s - 1.0)
                        * ((if b <= 0.25 {
                            ((16.0 * b - 12.0) * b + 4.0) * b
                        } else {
                            b.sqrt()
                        }) - b)
                }
            }
            "difference" => (b - s).abs(),
            "exclusion" => b + s - 2.0 * b * s,
            "addition" => (b + s).min(1.0),
            "subtract" => (b - s).max(0.0),
            "divide" => {
                if b == 0.0 {
                    0.0
                } else if s == 0.0 {
                    1.0
                } else {
                    (b / s).min(1.0)
                }
            }
            _ => s,
        }
    })
}
