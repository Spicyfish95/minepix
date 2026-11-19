#![allow(dead_code, unused_imports)]
#[path = "../../src/aseprite.rs"]
mod aseprite;
#[path = "../../src/project.rs"]
mod project;
mod render;
#[cfg(windows)]
mod shell;

// Shell work has its own 64 MiB input/decoded budget. Large documents can still
// open in the editor; an unavailable thumbnail falls back to the file icon.
mod storage {
    pub fn check_size(bytes: u64) -> std::io::Result<()> {
        if bytes > 64 * 1024 * 1024 {
            return Err(std::io::Error::other("Thumbnail input exceeds 64 MiB"));
        }
        Ok(())
    }
}

pub struct Thumbnail {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

pub fn thumbnail(bytes: &[u8], size: u32) -> std::io::Result<Thumbnail> {
    storage::check_size(bytes.len() as u64)?;
    if !(1..=1024).contains(&size) {
        return Err(std::io::Error::other("Invalid thumbnail size"));
    }
    let wire = if bytes.starts_with(b"MINEPIX\0") {
        project::thumbnail_transfer(bytes)?
    } else {
        aseprite::preview_transfer(bytes)?
    };
    let end = 12 + u32::from_le_bytes(wire[8..12].try_into().unwrap()) as usize;
    let metadata: serde_json::Value = serde_json::from_slice(&wire[12..end])?;
    let mut planes = std::collections::HashMap::new();
    let mut offset = end;
    for block in metadata["blocks"]
        .as_array()
        .ok_or_else(|| std::io::Error::other("Missing planes"))?
    {
        let kind = block["kind"].as_str().unwrap_or("");
        let width = match kind {
            "u32" => 4,
            "u16" => 2,
            "u8" | "base64" => 1,
            _ => return Err(std::io::Error::other("Invalid plane")),
        };
        let count = block["count"]
            .as_u64()
            .ok_or_else(|| std::io::Error::other("Invalid count"))? as usize;
        let next = count
            .checked_mul(width)
            .and_then(|n| offset.checked_add(n))
            .filter(|&n| n <= wire.len())
            .ok_or_else(|| std::io::Error::other("Truncated plane"))?;
        if let Some(path) = block["path"].as_str() {
            planes.insert(
                path,
                render::Plane {
                    raw: &wire[offset..next],
                    width,
                },
            );
        }
        offset = next;
    }
    render::thumbnail(&metadata["document"], &planes, size)
}

#[cfg(test)]
mod tests {
    #[test]
    fn oversized_ase_cel_is_rejected_before_decompression_or_allocation() {
        let mut bytes = include_bytes!("../../../tests/fixtures/rgba-linked.aseprite").to_vec();
        let mut offset = 144;
        loop {
            let size = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
            if u16::from_le_bytes(bytes[offset + 4..offset + 6].try_into().unwrap()) == 0x2005 {
                bytes[offset + 22..offset + 26].fill(255);
                break;
            }
            offset += size;
        }
        assert!(super::thumbnail(&bytes, 32).is_err());
    }
}
