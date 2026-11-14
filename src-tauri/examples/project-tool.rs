use minepix_backend::project;
use serde_json::Value;
use std::{fs, io, time::Instant};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match arguments.first().map(String::as_str) {
        Some("encode") if arguments.len()==3=>{
            let document:Value=serde_json::from_slice(&fs::read(&arguments[1])?)?;
            let bytes=project::encode(&document)?;
            fs::write(&arguments[2],&bytes)?;
            println!("{} bytes: {}",bytes.len(),arguments[2]);
        }
        Some("ase-export") if arguments.len() == 3 => {
            let document: Value = serde_json::from_slice(&fs::read(&arguments[1])?)?;
            fs::write(&arguments[2], minepix_backend::aseprite::encode(&document)?)?;
        }
        Some("ase-import") if arguments.len() == 3 => {
            let imported = minepix_backend::aseprite::decode(&fs::read(&arguments[1])?, &arguments[1])?;
            fs::write(&arguments[2], serde_json::to_vec(&imported)?)?;
        }
        Some("inspect") if arguments.len()==2=>{
            let document=project::decode(&fs::read(&arguments[1])?)?;
            println!("{}",serde_json::to_string_pretty(&serde_json::json!({"name":document["name"],"width":document["width"],"height":document["height"],"frames":document["frames"].as_array().map(Vec::len),"layers":document["layers"].as_array().map(Vec::len)}))?);
        }
        Some("read-transfer") if arguments.len()==3=>{
            fs::write(&arguments[2],project::read_transfer(&fs::read(&arguments[1])?)?)?;
        }
        Some("bench") if arguments.len()==2=>{
            let document:Value=serde_json::from_slice(&fs::read(&arguments[1])?)?;
            let json_bytes=serde_json::to_vec(&document)?;
            let bytes=project::encode(&document)?;
            assert_eq!(project::decode(&bytes)?,document);
            let count=30;
            let started=Instant::now();
            for _ in 0..count{std::hint::black_box(project::encode(std::hint::black_box(&document))?);}
            let encode_ms=started.elapsed().as_secs_f64()*1000.0/f64::from(count);
            let started=Instant::now();
            for _ in 0..count{std::hint::black_box(project::decode(std::hint::black_box(&bytes))?);}
            let decode_ms=started.elapsed().as_secs_f64()*1000.0/f64::from(count);
            println!("{}",serde_json::to_string_pretty(&serde_json::json!({"profile":if cfg!(debug_assertions){"debug"}else{"release"},"iterations":count,"json_bytes":json_bytes.len(),"binary_bytes":bytes.len(),"ratio":bytes.len()as f64/json_bytes.len()as f64,"encode_ms":encode_ms,"decode_ms":decode_ms}))?);
        }
        Some("profile") if arguments.len() == 2 => {
            let input = fs::read(&arguments[1])?;
            let mut samples = Vec::new();
            for iteration in 0..4 {
                let started = Instant::now();
                let document: Value = serde_json::from_slice(&input)?;
                let parse_ms = started.elapsed().as_secs_f64() * 1000.0;
                let started = Instant::now();
                let bytes = project::encode(&document)?;
                let encode_ms = started.elapsed().as_secs_f64() * 1000.0;
                let started = Instant::now();
                let restored = project::decode(&bytes)?;
                let decode_ms = started.elapsed().as_secs_f64() * 1000.0;
                let started = Instant::now();
                let json = serde_json::to_vec(&restored)?;
                let serialize_ms = started.elapsed().as_secs_f64() * 1000.0;
                assert_eq!(restored, document);
                if iteration > 0 {
                    samples.push(serde_json::json!({"parseMs":parse_ms,"encodeMs":encode_ms,"decodeMs":decode_ms,"serializeMs":serialize_ms,"binaryBytes":bytes.len(),"jsonBytes":json.len()}));
                }
            }
            println!("{}", serde_json::to_string_pretty(&serde_json::json!({"profile":if cfg!(debug_assertions){"debug"}else{"release"},"warmups":1,"samples":samples}))?);
        }
        _=>return Err(io::Error::new(io::ErrorKind::InvalidInput,"project-tool encode <memory-model.json> <output.pix> | inspect <file.pix> | read-transfer <file.pix> <output.bin> | bench <memory-model.json> | profile <memory-model.json>").into())
    }
    Ok(())
}
