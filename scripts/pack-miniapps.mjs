#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_DIR = "miniapps";
const OUT_DIR = "dist/miniapps";
const SKIP_DIRS = new Set(["_sdk"]);
const ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i;
const DOS_EPOCH = { date: (0 << 9) | (1 << 5) | 1, time: 0 };

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split(sep).join(posix.sep));
  }
  return out;
}

export function buildZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_EPOCH.time, 10);
    local.writeUInt16LE(DOS_EPOCH.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const chunk = Buffer.concat([local, nameBuf, packed]);
    locals.push(chunk);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(DOS_EPOCH.time, 12);
    cd.writeUInt16LE(DOS_EPOCH.date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(packed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += chunk.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}

function readManifest(dir) {
  const path = join(dir, "mappmanifest.json");
  if (!existsSync(path)) throw new Error(`${dir}: mappmanifest.json is missing`);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  for (const key of ["id", "name", "version"]) {
    if (typeof manifest[key] !== "string" || !manifest[key]) throw new Error(`${dir}: manifest field "${key}" is required`);
  }
  if (!ID.test(manifest.id)) throw new Error(`${dir}: invalid app id "${manifest.id}"`);
  if (!existsSync(join(dir, "index.html"))) throw new Error(`${dir}: index.html is missing`);
  return manifest;
}

export function packMiniApps({ root = ROOT, outDir = OUT_DIR } = {}) {
  const sourceRoot = join(root, SOURCE_DIR);
  const target = join(root, outDir);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  const apps = [];
  for (const name of readdirSync(sourceRoot).sort()) {
    const dir = join(sourceRoot, name);
    if (SKIP_DIRS.has(name) || !statSync(dir).isDirectory()) continue;
    const manifest = readManifest(dir);
    const entries = listFiles(dir).map((rel) => ({ name: rel, data: readFileSync(join(dir, rel)) }));
    const archive = `${name}.zip`;
    const zip = buildZip(entries);
    writeFileSync(join(target, archive), zip);
    apps.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      permissions: manifest.permissions || [],
      archive,
      size: zip.length,
      sha256: createHash("sha256").update(zip).digest("hex"),
    });
  }

  const ids = apps.map((a) => a.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate app ids in miniapps/");
  writeFileSync(join(target, "index.json"), JSON.stringify({ apps }, null, 2) + "\n");
  return apps;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const apps = packMiniApps();
  for (const app of apps) console.log(`${app.archive}\t${app.version}\t${app.size} B`);
}
