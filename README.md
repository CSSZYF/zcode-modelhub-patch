# model-hub — ZCode 模型拉取补丁

给 **ZCode 桌面版** 注入第三方模型管理能力。非官方补丁，纯本地修改。

**当前适配：ZCode Desktop 3.14.3**（模型设置页重构版 · Personal Model 架构）

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
- ✅ ZCode 风格选择面板：搜索、全选 / 全不选、逐个勾选；**再次拉取时默认勾选该渠道已选过的模型**（首次拉取默认全选），确认不会改动原有设置
- ✅ **最终态语义**：确认添加后模型列表 = 勾选的模型（未勾选的自动移除，手动添加的保留）
- ✅ **删除持久化**：删除的模型由原生 `zcode.deletedModels` 墓碑承载，不再被目录同步复活
- ✅ **思考档位表**（个人模型编辑器）：新增「思考档位表」按钮，表格勾选推理等级
  （off / on / minimal / low / medium / high / xhigh / max / ultra），自动按从低到高生成，
  自定义档位自动保留——不用再逐个手打
- ✅ **隐私：关闭全部自动上报**（源码级关闭，还原即恢复）
  - ARMS RUM 遥测（性能 / 点击 / 白屏 / 异常 / API）
  - `zcode-data-size` 磁盘用量定时上报
  - MCP 进程遥测（`[mcp-telemetry]`）
  - **事件上报**（`zcode.z.ai/api/v1/event/report`：app_launch / app_daily_active / session_create，含持久设备号）
  - **链路与指标上报**（阿里云 ARMS OTLP：local-ttft / renderer-action-trace / agent 侧 `zcode-cli-agent`）
  - **崩溃远程上报**（改为只保留本地转储）
- ✅ **修复：自定义 agent 启动命令时的存储初始化失败**（例如 keysmith 等自定义 `ZCODE_AGENT_SERVER_COMMAND` 场景下会抛 `unsupported_runtime` 起不来）
- ✅ **修复：`Plugin not found: computer-use@zcode-plugins-official`**（安装器把自带 computer-use 插件物化进插件仓）
- ✅ **全消息可编辑**（可选引擎补丁）：解除"只有最后一条消息能编辑"的限制
- ✅ 外科手术式安装：原数据区逐字节保留，原生模块零改动，全程约 5~30 秒
- ✅ **原子安全**：所有写操作 = 临时文件 + 尺寸校验 + 改名，进程占用时安全失败而非写坏文件
- ✅ 安装路径自动探测（注册表 + 常见位置），装在非 C 盘也能识别

> v1.x 是为 3.13 及更早版本写的，其锚点在 3.14 系中已不存在——**3.14.3 必须用本版（v2.2.0）**。
> ZCode 每次大版本更新后，等本仓库更新适配再装；锚点不匹配时脚本会明确报错并放弃，不会改坏文件。

## 安装

1. 确保已安装 [Node.js](https://nodejs.org)（任意 LTS 版本）
2. 下载本仓库 Release 中的 `modelhub-zcode-patch-vX.X.X.zip`（或 Code → Download ZIP），解压
3. **先在托盘完全退出 ZCode**（右键托盘图标 → 退出；关窗口不够——它默认缩到托盘）
4. 双击 `一键安装补丁.cmd`，UAC 弹窗点「是」。脚本会依次：
   - Step 1: 修改 `app.asar`（拉取模型 / 请求头模拟 / 视觉探测 / 隐私关闭 / host 修复）
   - Step 2: 询问是否安装引擎补丁（全消息可编辑）
   - Step 3: 物化 computer-use 插件（修复 `Plugin not found`，失败不影响其他步骤）
5. 打开 ZCode：设置 → 模型供应商 → 添加 / 编辑渠道

> ZCode 自动更新会覆盖补丁，更新后重新运行安装脚本即可。
> 需要手动指定路径时：`node patch-core.js "D:\ZCode\resources"`

## 还原

双击 `还原补丁.cmd`，同时恢复官方原版 `app.asar` 与 `zcode.cjs`。

## 使用

1. 添加渠道，填好 **BaseURL**（带不带 `/v1` 都可以）和 **API Key**，选择 API 格式
2. 点击 **「拉取模型」** → 在面板中勾选需要的模型 → **「确认添加」**
3. （可选）点击 **「请求头模拟」** → 选择 Claude / Codex 预设 → 勾选需要的头 → **「应用」**
4. （可选）勾选模型后点 **「探测视觉(勾选项)」** 实测识图能力

## 工作原理

补丁在 ZCode 的四处源码上做**锚点定位 + 最小注入**（3.14.0 布局）：

| 文件 | 注入内容 |
|---|---|
| `out/preload/index.cjs` | `zcode.modelhubFetchModels` / `modelhubProbeVision` 两个 IPC 桥 |
| `out/main/index.js` | `modelhub:fetch-models` / `modelhub:probe-vision` 两个主进程处理器；ARMS RUM / 磁盘用量 / MCP 三处遥测源码级关闭；崩溃上报开关改为本地 |
| `out/renderer/assets/styles-*.js` | 渠道编辑页按钮行（拉取模型 / 请求头模拟）+ 选择面板 + 视觉探测 + 最终态应用逻辑；个人模型编辑器的「思考档位表」 |
| `out/host/chunk-*.js` | 自定义 agent 启动命令分支补 `supportsStorageStartup` / `storagePreparationEntry` |
| `out/main/chunk-*.js`（事件上报核心，按锚点定位） | `reportEvent` / `reportAppLaunch` / `reportAppDailyActive` 的发送函数直接返回，事件不再外发 |
| `out/main/chunk-*.js`（OTEL 环境，按锚点定位） | 清空打包内嵌的 OTLP 端点与请求头，链路 / 指标不再外发（主进程、host、agent 一并生效） |

安装采用**外科手术式**重打包：数据区逐字节保留，仅追加改动文件并重写头部索引，
`app.asar.unpacked` 中的原生模块（终端依赖）完全不动；写盘 = 临时文件 + 尺寸校验 + 改名，
随后**回读验证**全部注入点，任一失败即放弃（原文件未动）。
安装前自动备份为 `app.asar.modelhub-backup`，`还原补丁.cmd` 可完整恢复。引擎补丁独立备份 `zcode.cjs`。

## 文件说明

| 文件 | 作用 |
|---|---|
| `一键安装补丁.cmd` | 安装入口（自动提权；等待 ZCode 退出；三步：asar + 引擎可选 + 插件物化） |
| `还原补丁.cmd` | 卸载 / 还原入口（asar + 引擎一起还原） |
| `patch-core.js` | 补丁核心：定位、锚点校验、改写、外科手术式重打包、回读验证 |
| `engine-patch.js` | 可选引擎补丁：全消息可编辑（含语法自检，失败零改动） |
| `snippet-preload.txt` / `snippet-main.js` / `snippet-helper.js` | 三处注入内容（纯文本，便于审阅） |
| `asar.js` | 零依赖 asar 解包 / 打包 / 手术式改写实现 |
| `VERSION.txt` | 适配的 ZCode 版本与构建时间 |

## 兼容性说明

补丁通过特征锚点定位注入点，锚点与 ZCode 具体版本绑定。ZCode 大版本更新后若结构变化，
脚本会**明确报错并放弃修改**，不会损坏原文件——届时等本仓库更新适配即可。
`patch-core.js <resources> --check` 可只做锚点体检（不写任何文件）。

## License

MIT

---

<a name="english"></a>
# model-hub — Model Pull Patch for ZCode Desktop

Injects third-party model management into the ZCode desktop app.
**Built for ZCode Desktop 3.14.3** (the Personal Model settings refactor).

- "Pull Models" button on both **add-provider** and **edit-provider** pages
- **Dialect-aware fallback**: anthropic providers try `/v1/models` first, OpenAI-style try `/models` first, gemini uses `v1beta` — no need to type `/v1` manually
- **Per-dialect auth**: anthropic sends `x-api-key` + `Authorization: Bearer`, gemini sends `x-goog-api-key`
- **Header simulation** (edit-provider page): full Claude (`claude-cli`) / Codex (`codex_cli_rs`) request header presets; check = applied, uncheck = removed; one-click clear-all; headers are sticky across model saves
- Pull / vision probing automatically carry the channel's simulated headers (works on client-fingerprint-gated endpoints)
- **Empirical vision probing**: 1×1 test image per model via `chat/completions` (OpenAI) or `v1/messages` (Anthropic)
- ZCode-styled picker with search and per-model selection; **re-pulls pre-check the channel's existing models** (first pull checks all), so confirming never disturbs your current setup
- Final-state semantics: confirmed selection becomes the channel model list (manual entries preserved)
- Deletions persist via the native `zcode.deletedModels` tombstones
- **Reasoning-levels table** (personal-model editor): a 「思考档位表」 button to pick levels
  (off / on / minimal / low / medium / high / xhigh / max / ultra) in a table, ordered low→high, custom values preserved
- **Privacy: ALL uploads disabled at source** — ARMS RUM, disk-usage scheduler, MCP report,
  the event-report core (`zcode.z.ai/api/v1/event/report`: app_launch / app_daily_active / session_create),
  OTEL trace/metric export (Aliyun ARMS), and the remote crash-reporter flag — fully restored by the restore script
- **Fixes**: custom-agent-command storage-preparation startup failure (`unsupported_runtime`); `Plugin not found: computer-use@zcode-plugins-official` (the installer materializes the bundled plugin)
- Optional engine patch: **edit ALL user messages**, not just the latest one
- Surgical asar repack (data region preserved byte-for-byte), read-back verified, atomic writes everywhere
- Install path auto-detection (registry + common locations)

**Requirements:** Windows, ZCode Desktop 3.14.3, [Node.js](https://nodejs.org)

**Usage:** download the release ZIP → fully quit ZCode (tray → Quit) → run `一键安装补丁.cmd` as admin → restart ZCode → Settings → Model Providers.

## License

MIT
