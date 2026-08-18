import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditSkillPackage,
  canonicalSkillPackageBytes,
  readSkillDirectory,
  summarizeSkillPackage,
  validateSkillPackage,
  verifySkillPackages,
} from "../src/index.ts";
import type { SkillPackageEntry } from "../src/model.ts";

const cleanPath = fileURLToPath(new URL("../../../examples/agent-skills/clean-review/", import.meta.url));
const maliciousPath = fileURLToPath(new URL("../../../examples/agent-skills/malicious-sync/", import.meta.url));

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function cloneEntries(entries: readonly SkillPackageEntry[]): SkillPackageEntry[] {
  return entries.map((entry) => ({ path: entry.path, bytes: new Uint8Array(entry.bytes) }));
}

test("canonical skill package is byte-stable regardless of input entry order", () => {
  const a = [
    { path: "SKILL.md", bytes: bytes("skill") },
    { path: "scripts/check.py", bytes: bytes("print('ok')\n") },
  ];
  const b = [...a].reverse();
  assert.deepEqual(canonicalSkillPackageBytes(a), canonicalSkillPackageBytes(b));
  assert.equal(summarizeSkillPackage(a).sha256, summarizeSkillPackage(b).sha256);
});

test("canonical package rejects traversal and duplicate paths", () => {
  assert.throws(() => canonicalSkillPackageBytes([{ path: "../SKILL.md", bytes: bytes("x") }]), /Unsafe/);
  assert.throws(
    () => canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: bytes("a") }, { path: "SKILL.md", bytes: bytes("b") }]),
    /Duplicate/,
  );
});

test("clean fixture follows Agent Skills frontmatter constraints and has no static findings", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const validation = validateSkillPackage(clean.entries, clean.directoryName);
  assert.equal(validation.valid, true);
  assert.equal(validation.metadata?.name, "clean-review");
  assert.equal(validation.metadata?.metadata.author, "proofrail-fixture");
  const audit = auditSkillPackage(clean.entries);
  assert.equal(audit.findingCount, 0);
  assert.equal(audit.highestSeverity, "INFO");
  assert.equal(audit.advisory.status, "NOT_RUN");
});

test("malicious fixture triggers every initial deterministic security rule without execution", async () => {
  const malicious = await readSkillDirectory(maliciousPath);
  const validation = validateSkillPackage(malicious.entries, malicious.directoryName);
  assert.equal(validation.valid, true);
  const audit = auditSkillPackage(malicious.entries);
  const ruleIds = new Set(audit.findings.map((finding) => finding.ruleId));
  for (const ruleId of ["PR-SKILL-001", "PR-SKILL-002", "PR-SKILL-003", "PR-SKILL-004", "PR-SKILL-005", "PR-SKILL-006", "PR-SKILL-007"]) {
    assert.equal(ruleIds.has(ruleId as never), true, `missing ${ruleId}`);
  }
  assert.equal(audit.highestSeverity, "CRITICAL");
  assert.ok(audit.findings.every((finding) => finding.analysisKind === "DETERMINISTIC_STATIC"));
});

test("MATCH and audit risk are independent dimensions", async () => {
  const malicious = await readSkillDirectory(maliciousPath);
  const result = verifySkillPackages({
    publisherEntries: malicious.entries,
    reproducedEntries: cloneEntries(malicious.entries),
    publisherDirectoryName: malicious.directoryName,
    reproducedDirectoryName: malicious.directoryName,
  });
  assert.equal(result.correspondence.status, "MATCH");
  assert.equal(result.audit.highestSeverity, "CRITICAL");
  assert.ok(result.audit.findingCount > 0);
});

test("a one-byte publisher substitution yields MISMATCH without inventing security findings", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const publisher = cloneEntries(clean.entries);
  const skill = publisher.find((entry) => entry.path === "SKILL.md");
  assert.ok(skill);
  skill.bytes = new Uint8Array([...skill.bytes, 0x20]);

  const result = verifySkillPackages({
    publisherEntries: publisher,
    reproducedEntries: clean.entries,
    publisherDirectoryName: clean.directoryName,
    reproducedDirectoryName: clean.directoryName,
  });
  assert.equal(result.correspondence.status, "MISMATCH");
  assert.equal(result.audit.findingCount, 0);
  assert.notEqual(result.publisherPackage.sha256, result.reproducedPackage.sha256);
});

test("format validation is separate from correspondence", () => {
  const entries = [{ path: "SKILL.md", bytes: bytes("---\nname: wrong-name\ndescription: Example skill.\n---\nBody\n") }];
  const validation = validateSkillPackage(entries, "expected-name");
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((item) => item.code === "name_directory_mismatch"));
});
