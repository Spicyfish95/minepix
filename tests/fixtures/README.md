# 格式与图像测试样例

本目录保存单元测试、桌面定向验收及格式互通复验使用的固定数据，不是用户演示项目。`tests/` 已被打包配置排除，样例不会进入安装包或发布 ZIP。

| 文件 | 来源与用途 |
| --- | --- |
| `rgba-linked.aseprite` | 独立构造；RGBA、位移链接、标签和静态 Slice，校验共享图像与独立位置 |
| `metadata-roundtrip.aseprite` | 用 Aseprite 1.3.18.6 实际保存的自有测试像素；层属性、色板、标签和 Slice 元数据 |
| `indexed-linked.aseprite` / `grayscale-linked.aseprite` | Aseprite 保存的自有索引 / 灰度测试图；校验深度、透明度与链接 |
| `blend-golden.json` | Aseprite 渲染 19 种混合模式的固定期望值 |
| `gif-disposal.gif` / `gif-disposal.expected.json` / `gif-frame.png` | 独立生成；校验 GIF 处置和逐帧像素 |
| `grass.ase` | 用户提供的互通样例；校验内嵌瓦片展开与索引色 |
| `project-transfer/fixture.json` / `fixture.bin` | `node scripts/create-transfer-fixture.mjs` 使用实际前端打包器生成；小型自有RGBA / 索引 / null与空cel、链接、参考及未知元数据，供Rust跨语言逐字节对照；非磁盘PIX格式 |
| `project-transfer/read.bin` | 先构建debug的project-tool，再由`node scripts/create-read-fixture.mjs`对同一fixture.json执行Rust编码 / read-transfer；验证前端实际解包Rust读取输出，常规测试直接读取已提交样例 |
| `update-blockmap.json` | `node scripts/create-blockmap-fixture.mjs`按固定seed生成65,536-byte内容的块图；Node / Rust逐块一致与插入重同步验证，无需私钥 |
| `updater-differential.bin` / `.sig` | `node scripts/create-differential-fixture.mjs`生成确定性65,536-byte协议样例并用仓库外密钥签名绑定alpha.2；开头明确标注非安装器，常规Rust测试读取已提交内容，不需要密钥或执行任何EXE |

## 使用

常规测试直接读取已提交样例，不需要重新签名。ASE Node 测试调用实际 Rust project-tool。详见 [开发指南](../../docs/DEVELOPMENT.md)。
