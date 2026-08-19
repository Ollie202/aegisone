import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { sha256Bytes } from "../../core/src/hash.ts";
import type { SkillPackageEntry, SkillPackageSummary } from "./model.ts";

const HEADER = new TextEncoder().encode("proofrail-agent-skill-package-v1\n");
const MAX_FILE_COUNT = 10_000;
const MAX_PATH_BYTES = 4_096;

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new TypeError(`Invalid skill package path: ${JSON.stringify(value)}`);
  }
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new TypeError(`Unsafe skill package path: ${JSON.stringify(value)}`);
  }
  return normalized;
}

function u32(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) throw new RangeError("u32 overflow");
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function u64(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("u64 unsafe integer");
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), false);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function requireAvailable(bytes: Uint8Array, offset: number, needed: number): void {
  if (!Number.isSafeInteger(needed) || needed < 0 || offset < 0 || offset + needed > bytes.byteLength) {
    throw new TypeError("Truncated or malformed canonical skill package");
  }
}

export function canonicalSkillPackageBytes(entries: readonly SkillPackageEntry[]): Uint8Array {
  const normalized = entries.map((entry) => ({
    path: normalizeRelativePath(entry.path),
    bytes: new Uint8Array(entry.bytes),
  }));
  const seen = new Set<string>();
  for (const entry of normalized) {
    if (seen.has(entry.path)) throw new TypeError(`Duplicate skill package path: ${entry.path}`);
    seen.add(entry.path);
  }
  normalized.sort((a, b) => Buffer.compare(Buffer.from(a.path, "utf8"), Buffer.from(b.path, "utf8")));

  const parts: Uint8Array[] = [HEADER, u32(normalized.length)];
  for (const entry of normalized) {
    const pathBytes = new TextEncoder().encode(entry.path);
    if (pathBytes.byteLength > MAX_PATH_BYTES) throw new TypeError(`Skill package path is too long: ${entry.path}`);
    parts.push(u32(pathBytes.byteLength), u64(entry.bytes.byteLength), pathBytes, entry.bytes);
  }
  return concat(parts);
}

export function decodeCanonicalSkillPackage(bytes: Uint8Array): SkillPackageEntry[] {
  requireAvailable(bytes, 0, HEADER.byteLength + 4);
  for (let index = 0; index < HEADER.byteLength; index += 1) {
    if (bytes[index] !== HEADER[index]) throw new TypeError("Unknown canonical skill package header");
  }
  let offset = HEADER.byteLength;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(offset, false);
  offset += 4;
  if (count > MAX_FILE_COUNT) throw new TypeError(`Skill package file count exceeds ${MAX_FILE_COUNT}`);

  const entries: SkillPackageEntry[] = [];
  const seen = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < count; index += 1) {
    requireAvailable(bytes, offset, 12);
    const pathLength = view.getUint32(offset, false);
    offset += 4;
    const contentLengthBig = view.getBigUint64(offset, false);
    offset += 8;
    if (pathLength === 0 || pathLength > MAX_PATH_BYTES) throw new TypeError("Invalid skill package path length");
    if (contentLengthBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError("Skill package file size exceeds safe integer range");
    const contentLength = Number(contentLengthBig);
    requireAvailable(bytes, offset, pathLength + contentLength);
    let path: string;
    try {
      path = normalizeRelativePath(decoder.decode(bytes.slice(offset, offset + pathLength)));
    } catch (error) {
      throw new TypeError(`Invalid UTF-8 skill package path: ${error instanceof Error ? error.message : String(error)}`);
    }
    offset += pathLength;
    if (seen.has(path)) throw new TypeError(`Duplicate skill package path: ${path}`);
    seen.add(path);
    entries.push({ path, bytes: bytes.slice(offset, offset + contentLength) });
    offset += contentLength;
  }
  if (offset !== bytes.byteLength) throw new TypeError("Canonical skill package contains trailing bytes");
  return entries;
}

export function summarizeSkillPackage(entries: readonly SkillPackageEntry[]): SkillPackageSummary {
  const bytes = canonicalSkillPackageBytes(entries);
  const paths = entries.map((entry) => normalizeRelativePath(entry.path));
  paths.sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
  return {
    format: "proofrail-agent-skill-package-v1",
    fileCount: entries.length,
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes),
    paths,
  };
}

async function walk(root: string, directory: string, out: SkillPackageEntry[]): Promise<void> {
  const items = await readdir(directory, { withFileTypes: true });
  for (const item of items) {
    if (item.name === ".git") continue;
    const absolute = join(directory, item.name);
    if (item.isSymbolicLink()) throw new TypeError(`Symlinks are not supported in skill package v1: ${absolute}`);
    if (item.isDirectory()) {
      await walk(root, absolute, out);
      continue;
    }
    if (!item.isFile()) throw new TypeError(`Unsupported filesystem entry in skill package: ${absolute}`);
    out.push({ path: normalizeRelativePath(relative(root, absolute)), bytes: await readFile(absolute) });
  }
}

export async function readSkillDirectory(skillDirectory: string): Promise<{ directoryName: string; entries: SkillPackageEntry[] }> {
  const root = resolve(skillDirectory);
  const entries: SkillPackageEntry[] = [];
  await walk(root, root, entries);
  return { directoryName: basename(root), entries };
}
