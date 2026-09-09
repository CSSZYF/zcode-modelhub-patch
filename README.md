# model-hub — ZCode 模型拉取补丁

给 **ZCode 桌面版** 注入第三方模型管理能力。非官方补丁，纯本地修改，不联网上报任何数据。

[English](#english) | 中文

## 功能

- ✅ **拉取模型**按钮（添加渠道 / 编辑渠道 页均有）：一键拉取任意 OpenAI 兼容端点的全量模型列表
- ✅ **方言感知回退**：anthropic 渠道 `/v1/models` 优先、openai 系 `/models` 优先、gemini 走 `v1beta`——用户**不需要**手动填写 `/v1`，两种路径自动尝试
- ✅ **按方言认证**：anthropic 自动附带 `x-api-key` + `Authorization: Bearer` 双头，gemini 走 `x-goog-api-key`
- ✅ **请求头模拟**（编辑渠道页）：Claude (`claude-cli`) / Codex (`codex_cli_rs`) 全套预设请求头
  - 逐条勾选：勾上 = 生效，取消勾选 = 从渠道移除
  - 值可编辑；`session_id` 一键换新 UUID
  - 一键**清除全部模拟**
  - **粘性生效**：修改模型配置不会再把配好的头剥掉
- ✅ 拉取 / 视觉探测自动**携带渠道的模拟请求头**（验客户端指纹的端点也能拉）
- ✅ **视觉能力实测**：对勾选模型发送 1×1 测试图，OpenAI 与 Anthropic 两种协议分别适配，用真实响应判定，不靠名字猜
- ✅ ZCode 风格选择面板：搜索、全选 / 全不选、逐个勾选
- ✅ **最终态语义**：确认添加后模型列表 = 勾选的模型（未勾选的自动移除，手动添加的保留）
- ✅ **删除持久化**：删除的模型写入 `zcode.deletedModels`，不再被目录同步复活
- ✅ **全消息可编辑**（可选引擎补丁）：解除"只有最后一条消息能编辑"的限制
- ✅ 外科手术式安装：原数据区逐字节保留，原生模块零改动，全程约 5~30 秒
- ✅ **原子安全**：所有写操作 = 临时文件 + 尺寸校验 + 改名，进程占用时安全失败而非写坏文件
- ✅ 安装路径自动探测（注册表 + 常见位置），装在非 C 盘也能识别

## 安装

1. 确保已安装 [Node.js](https://nodejs.org)（任意 LTS 版本）
2. 下载本仓库 Release 中的 `modelhub-zcode-patch-vX.X.X.zip`（或 Code → Download ZIP），解压
3. 双击 `一键安装补丁.cmd`，UAC 弹窗点「是」
   - Step 1: 修改 `app.asar`（拉取模型 / 请求头模拟 / 视觉探测）
   - Step 2: 可选修改 `zcode.cjs`（全消息可编辑）
4. 打开 ZCode：设置 → 模型供应商 → 添加 / 编辑渠道

> ZCode 自动更新会覆盖补丁，更新后重新运行安装脚本即可。
> 需要手动指定路径时：`node patch-core.js "D:\ZCode\resources"`

## 还原

双击 `还原补丁.cmd`，同时恢复官方原版 `app.asar` 与 `zcode.cjs`。

## 使用

1. 添加渠道，填好 **BaseURL**（带不带 `/v1` 都可以）和 **API Key**，选择 API 格式
2. 点击 **「拉取模型」** → 在面板中勾选需要的模型 → **「确认添加」**
3. （可选）点击 **「请求头模拟」** → 选择 Claude / Codex 预设 → 勾选需要的头 → **「应用」**
4. （可选）勾选模型后点 **「探测视觉(勾选项)」** 实测识图能力
5. （可选）点 **「探测视觉(全部)」** 或 **「确认添加」**

## 工作原理

ZCode 的模型供应商配置存储在 `~/.zcode/v2/config.json`（provider 表），
模型的图片 / 视频输入能力由 `models.<id>.modalities.input` 数组决定（包含 `"image"` 即支持识图），
provider 级自定义请求头由 `provider.headers` 对象承载（官方原生支持，仅缺 UI 入口）。

本补丁在其渲染层注入按钮与面板，并通过主进程 IPC 完成对 `{baseURL}/models` 的请求（不受 CORS 限制），
按渠道的 API 格式自动选择 URL 候选与认证头。视觉探测对 OpenAI 走 `chat/completions` + `image_url`，
对 Anthropic 走 `v1/messages` + 原生 base64 image block。

安装采用**外科手术式**重打包：解包仅用于读取，重打包时原数据区逐字节保留、仅追加改动文件并重写头部索引，
`app.asar.unpacked` 中的原生模块（终端依赖）完全不动。安装前自动备份为 `app.asar.modelhub-backup`，
`还原补丁.cmd` 可完整恢复。引擎补丁同样独立备份 `zcode.cjs`。

## 文件说明

| 文件 | 作用 |
|---|---|
| `一键安装补丁.cmd` | 安装入口（自动请求管理员权限，两步：asar + 引擎可选） |
| `还原补丁.cmd` | 卸载 / 还原入口（asar + 引擎一起还原） |
| `patch-core.js` | 补丁核心：定位、校验锚点、改写、外科手术式重打包 |
| `engine-patch.js` | 可选引擎补丁：全消息可编辑 |
| `asar.js` | 零依赖 asar 解包 / 打包 / 手术式改写实现 |
| `VERSION.txt` | 适配的 ZCode 版本与构建时间 |

## 兼容性说明

补丁通过特征锚点定位注入点。ZCode 大版本更新后若结构变化，脚本会**明确报错并放弃修改**，
不会损坏原文件——届时等本仓库更新适配即可。

---

<a name="english"></a>
# model-hub — Model Pull Patch for ZCode Desktop

Injects third-party model management into the ZCode desktop app.

- "Pull Models" button on both **add-provider** and **edit-provider** pages
- **Dialect-aware fallback**: anthropic providers try `/v1/models` first, OpenAI-style try `/models` first, gemini uses `v1beta` — no need to type `/v1` manually
- **Per-dialect auth**: anthropic sends `x-api-key` + `Authorization: Bearer`, gemini sends `x-goog-api-key`
- **Header simulation** (edit-provider page): full Claude (`claude-cli`) / Codex (`codex_cli_rs`) request header presets; check = applied, uncheck = removed; one-click clear-all; headers are sticky across model saves
- Pull / vision probing automatically carry the channel's simulated headers (works on client-fingerprint-gated endpoints)
- **Empirical vision probing**: 1×1 test image per model via `chat/completions` (OpenAI) or `v1/messages` (Anthropic)
- ZCode-styled picker with search and per-model selection
- Final-state semantics: confirmed selection becomes the channel model list (manual entries preserved)
- Deletions persist to `zcode.deletedModels` — no more resurrecting models
- Atomic writes everywhere: temp file + size verify + rename, fails safe when files are locked
- Optional engine patch: **edit ALL user messages**, not just the latest one
- Surgical asar repack, auto-backup, one-click restore, install path auto-detection

**Requirements:** Windows, ZCode desktop, [Node.js](https://nodejs.org)

**Usage:** download the release ZIP → run `一键安装补丁.cmd` as admin → restart ZCode → Settings → Model Providers.

## License

MIT
