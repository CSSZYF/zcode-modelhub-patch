#!/usr/bin/env node
"use strict";
// ============================================================================
// model-hub ZCode patch - surgical installer
//   Target layout: ZCode Desktop 3.14.1
//     out/preload/index.cjs, out/main/index.js, out/main/chunk-*.js (core/otel),
//     out/host/chunk-*.js, out/renderer/assets/styles-*.js
//
//   Applies in one pass:
//     1. model-hub bridges (preload)     -> zcode.modelhubFetchModels / modelhubProbeVision
//     2. model-hub IPC handlers (main)   -> modelhub:fetch-models / modelhub:probe-vision
//     3. model-hub UI (renderer)         -> pull-models button, header panel, picker, vision probe,
//                                           reasoning-levels table (思考档位表)
//     4. host storage-preparation fix    -> custom agent command (e.g. keysmith) startup fix
//     5. privacy: uploads off            -> ARMS RUM + disk-usage + MCP + event-report core
//                                           + OTEL endpoint + crash remote flag
//
//   All writes are atomic (temp file + size verify + rename) and verified by read-back.
//   Original app.asar is backed up to app.asar.modelhub-backup (see 还原补丁.cmd).
//
// Usage:
//   node patch-core.js                        patch the auto-detected live install
//   node patch-core.js <resources-dir>        patch an explicit resources dir (dry run / test)
//   node patch-core.js <resources-dir> --check    report anchor counts only, no writes
//   node patch-core.js --restore              restore app.asar from the backup
//   node patch-core.js --detect               print the detected resources dir
// ============================================================================
const fs = require("fs");
const path = require("path");
const asar = require(path.join(__dirname, "asar.js"));

const SNIP = {
  preload: fs.readFileSync(path.join(__dirname, "snippet-preload.txt"), "utf8"),
  main: fs.readFileSync(path.join(__dirname, "snippet-main.js"), "utf8"),
  helper: fs.readFileSync(path.join(__dirname, "snippet-helper.js"), "utf8"),
};

const PRELOAD_REL = "out/preload/index.cjs";
const MAIN_REL = "out/main/index.js";

// --- host storage-preparation fix (only affects the custom-agent-command branch) ---
const HOST_OLD =
  'function xn(r){let e=process.env.ZCODE_AGENT_SERVER_COMMAND?.trim();if(e)return Nn({command:e,args:Oi(process.env.ZCODE_AGENT_SERVER_ARGS_JSON)??["app-server","--stdio"],cwd:process.env.ZCODE_AGENT_SERVER_CWD?.trim()||r.workspacePath},r.presentationSurface);let t=Li(r)??xi(r);return Nn(t?{...t,supportsStorageStartup:!0}:Mi(r),r.presentationSurface)}';
const HOST_NEW =
  'function xn(r){let e=process.env.ZCODE_AGENT_SERVER_COMMAND?.trim();if(e){let _t=Li(r)??xi(r);return Nn({command:e,args:Oi(process.env.ZCODE_AGENT_SERVER_ARGS_JSON)??["app-server","--stdio"],cwd:process.env.ZCODE_AGENT_SERVER_CWD?.trim()||r.workspacePath,supportsStorageStartup:!0,storagePreparationEntry:_t?.storagePreparationEntry},r.presentationSurface);}let t=Li(r)??xi(r);return Nn(t?{...t,supportsStorageStartup:!0}:Mi(r),r.presentationSurface)}';

const PRELOAD_ANCHOR = 'exposeInMainWorld("zcode",{connectRemote';
const PRELOAD_NEW = 'exposeInMainWorld("zcode",{' + SNIP.preload + "connectRemote";

// 3.14.1: models-editor component renamed mbn -> _bn, providerName helper nN -> Kk
const MBN_ANCHOR =
  "(0,$.jsx)(_bn,{providerId:e.providerId,providerName:Kk(e),providerEnabled:e.enabled,providerAccess:e.config.access,models:G,onTestModel:s?De:void 0,onModelCommit:Oe,onModelEnabledChange:Ae,onDeleteModel:ke,onAddModel:je,onReorderModelIds:c?Me:void 0,settingsRevision:g??0},e.providerId)";
const WRAP_PREFIX =
  "(0,$.jsxs)(`div`,{className:`space-y-2`,children:[(0,$.jsx)(`div`,{className:`flex justify-end gap-2`,children:[(0,$.jsx)(X,{type:`button`,size:`sm`,variant:`outline`,onClick:()=>{try{window.__mhHeaders(e,__p=>{t&&t(__p)})}catch(__e){window.__mhToast&&window.__mhToast(`请求头面板异常：`+__e,!1)}},children:`请求头模拟`}),(0,$.jsx)(X,{type:`button`,size:`sm`,variant:`outline`,disabled:l,onClick:()=>{try{window.__mhPull&&window.__mhPull({provider:e,baseUrl:E,apiKey:O,format:w,models:G,addModel:je,deleteModel:ke})}catch(__e){window.__mhToast&&window.__mhToast(`拉取面板异常：`+__e,!1)}},children:`拉取模型`})]}),";
const WRAP_SUFFIX = "]}),";

// 3.14.1 NEW: reasoning-levels table button, wrapped around the levels list editor (Fyn)
const LEVELS_ANCHOR =
  "(0,$.jsx)(Myn,{values:e.reasoningLevelValuesValue,overridden:r?r.has(`reasoningLevelValuesValue`):t?.optionSpecs?.reasoningLevel?.values!==void 0,addLabel:a.formatMessage({id:`settings.modelProvider.reasoningLevelAdd`}),deleteLabel:a.formatMessage({id:`settings.modelProvider.reasoningLevelDelete`}),onChange:e=>i({reasoningLevelValuesValue:e})})";
const LEVELS_PREFIX =
  "(0,$.jsxs)(`div`,{className:`space-y-2`,children:[(0,$.jsx)(X,{type:`button`,size:`sm`,variant:`outline`,onClick:()=>{try{window.__mhLevels&&window.__mhLevels(e.reasoningLevelValuesValue,__p=>{i({reasoningLevelValuesValue:__p})})}catch(__e){window.__mhToast&&window.__mhToast(`档位表异常：`+__e,!1)}},children:`思考档位表`}),";
const LEVELS_SUFFIX = "]}),";

const TELEM = [
  {
    label: "遥测: ARMS RUM 初始化",
    old: "Ns.init({enable:!0,version:X,endpoint:nc,env:Bs,autoInject:!0,",
    neu: "Ns.init({enable:!1,version:X,endpoint:nc,env:Bs,autoInject:!0,",
    marker: "Ns.init({enable:!1,",
  },
  {
    label: "遥测: 磁盘用量调度器",
    old: "function sP(e){$u(),Ba=mz({",
    neu: "function sP(e){return;$u(),Ba=mz({",
    marker: "function sP(e){return;$u(),Ba=mz({",
  },
  {
    label: "遥测: MCP 上报",
    old: 'function cP(e,t){if(!is||e.kind==="memory")return;',
    neu: "function cP(e,t){return;",
    marker: "function cP(e,t){return;",
  },
];

// 3.14.1 NEW: event-report telemetry core (chunk located by marker, not by file name)
const CORE_MARK = "api/v1/event/report";
const CORE_OLD = "async function x(C,S,I,k){let T=null;try{T=await e.loadAuthorization?.(k)??null}catch{}";
const CORE_NEW = "async function x(C,S,I,k){return;let T=null;try{T=await e.loadAuthorization?.(k)??null}catch{}";

// 3.14.1 NEW: OTEL exporter endpoint chunk (values blanked programmatically)
const OTEL_MARK = 'OTEL_EXPORTER_OTLP_ENDPOINT:"https://';

// 3.14.1 NEW: crash reporter remote flag (hardcoded !0 -> !1, keeps local-only reporter)
const CRASH_OLD = "var Vf=Hf(w,!0);";
const CRASH_NEW = "var Vf=Hf(w,!1);";

// ---------------------------------------------------------------- helpers ---
function die(msg) { console.error("\n[x] " + msg); process.exit(1); }
function log(m) { console.log("[*] " + m); }
function countOf(src, s) { return src.split(s).length - 1; }

function applyOnce(src, oldS, newS, label, marker) {
  const n = countOf(src, oldS);
  if (n === 1) {
    console.log("  OK   " + label);
    return src.replace(oldS, newS);
  }
  if (n === 0 && marker && src.includes(marker)) {
    console.log("  SKIP " + label + " (已应用)");
    return src;
  }
  die("锚点不匹配 [" + label + "]: 找到 " + n + " 处（应为 1）。当前 ZCode 版本尚未适配，已放弃修改，原文件未动。");
}

function atomicReplace(src, dst, expectSize) {
  const tmp = dst + ".modelhub-tmp";
  fs.rmSync(tmp, { force: true });
  fs.copyFileSync(src, tmp);
  const got = fs.statSync(tmp).size;
  if (expectSize !== undefined && got !== expectSize) {
    fs.rmSync(tmp, { force: true });
    die("校验失败: 临时文件 " + got + " 字节, 应为 " + expectSize + " - 已放弃, 原文件未动");
  }
  fs.renameSync(tmp, dst);
}

// blank a `KEY:"..."` string value (keeps the key, empties the value)
function blankValue(src, key) {
  const needle = key + ':"';
  const i = src.indexOf(needle);
  if (i < 0) return null;
  if (src.indexOf(needle, i + 1) >= 0) return null;
  const start = i + needle.length;
  const end = src.indexOf('"', start);
  if (end < 0) return null;
  return src.slice(0, start) + src.slice(end);
}

function findResources(explicit) {
  const cands = [];
  if (explicit) cands.push(explicit);
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"];
  const lad = process.env.LOCALAPPDATA;
  if (lad) cands.push(path.join(lad, "Programs", "ZCode", "resources"));
  cands.push(path.join(pf, "ZCode", "resources"));
  if (pf86) cands.push(path.join(pf86, "ZCode", "resources"));
  try {
    const { execSync } = require("child_process");
    const out = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall /s /f "ZCode" /d', { encoding: "utf8", timeout: 20000 });
    for (const m of out.matchAll(/InstallLocation\s+REG_SZ\s+(.*)/g)) {
      const loc = m[1].trim();
      if (loc) cands.push(path.join(loc, "resources"));
    }
  } catch {}
  for (const c of cands) if (c && fs.existsSync(path.join(c, "app.asar"))) return c;
  return null;
}

// --------------------------------------------------------------- cli args ---
const args = process.argv.slice(2);
const restoring = args.includes("--restore");
const checkOnly = args.includes("--check");
const detectOnly = args.includes("--detect");
const explicitDir = args.find((a) => !a.startsWith("--"));

const resourcesDir = findResources(explicitDir);
if (detectOnly) { console.log(resourcesDir || "NOT_FOUND"); process.exit(resourcesDir ? 0 : 1); }
if (!resourcesDir) die("未找到 ZCode 安装目录（已尝试注册表和常见路径）。请手动指定：node patch-core.js \"ZCode安装目录下的resources文件夹\"");
const asarPath = path.join(resourcesDir, "app.asar");
const backupPath = asarPath + ".modelhub-backup";
if (!fs.existsSync(asarPath)) die("未找到 " + asarPath);

// ---------------------------------------------------------------- restore ---
if (restoring) {
  let did = 0;
  if (fs.existsSync(backupPath)) {
    log("原子还原中（临时文件 + 校验 + 改名）...");
    atomicReplace(backupPath, asarPath, fs.statSync(backupPath).size);
    console.log("[√] 已还原官方原版 app.asar");
    did++;
  } else {
    console.log("[!] 未找到备份 app.asar.modelhub-backup，跳过 app.asar");
  }
  const enginePath = path.join(resourcesDir, "glm", "zcode.cjs");
  const engineBackup = enginePath + ".modelhub-backup";
  if (fs.existsSync(engineBackup)) {
    atomicReplace(engineBackup, enginePath, fs.statSync(engineBackup).size);
    console.log("[√] 已还原官方原版 zcode.cjs（引擎补丁）");
    did++;
  } else {
    console.log("[!] 未找到备份 zcode.cjs.modelhub-backup，跳过 zcode.cjs");
  }
  if (!did) die("没有任何可还原的备份（可能从未安装过补丁）");
  process.exit(0);
}

// ------------------------------------------------------- read + locate rels --
log("读取 " + asarPath);
const srcBuf = fs.readFileSync(asarPath);
const hdr = asar.readHeader(srcBuf);
function entryOf(rel) {
  let node = hdr.json;
  for (const part of rel.split("/")) { node = node.files && node.files[part]; if (!node) return null; }
  if (node.files || node.unpacked) return null;
  const off = hdr.dataOffset + parseInt(node.offset, 10);
  return srcBuf.slice(off, off + node.size);
}
function listOf(rel) {
  let node = hdr.json;
  for (const part of rel.split("/")) { node = node.files && node.files[part]; if (!node) return null; }
  return node.files ? Object.keys(node.files) : null;
}

const preload0 = entryOf(PRELOAD_REL);
const main0 = entryOf(MAIN_REL);
if (!preload0 || !main0) die("app.asar 结构不符：缺少 " + PRELOAD_REL + " 或 " + MAIN_REL);

// already patched? (check before any anchor scan - a patched asar no longer has the anchors)
if (preload0.includes("modelhubFetchModels") || main0.includes("modelhub:fetch-models")) {
  die("检测到补丁已安装过。如需重装：先运行 还原补丁.cmd，再运行安装。");
}

function findIn(dirRel, filter, anchor, what) {
  const names = listOf(dirRel);
  if (!names) die("app.asar 结构不符：缺少目录 " + dirRel);
  const hits = [];
  for (const n of names) {
    if (!n.endsWith(".js")) continue;
    if (filter && !filter.test(n)) continue;
    const data = entryOf(dirRel + "/" + n);
    if (data && data.includes(anchor)) hits.push({ rel: dirRel + "/" + n, data });
  }
  if (hits.length === 0) die("未找到包含注入锚点的文件（" + what + "）— 当前 ZCode 版本尚未适配。");
  if (hits.length > 1) die("锚点命中多个文件（" + what + "）：" + hits.map((h) => h.rel).join(", "));
  return hits[0];
}

// renderer: prefer styles-*.js, fall back to any .js under assets
let found = null;
const rNames = listOf("out/renderer/assets") || [];
const styleHits = [];
for (const n of rNames) {
  if (!/^styles-.*\.js$/.test(n)) continue;
  const data = entryOf("out/renderer/assets/" + n);
  if (data && data.includes(MBN_ANCHOR)) styleHits.push({ rel: "out/renderer/assets/" + n, data });
}
if (styleHits.length === 1) found = styleHits[0];
else if (styleHits.length === 0) found = findIn("out/renderer/assets", null, MBN_ANCHOR, "渲染层模型列表锚点");
else die("渲染层锚点命中多个文件：" + styleHits.map((h) => h.rel).join(", "));
const RENDER_REL = found.rel;

const hostHit = findIn("out/host", null, HOST_OLD, "host 存储初始化锚点");
const HOST_REL = hostHit.rel;
const coreHit = findIn("out/main", null, CORE_MARK, "事件上报核心");
const CORE_REL = coreHit.rel;
const otelHit = findIn("out/main", null, OTEL_MARK, "OTEL 上报端点");
const OTEL_REL = otelHit.rel;
log("preload:  " + PRELOAD_REL);
log("main:     " + MAIN_REL);
log("renderer: " + RENDER_REL);
log("host:     " + HOST_REL);
log("core:     " + CORE_REL);
log("otel:     " + OTEL_REL);

let p = preload0.toString("utf8");
let m = main0.toString("utf8");
let r = found.data.toString("utf8");
let h = hostHit.data.toString("utf8");
let core = coreHit.data.toString("utf8");
let otel = otelHit.data.toString("utf8");

// ------------------------------------------------------- anchor + state ------
console.log("[*] 锚点检查");
const anchors = [
  ["preload 桥接", countOf(p, PRELOAD_ANCHOR), 1],
  ["renderer 按钮锚点", countOf(r, MBN_ANCHOR), 1],
  ["renderer 档位表锚点", countOf(r, LEVELS_ANCHOR), 1],
  ["host 存储修复锚点", countOf(h, HOST_OLD), 1],
  ["遥测 ARMS RUM", countOf(m, TELEM[0].old), 1],
  ["遥测 磁盘用量", countOf(m, TELEM[1].old), 1],
  ["遥测 MCP 上报", countOf(m, TELEM[2].old), 1],
  ["事件上报核心", countOf(core, CORE_OLD), 1],
  ["OTEL 端点", countOf(otel, OTEL_MARK), 1],
  ["崩溃上报开关", countOf(m, CRASH_OLD), 1],
];
for (const [name, n, want] of anchors) console.log("  " + (n === want ? "OK  " : "FAIL") + " " + name + ": " + n);
if (checkOnly) {
  const ok = anchors.every(([, n, want]) => n === want);
  console.log(ok ? "[OK] 全部锚点唯一" : "[x] 存在不唯一/缺失的锚点");
  process.exit(ok ? 0 : 2);
}
for (const [name, n, want] of anchors) if (n !== want) die("锚点不匹配 [" + name + "]: 找到 " + n + " 处（应为 " + want + "）。当前 ZCode 版本尚未适配，已放弃修改，原文件未动。");

// ---------------------------------------------------------------- backup ----
log((fs.existsSync(backupPath) ? "刷新备份" : "备份原版") + " -> app.asar.modelhub-backup");
{
  const bt = backupPath + ".tmp";
  fs.rmSync(bt, { force: true });
  fs.copyFileSync(asarPath, bt);
  if (fs.statSync(bt).size !== fs.statSync(asarPath).size) { fs.rmSync(bt, { force: true }); die("备份校验失败 - 已放弃，原文件未动"); }
  fs.renameSync(bt, backupPath);
}

// ---------------------------------------------------------------- apply -----
console.log("[*] 改写六个文件（内存中完成）...");
p = applyOnce(p, PRELOAD_ANCHOR, PRELOAD_NEW, "preload 桥接");
m = m + "\n" + SNIP.main;
console.log("  OK   main IPC 处理器（追加）");
r = applyOnce(r, MBN_ANCHOR, WRAP_PREFIX + MBN_ANCHOR + WRAP_SUFFIX, "renderer 按钮行");
r = applyOnce(r, LEVELS_ANCHOR, LEVELS_PREFIX + LEVELS_ANCHOR + LEVELS_SUFFIX, "renderer 档位表按钮行");
r = r + "\n" + SNIP.helper;
console.log("  OK   renderer 功能块（追加）");
h = applyOnce(h, HOST_OLD, HOST_NEW, "host 存储初始化修复");
for (const t of TELEM) m = applyOnce(m, t.old, t.neu, t.label, t.marker);
core = applyOnce(core, CORE_OLD, CORE_NEW, "事件上报核心（sendReportAttempt）");
{
  const before = otel;
  otel = blankValue(otel, "OTEL_EXPORTER_OTLP_ENDPOINT");
  if (otel === null) die("OTEL_EXPORTER_OTLP_ENDPOINT 未找到或不唯一：" + OTEL_REL);
  otel = blankValue(otel, "OTEL_EXPORTER_OTLP_HEADERS");
  if (otel === null) die("OTEL_EXPORTER_OTLP_HEADERS 未找到或不唯一：" + OTEL_REL);
  if (otel === before) die("OTEL 值未变化 - 已放弃，原文件未动");
  console.log("  OK   OTEL 上报端点已清空");
}
m = applyOnce(m, CRASH_OLD, CRASH_NEW, "崩溃上报开关（远程->本地）");

// ---------------------------------------------------------------- repack ----
log("外科手术式重打包（数据区原样搬运，仅追加改动）...");
const outTmp = asarPath + ".modelhub-new";
fs.rmSync(outTmp, { force: true });
asar.patchEntries(asarPath, outTmp, {
  [PRELOAD_REL]: Buffer.from(p, "utf8"),
  [MAIN_REL]: Buffer.from(m, "utf8"),
  [RENDER_REL]: Buffer.from(r, "utf8"),
  [HOST_REL]: Buffer.from(h, "utf8"),
  [CORE_REL]: Buffer.from(core, "utf8"),
  [OTEL_REL]: Buffer.from(otel, "utf8"),
});
const srcSize = fs.statSync(asarPath).size;
const outSize = fs.statSync(outTmp).size;
if (outSize <= srcSize) { fs.rmSync(outTmp, { force: true }); die("输出比输入小（" + outSize + " <= " + srcSize + "）— 已放弃，原文件未动"); }

// ------------------------------------------------------- read-back verify ---
console.log("[*] 回读验证");
const vBuf = fs.readFileSync(outTmp);
const vhdr = asar.readHeader(vBuf);
function vEntry(rel) {
  let node = vhdr.json;
  for (const part of rel.split("/")) { node = node.files && node.files[part]; if (!node) return null; }
  const off = vhdr.dataOffset + parseInt(node.offset, 10);
  return vBuf.slice(off, off + node.size);
}
const checks = [
  ["preload 桥接", vEntry(PRELOAD_REL).includes("modelhubFetchModels") && vEntry(PRELOAD_REL).includes("modelhubProbeVision")],
  ["main IPC 处理器", vEntry(MAIN_REL).includes("modelhub:fetch-models") && vEntry(MAIN_REL).includes("modelhub:probe-vision")],
  ["renderer 功能块", vEntry(RENDER_REL).includes("__mhPull") && vEntry(RENDER_REL).includes("__mhPick") && vEntry(RENDER_REL).includes("__mhHeaders")],
  ["renderer 按钮行", vEntry(RENDER_REL).includes("请求头模拟") && vEntry(RENDER_REL).includes("拉取模型")],
  ["host 存储初始化修复", vEntry(HOST_REL).includes("storagePreparationEntry:_t?.storagePreparationEntry")],
  ["遥测 ARMS RUM 已关", vEntry(MAIN_REL).includes("Ns.init({enable:!1,")],
  ["遥测 磁盘用量 已关", vEntry(MAIN_REL).includes("function sP(e){return;$u(),Ba=mz({")],
  ["遥测 MCP 已关", vEntry(MAIN_REL).includes("function cP(e,t){return;")],
  ["renderer 档位表", vEntry(RENDER_REL).includes("思考档位表") && vEntry(RENDER_REL).includes("__mhLevels")],
  ["事件上报核心 已关", vEntry(CORE_REL).includes("async function x(C,S,I,k){return;")],
  ["OTEL 端点 已清空", vEntry(OTEL_REL).includes('OTEL_EXPORTER_OTLP_ENDPOINT:""') && vEntry(OTEL_REL).includes('OTEL_EXPORTER_OTLP_HEADERS:""') && !vEntry(OTEL_REL).includes("proj-xtrace")],
  ["崩溃上报 已本地化", vEntry(MAIN_REL).includes("var Vf=Hf(w,!1);")],
];
let allOk = true;
for (const [name, ok] of checks) {
  console.log("  " + (ok ? "OK  " : "FAIL") + " " + name);
  if (!ok) allOk = false;
}
if (!allOk) { fs.rmSync(outTmp, { force: true }); die("回读验证失败 - 已放弃，原文件未动"); }

// ---------------------------------------------------------------- swap ------
log("原子替换中（临时文件 + 校验 + 改名）...");
atomicReplace(outTmp, asarPath, outSize);
fs.rmSync(outTmp, { force: true });

console.log("");
console.log("[√] 补丁安装完成！打开 ZCode：设置 → 模型供应商 → 添加/编辑渠道，即可看到「拉取模型」按钮。");
console.log("    如需还原：运行 还原补丁.cmd");
