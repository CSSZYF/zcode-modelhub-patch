# model-hub — ZCode 模型拉取补丁

给 **ZCode 桌面版** 的「模型供应商」设置注入「拉取模型」能力。非官方补丁，纯本地修改，不联网上报任何数据。

[English](#english) | 中文

## 功能

- ✅ **添加渠道 / 编辑渠道** 页面均有「拉取模型」按钮
- ✅ 一键拉取任意 OpenAI 兼容端点的全量模型列表（自动尝试 `/v1` 路径回退）
- ✅ ZCode 风格选择面板：搜索、全选 / 全不选、逐个勾选
- ✅ **视觉能力实测**：对勾选模型逐个发送 1×1 测试图（并发 4），用真实响应判定是否支持图片输入，不靠模型名瞎猜
- ✅ 写入即生效，视觉标记对应模型编辑器里的 输入类型 → 图片

## 安装

1. 确保已安装 [Node.js](https://nodejs.org)（任意 LTS 版本）
2. 下载本仓库（Code → Download ZIP），解压
3. 双击 `一键安装补丁.cmd`，UAC 弹窗点「是」
4. 脚本会自动：定位 ZCode 安装目录 → 关闭 ZCode → 备份原版 `app.asar` → 打补丁（约 5~30 秒）
5. 打开 ZCode：设置 → 模型供应商 → 添加 / 编辑渠道

> ZCode 自动更新会覆盖补丁，更新后重新运行一次安装脚本即可。
> 脚本自动探测安装路径（注册表 + 常见位置），装在非 C 盘也能识别；也可手动指定：`node patch-core.js "D:\ZCode\resources"`

## 还原

双击 `还原补丁.cmd`，恢复官方原版 `app.asar`。

## 使用

1. 添加渠道，填好 **BaseURL**（如 `https://api.example.com/v1`）和 **API Key**
2. 点击 **「拉取模型」**
3. 在弹出的面板中勾选需要的模型
4. 需要确认视觉能力时点 **「探测视觉(勾选项)」**——每个模型发送一次极小请求（16 tokens）
5. 点 **「确认添加」**，完成

## 工作原理

ZCode 的模型供应商配置存储在 `~/.zcode/v2/config.json`（provider 表），
模型的图片 / 视频输入能力由 `models.<id>.modalities.input` 数组决定（包含 `"image"` 即支持识图）。
官方界面未提供批量拉取入口，本补丁在其渲染层注入按钮，并通过主进程 IPC 完成对
`{baseURL}/models` 的请求（不受 CORS 限制）。

安装采用**外科手术式**重打包：解包仅用于读取，重打包时原数据区逐字节保留、
仅追加改动文件并重写头部索引，`app.asar.unpacked` 中的原生模块（终端依赖）完全不动。
安装前自动备份为 `app.asar.modelhub-backup`，`还原补丁.cmd` 可完整恢复。

## 文件说明

| 文件 | 作用 |
|---|---|
| `一键安装补丁.cmd` | 安装入口（自动请求管理员权限） |
| `还原补丁.cmd` | 卸载 / 还原入口 |
| `patch-core.js` | 补丁核心：定位、校验锚点、改写、重打包 |
| `asar.js` | 零依赖 asar 解包 / 打包 / 手术式改写实现 |
| `VERSION.txt` | 适配的 ZCode 版本与构建时间 |

## 兼容性说明

补丁通过特征锚点定位注入点。ZCode 大版本更新后若结构变化，脚本会**明确报错并放弃修改**，
不会损坏原文件——届时等本仓库更新适配即可。

---

<a name="english"></a>
# model-hub — Model Pull Patch for ZCode Desktop

Injects a "Pull Models" capability into the Model Provider settings of the ZCode desktop app.

- "Pull Models" button on both the **add-provider** and **edit-provider** pages
- Fetches the full model list from any OpenAI-compatible endpoint (auto `/v1` fallback)
- ZCode-styled picker: search, select all/none, per-model checkboxes
- **Empirical vision probing**: sends a 1×1 test image to each selected model (concurrency 4) and flags real image-input support — no name-based guessing
- One-click restore script; auto-backup before install (`app.asar.modelhub-backup`)
- Auto-detects the ZCode install location (registry + common paths), or pass it manually: `node patch-core.js "D:\ZCode\resources"`

**Requirements:** Windows, ZCode desktop, [Node.js](https://nodejs.org)

**Usage:** download ZIP → run `一键安装补丁.cmd` as admin → restart ZCode → Settings → Model Providers.

ZCode updates overwrite the patch — re-run the installer after updates. If anchors change in a
future version, the installer fails loudly and touches nothing.

## License

MIT
