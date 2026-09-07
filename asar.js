"use strict";
// Minimal asar reader/writer - no dependencies. Compatible with @electron/asar format.
const fs = require("fs");
const path = require("path");

function readHeader(buf) {
  const headerPickleSize = buf.readUInt32LE(4);
  const payloadSize = buf.readUInt32LE(8);
  const strLen = buf.readUInt32LE(12);
  const json = buf.slice(16, 16 + strLen).toString("utf8");
  return { json: JSON.parse(json), dataOffset: 8 + headerPickleSize, _payloadSize: payloadSize };
}

function extract(archive, dest) {
  const buf = fs.readFileSync(archive);
  const { json, dataOffset } = readHeader(buf);
  fs.rmSync(dest, { recursive: true, force: true });
  const unpacked = [];
  const walk2 = (node, rel) => {
    for (const [name, f] of Object.entries(node.files || {})) {
      const p = path.join(dest, rel, name);
      if (f.files) {
        fs.mkdirSync(p, { recursive: true });
        walk2(f, path.join(rel, name));
      } else if (f.unpacked) {
        const src = archive + ".unpacked" + path.sep + path.join(rel, name);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.copyFileSync(src, p);
        unpacked.push(path.join(rel, name).split(path.sep).join("/"));
      } else {
        const off = dataOffset + parseInt(f.offset, 10);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, buf.slice(off, off + f.size));
      }
    }
  };
  walk2(json, "");
  return { unpacked };
}

function pack(srcDir, outFile, unpackedSet) {
  const skip = new Set(unpackedSet || []);
  const files = [];
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(srcDir, rel))) {
      const relPath = path.join(rel, name);
      const full = path.join(srcDir, relPath);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(relPath);
      else files.push({ rel: relPath.split(path.sep).join("/"), size: st.size, full });
    }
  };
  walk("");
  files.sort((a, b) => (a.rel < b.rel ? -1 : 1));

  let offset = 0;
  const tree = { files: {} };
  const dataFiles = [];
  for (const f of files) {
    const parts = f.rel.split("/");
    let node = tree.files;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] || { files: {} };
      node = node[parts[i]].files;
    }
    if (skip.has(f.rel)) {
      node[parts[parts.length - 1]] = { size: f.size, unpacked: true };
    } else {
      node[parts[parts.length - 1]] = { size: f.size, offset: String(offset) };
      f.offset = offset;
      offset += f.size;
      dataFiles.push(f);
    }
  }

  const json = JSON.stringify(tree);
  const jsonBuf = Buffer.from(json, "utf8");
  // header pickle payload: uint32 strlen + json, padded to 4
  const pad = (4 - (jsonBuf.length % 4)) % 4;
  const payload = Buffer.alloc(4 + jsonBuf.length + pad);
  payload.writeUInt32LE(jsonBuf.length, 0);
  jsonBuf.copy(payload, 4);
  // header pickle = uint32 payloadSize + payload
  const headerPickle = Buffer.alloc(4 + payload.length);
  headerPickle.writeUInt32LE(payload.length, 0);
  payload.copy(headerPickle, 4);
  // file = uint32(4) + headerPickle + data
  const prefix = Buffer.alloc(8);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerPickle.length, 4);

  const out = fs.openSync(outFile, "w");
  fs.writeSync(out, prefix);
  fs.writeSync(out, headerPickle);
  const dataStart = prefix.length + headerPickle.length;
  const wbuf = Buffer.alloc(1024 * 1024);
  for (const f of dataFiles) {
    const fd = fs.openSync(f.full, "r");
    let read = 0;
    while (read < f.size) {
      const n = fs.readSync(fd, wbuf, 0, Math.min(wbuf.length, f.size - read));
      fs.writeSync(out, wbuf, 0, n);
      read += n;
    }
    fs.closeSync(fd);
  }
  fs.closeSync(out);
  // mirror unpacked files beside the archive
  for (const f of files) {
    if (!skip.has(f.rel)) continue;
    const dst = outFile + ".unpacked" + path.sep + f.rel.split("/").join(path.sep);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f.full, dst);
  }
  return { dataStart, count: files.length };
}

function readEntry(archive, relPath) {
  const buf = fs.readFileSync(archive);
  const { json, dataOffset } = readHeader(buf);
  let node = json;
  for (const part of relPath.split("/")) { node = node.files && node.files[part]; if (!node) return null; }
  if (node.files || node.unpacked) return null;
  const off = dataOffset + parseInt(node.offset, 10);
  return buf.slice(off, off + node.size);
}

// Surgical repackage: keep original data region byte-for-byte, replace only given entries
// (appended after the data region), rewrite header. unpacked entries untouched.
function patchEntries(archive, outFile, patchMap) {
  const src = fs.readFileSync(archive);
  const { json, dataOffset } = readHeader(src);
  const tree = JSON.parse(JSON.stringify(json));
  const dataLen = src.length - dataOffset;
  let appendAt = dataLen;
  for (const [rel, content] of Object.entries(patchMap)) {
    const parts = rel.split("/");
    let node = tree;
    for (const part of parts) { node = node.files; if (!node) throw new Error("missing dir: " + rel); node = node[part]; if (!node) throw new Error("missing entry: " + rel); }
    node.size = content.length;
    delete node.integrity;
    node.offset = String(appendAt);
    appendAt += content.length;
  }
  const outJson = Buffer.from(JSON.stringify(tree), "utf8");
  const pad = (4 - (outJson.length % 4)) % 4;
  const payload = Buffer.alloc(4 + outJson.length + pad);
  payload.writeUInt32LE(outJson.length, 0);
  outJson.copy(payload, 4);
  const headerPickle = Buffer.alloc(4 + payload.length);
  headerPickle.writeUInt32LE(payload.length, 0);
  payload.copy(headerPickle, 4);
  const prefix = Buffer.alloc(8);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerPickle.length, 4);

  const out = fs.openSync(outFile, "w");
  fs.writeSync(out, prefix); fs.writeSync(out, headerPickle);
  // original data region verbatim
  {
    const fd = fs.openSync(archive, "r");
    const CH = 4 * 1024 * 1024, wbuf = Buffer.alloc(CH);
    let remaining = src.length - dataOffset, target = prefix.length + headerPickle.length, readPos = dataOffset;
    while (remaining > 0) {
      const n = fs.readSync(fd, wbuf, 0, Math.min(CH, remaining), readPos);
      fs.writeSync(out, wbuf, 0, n, target);
      readPos += n; target += n; remaining -= n;
    }
    fs.closeSync(fd);
  }
  // patched entries appended after the data region
  {
    let ap = dataLen;
    for (const [, content] of Object.entries(patchMap)) {
      fs.writeSync(out, content, 0, content.length, prefix.length + headerPickle.length + ap);
      ap += content.length;
    }
  }
  fs.closeSync(out);
  return { appended: Object.keys(patchMap).length };
}

module.exports = { extract, pack, readHeader, readEntry, patchEntries };
