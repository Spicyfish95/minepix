use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, path::{Path, PathBuf}};
use tauri_plugin_updater::Update;

const MIN_BLOCK: usize = 2048;
const MAX_BLOCK: usize = 32768;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Block { pub offset: usize, pub size: usize, pub sha256: String }

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Blockmap {
    pub format: String,
    pub version: String,
    pub url: String,
    pub size: usize,
    pub sha256: String,
    pub chunks: Vec<Block>,
}

#[derive(Default, Clone, Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Transfer {
    pub mode: &'static str,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub reused_bytes: u64,
    pub fallback_reason: Option<String>,
    pub cache_error: Option<String>,
}

pub fn sha256(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }

pub fn chunks(bytes: &[u8]) -> Vec<Block> {
    let mut gear=[0u32;256];let mut seed=0x12345678u32;
    for value in &mut gear { seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;*value=seed; }
    let mut blocks=Vec::new();let mut offset=0;let mut hash=0u32;
    for (i,byte) in bytes.iter().enumerate() {
        hash=hash.wrapping_shl(1).wrapping_add(gear[*byte as usize]);let size=i+1-offset;
        if size>=MIN_BLOCK && (hash&8191==0 || size==MAX_BLOCK) {
            blocks.push(Block {offset,size,sha256:sha256(&bytes[offset..i+1])});offset=i+1;hash=0;
        }
    }
    if offset<bytes.len() { blocks.push(Block {offset,size:bytes.len()-offset,sha256:sha256(&bytes[offset..])}); }
    blocks
}

impl Blockmap {
    fn validate(&self, update: &Update) -> Result<(), String> {
        if self.format!="minepix-blockmap-v1" || self.version!=update.version
            || tauri::Url::parse(&self.url).map_err(|e|e.to_string())?!=update.download_url
            || self.size==0 || self.size as u64>crate::storage::MAX_FILE_BYTES
            || self.chunks.is_empty() || self.chunks.len()>self.size/MIN_BLOCK+1 {
            return Err("差分块图版本、地址或大小无效".into());
        }
        let valid_hash=|value:&str|value.len()==64&&value.bytes().all(|byte|byte.is_ascii_hexdigit());
        if !valid_hash(&self.sha256) { return Err("差分安装包摘要无效".into()); }
        let mut offset=0usize;
        for (i,block) in self.chunks.iter().enumerate() {
            if block.offset!=offset || block.size==0 || block.size>MAX_BLOCK
                || (i+1<self.chunks.len()&&block.size<MIN_BLOCK) || !valid_hash(&block.sha256) {
                return Err("差分块图范围或摘要无效".into());
            }
            offset=offset.checked_add(block.size).ok_or("差分块图长度溢出")?;
            if offset>self.size { return Err("差分块图超出安装包".into()); }
        }
        if offset!=self.size { return Err("差分块图长度不一致".into()); }
        Ok(())
    }
}

enum Part { Reuse { offset: usize, size: usize }, Fetch { offset: usize, size: usize } }

fn plan(map: &Blockmap, base: &[u8]) -> (Vec<Part>,u64) {
    let known:HashMap<_,_>=chunks(base).into_iter().map(|block|((block.sha256,block.size),block.offset)).collect();
    let mut parts=Vec::new();let mut reused=0u64;
    for block in &map.chunks {
        if let Some(offset)=known.get(&(block.sha256.clone(),block.size)) {
            parts.push(Part::Reuse {offset:*offset,size:block.size});reused+=block.size as u64;
        } else if let Some(Part::Fetch {size,..})=parts.last_mut() { *size+=block.size; }
        else { parts.push(Part::Fetch {offset:block.offset,size:block.size}); }
    }
    (parts,reused)
}

pub fn cache_path(root: &Path) -> PathBuf { root.join("update-cache").join("base.exe") }

pub fn cache_verified(root: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let path=cache_path(root);
    std::fs::create_dir_all(path.parent().unwrap())?;
    crate::storage::write_atomic(&path,bytes)
}

async fn differential(
    update: &Update, map: &Blockmap, base: &[u8], stats: &mut Transfer,
    report: &mut impl FnMut(&Transfer),
) -> Result<Option<Vec<u8>>,String> {
    let (parts,reused)=plan(map,base);
    if reused==0 { return Ok(None); }
    let url=&update.download_url;
    if url.scheme()!="https" && !(url.scheme()=="http"&&matches!(url.host_str(),Some("127.0.0.1"|"localhost"|"[::1]"))) {
        return Err("差分下载只允许HTTPS或本机回环验证".into());
    }
    stats.mode="differential";stats.reused_bytes=reused;stats.total_bytes=Some(map.size as u64-reused);report(stats);
    let mut client=reqwest::Client::builder().https_only(url.scheme()=="https")
        .timeout(update.timeout.unwrap_or(std::time::Duration::from_secs(120)));
    if update.no_proxy { client=client.no_proxy(); }
    else if let Some(proxy)=&update.proxy { client=client.proxy(reqwest::Proxy::all(proxy.as_str()).map_err(|e|e.to_string())?); }
    let client=client.build().map_err(|e|e.to_string())?;
    let mut output=Vec::with_capacity(map.size);
    for part in parts {
        match part {
            Part::Reuse {offset,size}=>output.extend_from_slice(&base[offset..offset+size]),
            Part::Fetch {offset,size}=>{
                let end=offset+size-1;
                let mut response=client.get(url.clone()).headers(update.headers.clone())
                    .header(reqwest::header::RANGE,format!("bytes={offset}-{end}"))
                    .header(reqwest::header::ACCEPT_ENCODING,"identity").send().await.map_err(|e|e.to_string())?;
                let expected=format!("bytes {offset}-{end}/{}",map.size);
                if response.status()!=reqwest::StatusCode::PARTIAL_CONTENT
                    || response.headers().get(reqwest::header::CONTENT_RANGE).and_then(|value|value.to_str().ok())!=Some(expected.as_str()) {
                    return Err("服务器未返回正确的HTTP范围响应".into());
                }
                let start=output.len();
                while let Some(chunk)=response.chunk().await.map_err(|e|e.to_string())? {
                    stats.downloaded_bytes+=chunk.len() as u64;report(stats);
                    if output.len()-start+chunk.len()>size { return Err("差分区间数据过长".into()); }
                    output.extend_from_slice(&chunk);
                }
                if output.len()-start!=size { return Err("差分区间数据截断".into()); }
            }
        }
    }
    if sha256(&output)!=map.sha256 { return Err("差分重建安装包摘要不符".into()); }
    update.verify(&output).map_err(|e|e.to_string())?;
    Ok(Some(output))
}

pub async fn download(
    update: &Update, root: &Path, mut report: impl FnMut(&Transfer),
) -> Result<(Vec<u8>,Transfer),String> {
    let mut stats=Transfer {mode:"full",..Transfer::default()};
    if let Some(value)=update.raw_json.get("minepixBlockmap") {
        let attempt=async {
            let map:Blockmap=serde_json::from_value(value.clone()).map_err(|e|e.to_string())?;
            map.validate(update)?;
            let path=cache_path(root);
            let base=match crate::storage::read_file(&path) {
                Ok(bytes)=>bytes,
                Err(error) if error.kind()==std::io::ErrorKind::NotFound=>return Ok(None),
                Err(error)=>return Err(format!("无法读取差分缓存：{error}")),
            };
            differential(update,&map,&base,&mut stats,&mut report).await
        }.await;
        match attempt {
            Ok(Some(bytes))=>return Ok((bytes,stats)),
            Ok(None)=>{},
            Err(error)=>{ stats.mode="full-fallback";stats.reused_bytes=0;stats.total_bytes=None;stats.fallback_reason=Some(error); },
        }
    }
    let previous=stats.downloaded_bytes;report(&stats);
    let bytes=update.download(|chunk,total|{
        stats.downloaded_bytes+=chunk as u64;
        stats.total_bytes=total.map(|size|size+previous);report(&stats);
    },||{}).await.map_err(|e|e.to_string())?;
    crate::storage::check_size(bytes.len() as u64).map_err(|e|e.to_string())?;
    Ok((bytes,stats))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::{Value,json};
    use std::{io::{Read,Write},net::TcpListener,sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},thread,time::Duration};
    use tauri_plugin_updater::UpdaterExt;

    pub(crate) const TARGET:&[u8]=include_bytes!("../../tests/fixtures/updater-differential.bin");
    pub(crate) fn base()->Vec<u8>{let mut bytes=TARGET.to_vec();bytes[100]^=0xff;bytes}
    fn map(bytes:&[u8],url:&str)->Blockmap { Blockmap {format:"minepix-blockmap-v1".into(),version:"2.0.0-alpha.2".into(),url:url.into(),size:bytes.len(),sha256:sha256(bytes),chunks:chunks(bytes)} }

    #[derive(Default,Clone,Debug)]
    pub(crate) struct Traffic { pub ranges:usize,pub full:usize,pub payload_bytes:usize }
    pub(crate) struct Feed {
        pub endpoint:String,pub manifest:Value,pub traffic:Arc<Mutex<Traffic>>,
        stop:Arc<AtomicBool>,server:Option<thread::JoinHandle<()>>,
    }
    impl Drop for Feed { fn drop(&mut self){self.stop.store(true,Ordering::Relaxed);if let Some(server)=self.server.take(){server.join().unwrap();}} }
    pub(crate) fn feed(mode:&str)->Feed {
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();listener.set_nonblocking(true).unwrap();
        let endpoint=format!("http://{}/manifest",listener.local_addr().unwrap());let url=format!("http://{}/payload",listener.local_addr().unwrap());
        let signature=include_str!("../../tests/fixtures/updater-differential.bin.sig").trim();
        let mut manifest=json!({"version":"2.0.0-alpha.2","platforms":{"windows-x86_64":{"url":url,"signature":signature}},"minepixBlockmap":map(TARGET,&url)});
        match mode {
            "bad-map"=>manifest["minepixBlockmap"]["chunks"][0]["offset"]=json!(1),
            "bad-hash"=>manifest["minepixBlockmap"]["sha256"]=json!("0".repeat(64)),
            "version"=>{manifest["version"]=json!("3.0.0");manifest["minepixBlockmap"]["version"]=json!("3.0.0");},
            _=>{},
        }
        let body=serde_json::to_vec(&manifest).unwrap();let mode=mode.to_owned();
        let traffic=Arc::new(Mutex::new(Traffic::default()));let requests=traffic.clone();let stop=Arc::new(AtomicBool::new(false));let stopped=stop.clone();
        let server=thread::spawn(move||{
            while !stopped.load(Ordering::Relaxed) {
                let (mut stream,_)=match listener.accept(){Ok(value)=>value,Err(error) if error.kind()==std::io::ErrorKind::WouldBlock=>{thread::sleep(Duration::from_millis(2));continue;},Err(error)=>panic!("{error}")};
                stream.set_nonblocking(false).unwrap();
                stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();let mut request=Vec::new();
                while !request.windows(4).any(|bytes|bytes==b"\r\n\r\n") {let mut bytes=[0;1024];let count=stream.read(&mut bytes).unwrap_or(0);if count==0{break;}request.extend_from_slice(&bytes[..count]);assert!(request.len()<16384);}
                if request.is_empty(){continue;}
                let request=String::from_utf8(request).unwrap().to_lowercase();
                if request.starts_with("get /manifest ") {let _=write!(stream,"HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len());let _=stream.write_all(&body);continue;}
                let range=request.lines().find_map(|line|line.strip_prefix("range: bytes="));
                let mut data=TARGET.to_vec();if mode=="bad-signature"{data[0]^=1;}
                let (status,header,mut payload)=if let Some(range)=range {
                    requests.lock().unwrap().ranges+=1;
                    let (start,end)=range.split_once('-').unwrap();let start:usize=start.parse().unwrap();let end:usize=end.parse().unwrap();
                    if mode=="ignore-range" {("200 OK",String::new(),data)}
                    else {("206 Partial Content",format!("Content-Range: bytes {}-{end}/{}\r\n",if mode=="wrong-range"{start+1}else{start},data.len()),data[start..=end].to_vec())}
                } else {requests.lock().unwrap().full+=1;("200 OK",String::new(),data)};
                if range.is_some()&&mode=="corrupt-range"{payload[0]^=1;}
                let declared=payload.len();if range.is_some()&&mode=="truncated"{payload.truncate(payload.len()/2);}
                if write!(stream,"HTTP/1.1 {status}\r\n{header}Content-Length: {declared}\r\nConnection: close\r\n\r\n").is_err(){continue;}
                if mode=="slow" {
                    for bytes in payload.chunks(256) {
                        thread::sleep(Duration::from_millis(3));
                        if stream.write_all(bytes).is_err(){break;}
                        requests.lock().unwrap().payload_bytes+=bytes.len();
                    }
                } else if stream.write_all(&payload).is_ok(){requests.lock().unwrap().payload_bytes+=payload.len();}
            }
        });
        Feed {endpoint,manifest,traffic,stop,server:Some(server)}
    }
    pub(crate) fn app(endpoint:&str)->tauri::App<tauri::test::MockRuntime>{
        let production:Value=serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let mut context=tauri::test::mock_context(tauri::test::noop_assets());
        context.config_mut().plugins.0.insert("updater".into(),json!({"pubkey":production["plugins"]["updater"]["pubkey"],"endpoints":[endpoint],"requireSignedVersion":true,"dangerousInsecureTransportProtocol":true}));
        tauri::test::mock_builder().plugin(tauri_plugin_updater::Builder::new().build()).build(context).unwrap()
    }
    fn update(feed:&Feed)->Update{app(&feed.endpoint).updater().unwrap().restore_update(feed.manifest.clone()).unwrap().unwrap()}

    #[test]
    fn node_blockmap_fixture_matches_rust_and_insertion_resynchronizes(){
        let fixture:Value=serde_json::from_str(include_str!("../../tests/fixtures/update-blockmap.json")).unwrap();
        let mut seed=fixture["seed"].as_u64().unwrap() as u32;let mut bytes=vec![0;fixture["length"].as_u64().unwrap()as usize];
        for byte in &mut bytes{seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;*byte=seed as u8;}
        let map:Blockmap=serde_json::from_value(fixture["map"].clone()).unwrap();
        assert_eq!(chunks(&bytes),map.chunks);assert_eq!(sha256(&bytes),map.sha256);assert!(chunks(&[]).is_empty());
        let mut changed=bytes.clone();changed.splice(10000..10000,b"new content".iter().copied());
        let (_,reused)=plan(&map,&changed);assert!(reused>bytes.len()as u64/2);
    }

    #[test]
    fn invalid_maps_are_rejected_and_plan_reuses_verified_local_blocks(){
        let feed=feed("normal");let update=update(&feed);let valid=map(TARGET,update.download_url.as_str());valid.validate(&update).unwrap();
        let (_,reused)=plan(&valid,&base());assert!(reused>0&&reused<TARGET.len()as u64);
        for invalid in [json!({"format":"other"}),json!({"version":"9.0.0"}),json!({"url":"https://other.test/payload"}),json!({"size":0}),json!({"size":u64::MAX}),json!({"sha256":"bad"})] {
            let mut value=serde_json::to_value(&valid).unwrap();for(key,value_to_set)in invalid.as_object().unwrap(){value[key]=value_to_set.clone();}
            let invalid=serde_json::from_value::<Blockmap>(value);assert!(invalid.is_err()||invalid.unwrap().validate(&update).is_err());
        }
        for field in ["offset","size","sha256"] {let mut value=serde_json::to_value(&valid).unwrap();value["chunks"][0][field]=if field=="sha256"{json!("bad")}else{json!(usize::MAX)};assert!(serde_json::from_value::<Blockmap>(value).unwrap().validate(&update).is_err());}
    }

    #[test]
    fn signed_range_download_reconstructs_exact_target_and_saves_bandwidth(){
        let feed=feed("normal");let root=tempfile::tempdir().unwrap();cache_verified(root.path(),&base()).unwrap();
        let (bytes,stats)=tauri::async_runtime::block_on(download(&update(&feed),root.path(),|_|{})).unwrap();
        assert_eq!(bytes,TARGET);assert_eq!(stats.mode,"differential");assert!(stats.downloaded_bytes<TARGET.len()as u64);assert_eq!(stats.downloaded_bytes+stats.reused_bytes,TARGET.len()as u64);
        let traffic=feed.traffic.lock().unwrap();assert_eq!(traffic.full,0);assert!(traffic.ranges>0);assert_eq!(traffic.payload_bytes as u64,stats.downloaded_bytes);
        assert_eq!(crate::storage::read_file(&cache_path(root.path())).unwrap(),base(),"传输本身不在最终成功前替换缓存");
    }

    #[test]
    fn missing_cache_and_zero_matches_use_signed_full_download(){
        for cached in [None,Some(vec![0;TARGET.len()])] {
            let feed=feed("normal");let root=tempfile::tempdir().unwrap();if let Some(bytes)=cached{cache_verified(root.path(),&bytes).unwrap();}
            let (bytes,stats)=tauri::async_runtime::block_on(download(&update(&feed),root.path(),|_|{})).unwrap();assert_eq!(bytes,TARGET);assert_eq!(stats.mode,"full");assert_eq!(stats.downloaded_bytes,TARGET.len()as u64);assert_eq!(feed.traffic.lock().unwrap().ranges,0);
        }
    }

    #[test]
    fn invalid_ranges_maps_and_reconstruction_fall_back_to_signed_full_package(){
        for mode in ["ignore-range","wrong-range","truncated","corrupt-range","bad-map","bad-hash"] {
            let feed=feed(mode);let root=tempfile::tempdir().unwrap();cache_verified(root.path(),&base()).unwrap();
            let (bytes,stats)=tauri::async_runtime::block_on(download(&update(&feed),root.path(),|_|{})).unwrap();
            assert_eq!(bytes,TARGET,"{mode}");assert_eq!(stats.mode,"full-fallback","{mode}");assert!(stats.fallback_reason.is_some());assert_eq!(feed.traffic.lock().unwrap().full,1);assert!(stats.downloaded_bytes>=TARGET.len()as u64);
        }
    }

    #[test]
    fn final_signature_and_announced_version_are_required_after_reconstruction(){
        for mode in ["bad-signature","version"] {
            let feed=feed(mode);let root=tempfile::tempdir().unwrap();cache_verified(root.path(),&base()).unwrap();
            assert!(tauri::async_runtime::block_on(download(&update(&feed),root.path(),|_|{})).is_err());
            assert_eq!(feed.traffic.lock().unwrap().full,1);assert_eq!(crate::storage::read_file(&cache_path(root.path())).unwrap(),base());
        }
    }
}
