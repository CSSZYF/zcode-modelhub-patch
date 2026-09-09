"use strict";
// Engine patch: allow editing ALL user messages (not just the latest).
// Patches glm/zcode.cjs:
//   P1 projector - canEdit for every userInput row that has an edit target
//   P2 resolver  - drop the "must be current editable entity" check
const fs = require("fs");

const path=require("path");
let file=process.argv[2];
if(!file){
  const cands=[];
  const pf=process.env.ProgramFiles||"C:\\Program Files";
  const lad=process.env.LOCALAPPDATA;
  if(lad)cands.push(path.join(lad,"Programs","ZCode","resources","glm","zcode.cjs"));
  cands.push(path.join(pf,"ZCode","resources","glm","zcode.cjs"));
  file=cands.find(c=>fs.existsSync(c));
  if(!file){console.error("[!] zcode.cjs not found - engine patch skipped (edit-all-messages disabled)");process.exit(0)}
}
if (!file) { console.error("usage: node engine-patch.js <path-to-zcode.cjs>"); process.exit(1); }

const P1_OLD = 'else if(y.kind==="userInput")y.rowId===m?(v.canEdit=!0,v.editDisposition="rewind"):(delete v.canEdit,delete v.editDisposition)';
const P1_NEW = 'else if(y.kind==="userInput")this.entityIdByRowId.get(y.rowId)&&this.editTargetByEntityId.has(this.entityIdByRowId.get(y.rowId))&&this.messageIdByRowId.has(y.rowId)?(v.canEdit=!0,v.editDisposition="rewind"):(delete v.canEdit,delete v.editDisposition)';
const P2_OLD = "resolveEditTargetByEntityId(t){if(t!==this.currentEditableEntityId)return null;let r=this.editTargetByEntityId.get(t);";
const P2_NEW = "resolveEditTargetByEntityId(t){let r=this.editTargetByEntityId.get(t);";

const backup = file + ".modelhub-backup";
if (!fs.existsSync(backup)) {
  const bt = backup + ".tmp";
  fs.copyFileSync(file, bt);
  if (fs.statSync(bt).size !== fs.statSync(file).size) { fs.rmSync(bt, { force: true }); console.error("FAIL backup verify - aborting, nothing changed"); process.exit(1); }
  fs.renameSync(bt, backup);
}
let src = fs.readFileSync(file, "utf8");

for (const [label, oldS, newS] of [["P1", P1_OLD, P1_NEW], ["P2", P2_OLD, P2_NEW]]) {
  const n = src.split(oldS).length - 1;
  if (n === 1) { src = src.replace(oldS, newS); console.log(`OK   ${label} applied`); }
  else if (n === 0 && src.includes(newS)) console.log(`SKIP ${label} already applied`);
  else { console.error(`FAIL ${label}: anchor count = ${n}`); process.exit(1); }
}

const tmp = file + ".modelhub-tmp.cjs";
fs.writeFileSync(tmp, src, "utf8");
try {
  require("child_process").execSync(`node --check "${tmp}"`, { stdio: "pipe" });
} catch (e) {
  fs.rmSync(tmp, { force: true });
  console.error("FAIL syntax check on patched engine - original untouched, nothing changed");
  process.exit(1);
}
fs.renameSync(tmp, file);
console.log("ENGINE_PATCH_DONE");
