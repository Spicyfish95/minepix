//! Native .pix container v1. The JSON object is an internal editor model, not an on-disk format.
use base64::{Engine, engine::general_purpose::STANDARD};
use flate2::{Compression, read::ZlibDecoder, write::ZlibEncoder};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::io::{self, Read, Write};

const MAGIC: &[u8; 8] = b"MINEPIX\0";
const HEADER_SIZE: usize = 32;
const CHUNK_HEADER_SIZE: usize = 20;
const MAX_RAW: usize = 512 * 1024 * 1024;

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[derive(Deserialize, Serialize)]
struct Block {
    path: String,
    kind: String,
    count: usize,
}

fn chunk(kind: &[u8; 4], bytes: &[u8], output: &mut Vec<u8>) -> io::Result<()> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(bytes)?;
    let compressed = encoder.finish()?;
    output.extend_from_slice(kind);
    output.extend_from_slice(&1u32.to_le_bytes());
    output.extend_from_slice(&(compressed.len() as u32).to_le_bytes());
    output.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    output.extend_from_slice(&crc32fast::hash(bytes).to_le_bytes());
    output.extend_from_slice(&compressed);
    Ok(())
}

fn metadata_fields(object: &serde_json::Map<String, Value>, payloads: &[&str]) -> Value {
    Value::Object(
        object.iter().map(|(key, value)| {
            (key.clone(), if payloads.contains(&key.as_str()) { Value::Null } else { value.clone() })
        }).collect(),
    )
}

pub fn encode(document: &Value) -> io::Result<Vec<u8>> {
    if document["format"] != "pixel-studio" {
        return Err(invalid("无效的编辑器文档"));
    }
    let frames = document["frames"]
        .as_array()
        .ok_or_else(|| invalid("项目缺少动画帧"))?;
    let mut metadata = metadata_fields(document.as_object().unwrap(), &["frames", "references"]);
    let mut metadata_frames = Vec::with_capacity(frames.len());
    let mut blocks = Vec::new();
    let mut data_chunks = Vec::new();
    let mut total_raw = 0usize;
    for (frame_index, frame) in frames.iter().enumerate() {
        let mut frame_metadata = metadata_fields(
            frame.as_object().ok_or_else(|| invalid("动画帧不是对象"))?,
            &["cels", "indices"],
        );
        for (field, kind) in [("cels", "u32"), ("indices", "u8")] {
            let Some(cels) = frame.get(field).and_then(Value::as_array) else {
                if let Some(value) = frame.get(field) { frame_metadata[field] = value.clone(); }
                continue;
            };
            let mut placeholders = Vec::with_capacity(cels.len());
            for (layer_index, cel) in cels.iter().enumerate() {
                placeholders.push(Value::Null);
                if cel.is_null() {
                    continue;
                }
                let pixels = cel.as_array().ok_or_else(|| invalid("像素块不是数组"))?;
                let count = pixels.len();
                let mut raw = Vec::with_capacity(count * if kind == "u32" { 4 } else { 1 });
                for pixel in pixels {
                    let value = pixel
                        .as_u64()
                        .ok_or_else(|| invalid("像素值不是无符号整数"))?;
                    if kind == "u32" {
                        raw.extend_from_slice(
                            &u32::try_from(value)
                                .map_err(|_| invalid("RGBA 像素值越界"))?
                                .to_le_bytes(),
                        );
                    } else {
                        raw.push(u8::try_from(value).map_err(|_| invalid("索引像素值越界"))?);
                    }
                }
                total_raw += raw.len();
                if total_raw > MAX_RAW {
                    return Err(invalid("项目解压后超过 512 MiB"));
                }
                blocks.push(Block {
                    path: format!("/frames/{frame_index}/{field}/{layer_index}"),
                    kind: kind.into(),
                    count,
                });
                chunk(b"DATA", &raw, &mut data_chunks)?;
            }
            frame_metadata[field] = Value::Array(placeholders);
        }
        metadata_frames.push(frame_metadata);
    }
    metadata["frames"] = Value::Array(metadata_frames);
    if let Some(references) = document.get("references").and_then(Value::as_array) {
        let mut reference_metadata = Vec::with_capacity(references.len());
        for (index, reference) in references.iter().enumerate() {
            let data = reference["data"]
                .as_str()
                .ok_or_else(|| invalid("参考图片数据无效"))?;
            let raw = STANDARD
                .decode(data)
                .map_err(|_| invalid("参考图片编码无效"))?;
            total_raw += raw.len();
            if total_raw > MAX_RAW {
                return Err(invalid("项目解压后超过 512 MiB"));
            }
            blocks.push(Block {
                path: format!("/references/{index}/data"),
                kind: "base64".into(),
                count: raw.len(),
            });
            chunk(b"DATA", &raw, &mut data_chunks)?;
            reference_metadata.push(metadata_fields(reference.as_object().unwrap(), &["data"]));
        }
        metadata["references"] = Value::Array(reference_metadata);
    } else if let Some(value) = document.get("references") {
        metadata["references"] = value.clone();
    }
    let block_count = blocks.len() + 1;
    let metadata = serde_json::to_vec(&json!({"document": metadata, "blocks": blocks}))?;
    if total_raw + metadata.len() > MAX_RAW {
        return Err(invalid("项目解压后超过 512 MiB"));
    }
    finish(&metadata, &data_chunks, block_count)
}

fn finish(metadata: &[u8], data_chunks: &[u8], block_count: usize) -> io::Result<Vec<u8>> {
    let mut output = vec![0u8; HEADER_SIZE];
    chunk(b"META", metadata, &mut output)?;
    output.extend_from_slice(data_chunks);
    if output.len() > MAX_RAW {
        return Err(invalid("项目文件超过 512 MiB"));
    }
    output[0..8].copy_from_slice(MAGIC);
    output[8..10].copy_from_slice(&1u16.to_le_bytes());
    output[12..16].copy_from_slice(&(HEADER_SIZE as u32).to_le_bytes());
    let length = output.len() as u64;
    output[16..24].copy_from_slice(&length.to_le_bytes());
    output[24..28].copy_from_slice(&(block_count as u32).to_le_bytes());
    let checksum = crc32fast::hash(&output[..28]);
    output[28..32].copy_from_slice(&checksum.to_le_bytes());
    Ok(output)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveMetadata {
    document: Value,
    blocks: Vec<Block>,
    name: String,
    save_as: bool,
}

pub struct PackedSave<'a> {
    metadata: SaveMetadata,
    payload: &'a [u8],
}

impl<'a> PackedSave<'a> {
    pub fn parse(bytes: &'a [u8]) -> io::Result<Self> {
        if bytes.len() < 12 || &bytes[..8] != b"MPXSAVE1" || bytes.len() - 12 > MAX_RAW {
            return Err(invalid("项目保存传输头无效或数据超过 512 MiB"));
        }
        let end = 12 + u32_at(bytes, 8) as usize;
        let metadata: SaveMetadata = serde_json::from_slice(
            bytes.get(12..end).ok_or_else(|| invalid("项目保存元数据截断"))?,
        )?;
        if metadata.document["format"] != "pixel-studio"
            || !metadata.document["frames"].is_array()
        {
            return Err(invalid("不是 MinePix 项目"));
        }
        Ok(Self { metadata, payload: &bytes[end..] })
    }

    pub fn name(&self) -> &str { &self.metadata.name }
    pub fn save_as(&self) -> bool { self.metadata.save_as }

    pub fn encode(&self, name: &str) -> io::Result<Vec<u8>> {
        let mut document = self.metadata.document.clone();
        document["name"] = json!(name);
        let mut cursor = 0usize;
        let mut paths = std::collections::HashSet::new();
        let mut data_chunks = Vec::new();
        for block in &self.metadata.blocks {
            if !paths.insert(&block.path) {
                return Err(invalid("项目块映射重复"));
            }
            let target = document.pointer(&block.path)
                .ok_or_else(|| invalid("项目块映射无效"))?;
            if !target.is_null() { return Err(invalid("项目块覆盖元数据")); }
            let width = match block.kind.as_str() {
                "u32" => 4, "u8" | "base64" => 1,
                _ => return Err(invalid("项目块数据类型无效")),
            };
            let len = block.count.checked_mul(width).ok_or_else(|| invalid("项目块长度溢出"))?;
            let end = cursor.checked_add(len).ok_or_else(|| invalid("项目块长度溢出"))?;
            let raw = self.payload.get(cursor..end).ok_or_else(|| invalid("项目像素数据截断"))?;
            chunk(b"DATA", raw, &mut data_chunks)?;
            cursor = end;
        }
        if cursor != self.payload.len() { return Err(invalid("项目保存包含多余像素数据")); }
        let metadata = serde_json::to_vec(&json!({"document":document,"blocks":self.metadata.blocks}))?;
        if metadata.len() + cursor > MAX_RAW { return Err(invalid("项目解压后超过 512 MiB")); }
        finish(&metadata, &data_chunks, self.metadata.blocks.len() + 1)
    }
}

fn u32_at(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

struct Decoded {
    document: Value,
    blocks: Vec<Block>,
    payloads: Vec<Vec<u8>>,
}

fn decode_parts(bytes: &[u8]) -> io::Result<Decoded> {
    if bytes.len() < HEADER_SIZE || &bytes[..8] != MAGIC {
        return Err(invalid("不是新版 MinePix 二进制项目；不支持旧 JSON .pix"));
    }
    if u16::from_le_bytes(bytes[8..10].try_into().unwrap()) != 1
        || u16::from_le_bytes(bytes[10..12].try_into().unwrap()) != 0
        || u32_at(bytes, 12) != HEADER_SIZE as u32
    {
        return Err(invalid("不支持的项目容器版本或标志"));
    }
    if u32_at(bytes, 28) != crc32fast::hash(&bytes[..28]) {
        return Err(invalid("项目文件头校验失败"));
    }
    let declared_size = u64::from_le_bytes(bytes[16..24].try_into().unwrap());
    if declared_size != bytes.len() as u64 || bytes.len() > MAX_RAW {
        return Err(invalid("项目文件长度不一致"));
    }
    let count = u32_at(bytes, 24) as usize;
    if count == 0 || count > (bytes.len() - HEADER_SIZE) / CHUNK_HEADER_SIZE {
        return Err(invalid("项目分块数量无效"));
    }
    let mut cursor = HEADER_SIZE;
    let mut raw_total = 0usize;
    let mut metadata = None;
    let mut payloads = Vec::new();
    for index in 0..count {
        let header = bytes
            .get(cursor..cursor + CHUNK_HEADER_SIZE)
            .ok_or_else(|| invalid("分块头截断"))?;
        let expected = if index == 0 { b"META" } else { b"DATA" };
        if &header[..4] != expected || u32_at(header, 4) != 1 {
            return Err(invalid("不支持的项目分块或压缩标志"));
        }
        let packed_len = u32_at(header, 8) as usize;
        let raw_len = u32_at(header, 12) as usize;
        raw_total += raw_len;
        if raw_total > MAX_RAW {
            return Err(invalid("项目解压后超过 512 MiB"));
        }
        cursor += CHUNK_HEADER_SIZE;
        let packed = bytes
            .get(cursor..cursor + packed_len)
            .ok_or_else(|| invalid("项目分块截断"))?;
        cursor += packed_len;
        let mut decoder = ZlibDecoder::new(packed);
        let mut raw = Vec::with_capacity(raw_len);
        decoder
            .by_ref()
            .take(raw_len as u64 + 1)
            .read_to_end(&mut raw)?;
        if raw.len() != raw_len
            || decoder.total_in() != packed_len as u64
            || crc32fast::hash(&raw) != u32_at(header, 16)
        {
            return Err(invalid("项目分块校验失败"));
        }
        if index == 0 {
            metadata = Some(serde_json::from_slice::<Value>(&raw)?);
        } else {
            payloads.push(raw);
        }
    }
    if cursor != bytes.len() {
        return Err(invalid("项目文件包含多余数据"));
    }
    let mut metadata = metadata.ok_or_else(|| invalid("项目缺少元数据"))?;
    let blocks: Vec<Block> = serde_json::from_value(metadata["blocks"].take())?;
    if blocks.len() != payloads.len() {
        return Err(invalid("像素块映射数量不一致"));
    }
    let document = metadata["document"].take();
    if document["format"] != "pixel-studio" {
        return Err(invalid("项目元数据无效"));
    }
    let mut targets = std::collections::HashSet::new();
    for (block, raw) in blocks.iter().zip(&payloads) {
        let target = document
            .pointer(&block.path)
            .ok_or_else(|| invalid("项目块映射无效"))?;
        if !targets.insert(target as *const Value) {
            return Err(invalid("项目块映射重复"));
        }
        if !target.is_null() {
            return Err(invalid("项目块覆盖元数据"));
        }
        let valid = match block.kind.as_str() {
            "u32" => block.count.checked_mul(4) == Some(raw.len()),
            "u8" | "base64" => block.count == raw.len(),
            _ => false,
        };
        if !valid { return Err(invalid("项目块数据长度或类型无效")); }
    }
    Ok(Decoded { document, blocks, payloads })
}

pub fn read_transfer(bytes: &[u8]) -> io::Result<Vec<u8>> {
    let decoded = decode_parts(bytes)?;
    let metadata = serde_json::to_vec(&json!({"document":decoded.document,"blocks":decoded.blocks}))?;
    let mut output = Vec::with_capacity(12 + metadata.len() + decoded.payloads.iter().map(Vec::len).sum::<usize>());
    output.extend_from_slice(b"MPXREAD1");
    output.extend_from_slice(&(metadata.len() as u32).to_le_bytes());
    output.extend_from_slice(&metadata);
    for raw in decoded.payloads { output.extend_from_slice(&raw); }
    Ok(output)
}

pub fn decode(bytes: &[u8]) -> io::Result<Value> {
    let Decoded { mut document, blocks, payloads } = decode_parts(bytes)?;
    for (block, raw) in blocks.into_iter().zip(payloads) {
        let target = document.pointer_mut(&block.path).unwrap();
        *target = match block.kind.as_str() {
            "u32" => Value::Array(
                raw.chunks_exact(4)
                    .map(|bytes| json!(u32::from_le_bytes(bytes.try_into().unwrap())))
                    .collect(),
            ),
            "u8" => json!(raw),
            "base64" => json!(STANDARD.encode(raw)),
            _ => unreachable!("validated block kind"),
        };
    }
    Ok(document)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_read_preserves_metadata_and_exact_payload_bytes() {
        let document: Value = serde_json::from_slice(include_bytes!("../../tests/fixtures/project-transfer/fixture.json")).unwrap();
        let bytes = encode(&document).unwrap();
        let decoded = decode_parts(&bytes).unwrap();
        let wire = read_transfer(&bytes).unwrap();
        assert_eq!(&wire[..8], b"MPXREAD1");
        let end = 12 + u32_at(&wire, 8) as usize;
        let metadata: Value = serde_json::from_slice(&wire[12..end]).unwrap();
        assert_eq!(metadata["document"], decoded.document);
        assert_eq!(metadata["blocks"], serde_json::to_value(&decoded.blocks).unwrap());
        assert_eq!(&wire[end..], decoded.payloads.concat());
        assert_eq!(decode(&bytes).unwrap(), document);
        assert_eq!(metadata["document"]["custom"], document["custom"]);
    }

    #[test]
    fn raw_read_rejects_duplicate_alias_overwrite_and_invalid_payload_mapping() {
        let base = json!({"document":{"format":"pixel-studio","frames":[{"cels":[null]}],"custom":{"~":null}},"blocks":[{"path":"/frames/0/cels/0","kind":"u32","count":1}]});
        let mut cases = Vec::new();
        for (key,value) in [("path",json!("/missing")),("path",json!("/document")),("path",json!("/format")),("kind",json!("u64")),("count",json!(2)),("count",json!(u64::MAX))] {
            let mut invalid = base.clone();invalid["blocks"][0][key]=value;cases.push((invalid,1));
        }
        let mut duplicate = base.clone();duplicate["blocks"].as_array_mut().unwrap().push(base["blocks"][0].clone());cases.push((duplicate,2));
        let mut alias = base.clone();alias["blocks"][0]["path"]=json!("/custom/~");
        let mut second = alias["blocks"][0].clone();second["path"]=json!("/custom/~0");
        alias["blocks"].as_array_mut().unwrap().push(second);cases.push((alias,2));
        cases.push((base.clone(),0));
        for (metadata,count) in cases {
            let mut data = Vec::new();for _ in 0..count { chunk(b"DATA", &[1,2,3,4], &mut data).unwrap(); }
            let bytes=finish(&serde_json::to_vec(&metadata).unwrap(),&data,count+1).unwrap();
            assert!(decode(&bytes).is_err());assert!(read_transfer(&bytes).is_err());
        }
    }

    #[test]
    fn packed_javascript_fixture_is_byte_identical_to_value_encoder() {
        let packed = PackedSave::parse(include_bytes!("../../tests/fixtures/project-transfer/fixture.bin")).unwrap();
        assert_eq!(packed.name(), "中文 名称");
        assert!(packed.save_as());
        let mut document: Value = serde_json::from_slice(include_bytes!("../../tests/fixtures/project-transfer/fixture.json")).unwrap();
        document["name"] = json!("目标名称");
        let output = packed.encode("目标名称").unwrap();
        assert_eq!(output, encode(&document).unwrap());
        assert_eq!(decode(&output).unwrap(), document);
    }

    #[test]
    fn packed_rejects_truncation_invalid_lengths_and_mapping_overwrites() {
        let metadata = json!({"document":{"format":"pixel-studio","frames":[{"cels":[null]}]},"blocks":[{"path":"/frames/0/cels/0","kind":"u32","count":1}],"name":"test","saveAs":false});
        fn wire(metadata: &Value, payload: &[u8]) -> Vec<u8> {
            let json = serde_json::to_vec(metadata).unwrap();
            [b"MPXSAVE1".as_slice(), &(json.len() as u32).to_le_bytes(), &json, payload].concat()
        }
        let bytes = wire(&metadata, &[1,2,3,4]);
        assert!(PackedSave::parse(&bytes).unwrap().encode("test").is_ok());
        for length in [0,7,11] { assert!(PackedSave::parse(&bytes[..length]).is_err()); }
        let mut header = bytes.clone();header[8..12].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(PackedSave::parse(&header).is_err());
        assert!(PackedSave::parse(&bytes[..bytes.len()-1]).unwrap().encode("test").is_err());
        let mut extra = bytes.clone();extra.push(0);
        assert!(PackedSave::parse(&extra).unwrap().encode("test").is_err());
        for (key, value) in [("kind",json!("u64")),("count",json!(u64::MAX)),("path",json!("/missing")),("path",json!("/name"))] {
            let mut invalid = metadata.clone();invalid["document"]["name"]=json!("保留");invalid["blocks"][0][key]=value;
            assert!(PackedSave::parse(&wire(&invalid,&[1,2,3,4])).unwrap().encode("test").is_err());
        }
        let mut duplicate = metadata.clone();duplicate["blocks"].as_array_mut().unwrap().push(metadata["blocks"][0].clone());
        assert!(PackedSave::parse(&wire(&duplicate,&[1,2,3,4,5,6,7,8])).unwrap().encode("test").is_err());
    }

    #[test]
    fn binary_roundtrip_preserves_animation_pixels_indices_references_and_metadata() {
        let document = json!({
            "format":"pixel-studio","version":2,"width":2,"height":1,
            "layers":[{"id":1,"name":"图层","opacity":100,"blendMode":"multiply"}],
            "frames":[{"duration":80,"cels":[[0x11223344u32,0xffffffffu32]],"indices":[[0,255]],"links":{}},
                      {"duration":120,"cels":[[0,0xdeadbeefu32]],"celProperties":{"1":{"x":1,"y":0}}}],
            "references":[{"id":"ref","data":STANDARD.encode([1,2,3,4,5,6,7,8]),"x":5,"scale":1.5}],
            "tags":[{"name":"Walk","from":0,"to":1}],"palette":["#11223344","#ffffffff"]
        });
        let bytes = encode(&document).unwrap();
        assert_eq!(&bytes[..8], MAGIC);
        assert_eq!(decode(&bytes).unwrap(), document);
    }

    #[test]
    fn binary_rejects_json_truncation_corruption_and_unknown_version() {
        let document = json!({"format":"pixel-studio","frames":[{"cels":[[1,2,3]]}]});
        let bytes = encode(&document).unwrap();
        assert!(decode(&serde_json::to_vec(&document).unwrap()).is_err());
        assert!(read_transfer(&serde_json::to_vec(&document).unwrap()).is_err());
        for length in [0, 7, 31, bytes.len() - 1] {
            assert!(decode(&bytes[..length]).is_err());
            assert!(read_transfer(&bytes[..length]).is_err());
        }
        let mut corrupted = bytes.clone();
        *corrupted.last_mut().unwrap() ^= 0xff;
        assert!(decode(&corrupted).is_err());
        assert!(read_transfer(&corrupted).is_err());
        let mut future = bytes;
        future[8] = 2;
        assert!(decode(&future).is_err());
        assert!(read_transfer(&future).is_err());
    }

    #[test]
    fn binary_compresses_repeated_pixels_without_json_pixel_arrays() {
        let document =
            json!({"format":"pixel-studio","frames":[{"cels":[vec![0xff8844ffu32;65536]]}]});
        let bytes = encode(&document).unwrap();
        assert!(bytes.len() < serde_json::to_vec(&document).unwrap().len() / 20);
        assert_eq!(decode(&bytes).unwrap(), document);
    }

    #[test]
    fn binary_encoding_preserves_optional_payloads_unknown_fields_and_source() {
        for document in [
            json!({"format":"pixel-studio","frames":[{"cels":[null,[],[0,u32::MAX]],"indices":[null,[],[0,255]],"custom":{"cels":[4,5],"data":"保留"}}],"references":[{"id":"empty","data":"","note":"中文"}],"custom":{"frames":[1,2],"references":"保留"}}),
            json!({"format":"pixel-studio","frames":[{"cels":null,"indices":[]}],"references":null}),
            json!({"format":"pixel-studio","frames":[]}),
        ] {
            let original = document.clone();
            let bytes = encode(&document).unwrap();
            assert_eq!(document, original);
            assert_eq!(decode(&bytes).unwrap(), original);
        }
    }

    #[test]
    fn binary_encoder_rejects_invalid_pixels_and_references_without_mutation() {
        for (field, value) in [
            ("cels", json!(-1)),
            ("cels", json!(4294967296u64)),
            ("cels", json!(1.5)),
            ("cels", Value::Null),
            ("cels", json!("1")),
            ("indices", json!(256)),
            ("indices", json!(-1)),
        ] {
            let mut document = json!({"format":"pixel-studio","frames":[{}]});
            document["frames"][0][field] = json!([[value]]);
            let original = document.clone();
            assert!(encode(&document).is_err(), "{field}");
            assert_eq!(document, original);
        }
        for data in [Value::Null, json!("%%%"), json!(42)] {
            let document = json!({"format":"pixel-studio","frames":[],"references":[{"data":data}]});
            assert!(encode(&document).is_err());
        }
        assert!(encode(&json!({"format":"pixel-studio","frames":[null]})).is_err());
    }
}
