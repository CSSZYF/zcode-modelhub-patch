"use strict";
// ============================================================================
// model-hub engine patch (optional): allow editing ALL user messages,
// not just the latest one. Patches resources/glm/zcode.cjs:
//   P1 projector - canEdit for every userInput row that has an edit target
//   P2 resolver  - drop the "must be current editable entity" check
//
// Usage:
//   node engine-patch.js                    patch the auto-detected live install
//   node engine-patch.js <zcode.cjs path>   patch an explicit file (dry run / test)
//   node engine-patch.js --check            report anchor counts only, no writes
// ============================================================================
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
let file = args.find((a) => !a.startsWith("--"));

function findResources() {
  const cands = [];
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
  return cands;
}

if (!file) {
  const hit = findResources().map((d) => path.join(d, "glm", "zcode.cjs")).find((c) => fs.existsSync(c));
  if (!hit) {
    console.error("[!] 未找到 zcode.cjs - 引擎补丁跳过（全消息可编辑不可用）");
    process.exit(0);
  }
  file = hit;
}
if (!fs.existsSync(file)) { console.error("[x] 文件不存在: " + file); process.exit(1); }

// P1 variants (minified loop variable shifts between builds): 3.14.3 -> E, 3.14.0/3.14.1 -> A
const P1_VARIANTS = [
  ["E", 'else if(E.kind==="userInput")E.rowId===w?(R.canEdit=!0,R.editDisposition="rewind"):(delete R.canEdit,delete R.editDisposition);'],
  ["A", 'else if(A.kind==="userInput")A.rowId===w?(R.canEdit=!0,R.editDisposition="rewind"):(delete R.canEdit,delete R.editDisposition);'],
];
function p1New(v) {
  return 'else if(' + v + '.kind==="userInput")this.entityIdByRowId.get(' + v + '.rowId)&&this.editTargetByEntityId.has(this.entityIdByRowId.get(' + v + '.rowId))&&this.messageIdByRowId.has(' + v + '.rowId)?(R.canEdit=!0,R.editDisposition="rewind"):(delete R.canEdit,delete R.editDisposition);';
}
const P2_OLD =
  "resolveEditTargetByEntityId(t){if(t!==this.currentEditableEntityId)return null;let n=this.editTargetByEntityId.get(t);";
const P2_NEW = "resolveEditTargetByEntityId(t){let n=this.editTargetByEntityId.get(t);";

let src = fs.readFileSync(file, "utf8");
console.log("[*] 引擎: " + file + " (" + src.length + " 字节)");
for (const [v, oldS] of P1_VARIANTS) console.log("  P1(" + v + ") 锚点: " + (src.split(oldS).length - 1));
console.log("  P2 解析器 锚点: " + (src.split(P2_OLD).length - 1));
if (checkOnly) process.exit(0);

// already fully applied? -> nothing to do (do not touch the backup)
const appliedP1 = P1_VARIANTS.find(([v]) => src.includes(p1New(v)));
if (appliedP1 && src.includes(P2_NEW)) {
  console.log("  SKIP 引擎补丁已应用，无需重复安装");
  process.exit(0);
}

const hit = P1_VARIANTS.find(([, oldS]) => src.split(oldS).length - 1 === 1);
if (!hit) {
  console.error("[x] P1 锚点未命中任何已知变体（3.14.3=E / 3.14.0-1=A）。当前 ZCode 版本尚未适配，已放弃修改，原文件未动。");
  process.exit(1);
}
{
  const n = src.split(P2_OLD).length - 1;
  if (n !== 1 && !src.includes(P2_NEW)) {
    console.error("[x] P2 锚点不匹配: 找到 " + n + " 处（应为 1）。原文件未动。");
    process.exit(1);
  }
}

// backup the pristine file (refreshed each time we are about to modify it)
{
  const backup = file + ".modelhub-backup";
  const bt = backup + ".tmp";
  fs.rmSync(bt, { force: true });
  fs.copyFileSync(file, bt);
  if (fs.statSync(bt).size !== fs.statSync(file).size) { fs.rmSync(bt, { force: true }); console.error("[x] 备份校验失败 - 已放弃，原文件未动"); process.exit(1); }
  fs.renameSync(bt, backup);
  console.log("[*] 备份原版 -> zcode.cjs.modelhub-backup");
}

let s = src.replace(hit[1], p1New(hit[0]));
console.log("  OK   P1 投影器（变体 " + hit[0] + "）");
{
  const n = s.split(P2_OLD).length - 1;
  if (n === 1) { s = s.replace(P2_OLD, P2_NEW); console.log("  OK   P2 解析器"); }
  else if (s.includes(P2_NEW)) console.log("  SKIP P2 解析器（已应用）");
  else { console.error("[x] P2 锚点不匹配。原文件未动。"); process.exit(1); }
}

const tmp = file + ".modelhub-tmp.cjs";
fs.writeFileSync(tmp, s, "utf8");
try {
  require("child_process").execSync('node --check "' + tmp + '"', { stdio: "pipe" });
} catch (e) {
  fs.rmSync(tmp, { force: true });
  console.error("[x] 语法检查未通过 - 原文件未动，未做任何修改");
  process.exit(1);
}
fs.renameSync(tmp, file);
console.log("[√] 引擎补丁已应用（语法检查通过）：现在可以编辑任意历史消息。");
