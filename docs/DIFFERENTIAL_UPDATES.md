# 差分更新与完整包回退

Rust 下载器支持块复用与完整包回退，生产发布状态见 [发布指南](RELEASING.md)。下载验证不能替代实际安装与重启验收。

## 数据与校验

发布脚本`node scripts/create-update-manifest.mjs`保留Tauri原生platforms、完整包URL、签名及签名版本绑定，在根部增加`minepixBlockmap`。同一块图同时供Windows x64 NSIS目标使用，含`format: minepix-blockmap-v1`、目标版本、完整包URL、完整包大小 / SHA256及按序连续覆盖的`chunks: [{offset,size,sha256}]`。

内容分块使用固定256项Gear表：从0x12345678以u32 xorshift（左13、右17、左5）依次生成；每字节`hash=(hash<<1)+gear[byte]`按u32回绕。达到2048 bytes后，当低13位为0或达到32768 bytes时结束一块，hash清0，末块可短于2048。Node发布脚本与Rust本地缓存使用相同算法；已提交确定性fixture逐块比较。SHA256用于复用和完整性定位，**不替代签名认证**。

Rust先检查块图格式、版本 / URL与官方Update一致、总长不超过512MiB、块数 / 连续范围 / 摘要格式。用本地完整NSIS内容重新分块，以SHA256和大小匹配目标块；连续缺失块合并为HTTP Range请求。只接受206及精确Content-Range、精确数据长度，重建后检查整个目标摘要，再调用锁定官方更新器的`Update::verify`，包含固定公钥和签名版本验证。即使块图被修改，也不能把未签名或签错版本的重建包置为downloaded。

没有块图、没有缓存或没有可复用块时，使用既有官方完整包下载 / 校验。缓存无法读取、块图错误、范围不受支持、范围头错误、截断、重建摘要或签名失败时，转为完整包回退；完整包仍须通过相同签名和版本校验。取消通过外层oneshot终止整个差分 / 回退future，不把取消当网络失败继续全包；重试重新读取基准和规划。

## 缓存与状态

NSIS安装成功后把正在运行的安装器复制到`%APPDATA%/com.minepix.tauri/update-cache/base.exe`。后续成功下载且完成最终验证后原子替换这份基准；缓存不是可信来源，每次复用仍按实际内容摘要匹配，最终安装包仍校验签名。缓存写入失败不会丢弃内存中已验证的下载，状态保留cacheError；下次可退回全包。卸载仅删除自身基准与空update-cache目录，保留用户项目。基准占用一个完整安装器大小，需与私有安装目录分开计入磁盘体积。

更新状态保留原status / progress，新增`transfer`：

- `mode`: full、differential或full-fallback。
- `downloadedBytes` / `totalBytes`: 当前整个操作消费的包体块字节和已知目标，回退保留此前已读差分字节，不伪称仅下载完整包一次。
- `reusedBytes`:成功差分规划的本地复用量，进入全包回退时归0。
- `fallbackReason`:明确的差分失败原因；`notice`同时为differential-fallback。
- `cacheError`:最终已验证包的本地缓存写入错误。

这些字段可通过现有updateState / update:state读取。界面保留原下载进度和错误 / 重试，不另行把本阶段状态测试称作真实更新面板验收。中途拒绝范围时未消费的响应体可能已在系统缓冲，downloadedBytes不是TCP线缆总字节；真实专项另列服务器交给socket的包体上界及块图额外开销，不含HTTP头 / TLS。

## 定向验证与重现

先按[开发说明](DEVELOPMENT.md)加载Rust环境，运行对应定向测试：

```powershell
node --test tests/update-blockmap.test.js
cargo test --manifest-path src-tauri/Cargo.toml --lib differential::tests
cargo test --manifest-path src-tauri/Cargo.toml --lib updater::tests
cargo test --manifest-path src-tauri/Cargo.toml --lib notifications::tests
cargo build --manifest-path src-tauri/Cargo.toml --example differential-tool
```

Node3项、Rust差分6项 / 更新5项 / 通知决策4项通过。覆盖跨语言块图、插入重同步、缺缓存 / 零复用、实际本地HTTP Range、错误范围 / 截断 / 篡改 / 坏图 / 摘要、最终坏签名与错版本、取消无回退及重试、有效下载缓存 / 缓存写失败。测试通知只检查决策和窗口路由，不发送系统通知。65,536-byte协议fixture明确不是安装器；常规测试不需要私钥或重新签名。

NSIS 整包压缩可能使跨版本复用率很低；差分支持不保证显著节省带宽。
