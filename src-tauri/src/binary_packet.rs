use serde_json::{Value, json};
use std::io;

const MAX_BYTES: usize = 512 * 1024 * 1024;
fn invalid(message: &str) -> io::Error { io::Error::new(io::ErrorKind::InvalidData, message) }
pub struct Packet<'a> { pub metadata: Value, pub payloads: Vec<&'a [u8]> }
impl<'a> Packet<'a> {
    pub fn parse(bytes: &'a [u8]) -> io::Result<Self> {
        if bytes.len() < 12 || bytes.len()-12 > MAX_BYTES || &bytes[..8] != b"MPXDATA1" { return Err(invalid("二进制传输头无效")); }
        let end = 12 + u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
        let mut header: Value = serde_json::from_slice(bytes.get(12..end).ok_or_else(|| invalid("二进制元数据截断"))?)?;
        let lengths = header["lengths"].as_array().ok_or_else(|| invalid("二进制块列表无效"))?;
        let mut cursor=end;let mut payloads=Vec::with_capacity(lengths.len());
        for length in lengths {
            let length=length.as_u64().and_then(|value|usize::try_from(value).ok()).ok_or_else(||invalid("二进制块长度无效"))?;
            let end=cursor.checked_add(length).ok_or_else(||invalid("二进制块长度溢出"))?;
            payloads.push(bytes.get(cursor..end).ok_or_else(||invalid("二进制块截断"))?);cursor=end;
        }
        if cursor!=bytes.len(){return Err(invalid("二进制传输包含多余数据"));}
        Ok(Self{metadata:header["metadata"].take(),payloads})
    }
}
pub fn encode(metadata: Value, payloads: &[&[u8]]) -> io::Result<Vec<u8>> {
    let header=serde_json::to_vec(&json!({"metadata":metadata,"lengths":payloads.iter().map(|part|part.len()).collect::<Vec<_>>()}))?;
    let size=payloads.iter().try_fold(header.len(),|sum,part|sum.checked_add(part.len()).filter(|&n|n<=MAX_BYTES)).ok_or_else(||invalid("二进制传输超过 512 MiB"))?;
    if size>MAX_BYTES{return Err(invalid("二进制传输超过 512 MiB"));}
    let mut bytes=Vec::with_capacity(12+size);bytes.extend_from_slice(b"MPXDATA1");bytes.extend_from_slice(&(header.len() as u32).to_le_bytes());bytes.extend_from_slice(&header);
    for part in payloads{bytes.extend_from_slice(part);}Ok(bytes)
}
