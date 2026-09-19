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

const P1_OLD =
  'else if(A.kind==="userInput")A.rowId===w?(R.canEdit=!0,R.editDisposition="rewind"):(delete R.canEdit,delete R.editDisposition);';
const P1_NEW =
  'else if(A.kind==="userInput")this.entityIdByRowId.get(A.rowId)&&this.editTargetByEntityId.has(this.entityIdByRowId.get(A.rowId))&&this.messageIdByRowId.has(A.rowId)?(R.canEdit=!0,R.editDisposition="rewind"):(delete R.canEdit,delete R.editDisposition);';
const P2_OLD =
  "resolveEditTargetByEntityId(t){if(t!==this.currentEditableEntityId)return null;let n=this.editTargetByEntityId.get(t);";
const P2_NEW = "resolveEditTargetByEntityId(t){let n=this.editTargetByEntityId.get(t);";

let src = fs.readFileSync(file, "utf8");
console.log("[*] 引擎: " + file + " (" + src.length + " 字节)");
for (const [label, oldS] of [["P1 投影器", P1_OLD], ["P2 解析器", P2_OLD]]) {
  console.log("  " + label + " 锚点: " + (src.split(oldS).length - 1));
}
if (checkOnly) process.exit(0);

const bothApplied = src.includes(P1_NEW) && src.includes(P2_NEW);
if (bothApplied) {
  console.log("  SKIP 引擎补丁已应用，无需重复安装");
  process.exit(0);
}

for (const [label, oldS, newS] of [["P1 投影器", P1_OLD, P1_NEW], ["P2 解析器", P2_OLD, P2_NEW]]) {
  const n = src.split(oldS).length - 1;
  if (n !== 1 && !(n === 0 && src.includes(newS))) {
    console.error("[x] 锚点不匹配 [" + label + "]: 找到 " + n + " 处（应为 1）。当前 ZCode 版本尚未适配，已放弃修改，原文件未动。");
    process.exit(1);
  }
}

const backup = file + ".modelhub-backup";
{
  const bt = backup + ".tmp";
  fs.rmSync(bt, { force: true });
  fs.copyFileSync(file, bt);
  if (fs.statSync(bt).size !== fs.statSync(file).size) { fs.rmSync(bt, { force: true }); console.error("[x] 备份校验失败 - 已放弃，原文件未动"); process.exit(1); }
  fs.renameSync(bt, backup);
  console.log("[*] 备份原版 -> zcode.cjs.modelhub-backup");
}

for (const [label, oldS, newS] of [["P1 投影器", P1_OLD, P1_NEW], ["P2 解析器", P2_OLD, P2_NEW]]) {
  const n = src.split(oldS).length - 1;
  if (n === 1) { src = src.replace(oldS, newS); console.log("  OK   " + label); }
  else if (src.includes(newS)) console.log("  SKIP " + label + "（已应用）");
  else { console.error("[x] 锚点不匹配 [" + label + "]: 找到 " + n + " 处。原文件未动。"); process.exit(1); }
}

const tmp = file + ".modelhub-tmp.cjs";
fs.writeFileSync(tmp, src, "utf8");
try {
  require("child_process").execSync('node --check "' + tmp + '"', { stdio: "pipe" });
} catch (e) {
  fs.rmSync(tmp, { force: true });
  console.error("[x] 语法检查未通过 - 原文件未动，未做任何修改");
  process.exit(1);
}
fs.renameSync(tmp, file);
console.log("[√] 引擎补丁已应用（语法检查通过）：现在可以编辑任意历史消息。");
