import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readSkillDirectory, verifySkillPackages } from "../../../packages/skill-audit/src/index.ts";
import type { SkillPackageEntry } from "../../../packages/skill-audit/src/model.ts";
import { renderSkillVerificationHtml } from "../src/render-skill.ts";

const cleanPath = fileURLToPath(new URL("../../../examples/agent-skills/clean-review/", import.meta.url));
const maliciousPath = fileURLToPath(new URL("../../../examples/agent-skills/malicious-sync/", import.meta.url));

function clone(entries: readonly SkillPackageEntry[]): SkillPackageEntry[] {
  return entries.map((entry) => ({ path: entry.path, bytes: new Uint8Array(entry.bytes) }));
}

test("web can display MATCH plus critical static findings without calling the skill safe", async () => {
  const skill = await readSkillDirectory(maliciousPath);
  const result = verifySkillPackages({
    publisherEntries: skill.entries,
    reproducedEntries: clone(skill.entries),
    publisherDirectoryName: skill.directoryName,
    reproducedDirectoryName: skill.directoryName,
  });
  const html = renderSkillVerificationHtml(result);
  assert.match(html, />MATCH</);
  assert.match(html, />CRITICAL_FINDINGS</);
  assert.match(html, /does not mean the skill is safe or benevolent/);
  assert.match(html, /PR-SKILL-001/);
  assert.match(html, /LLM advisory analysis: <strong>NOT RUN<\/strong>/);
});

test("web can display MISMATCH plus no deterministic findings", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const publisher = clone(clean.entries);
  const skillMd = publisher.find((entry) => entry.path === "SKILL.md");
  assert.ok(skillMd);
  skillMd.bytes = new Uint8Array([...skillMd.bytes, 0x20]);
  const result = verifySkillPackages({
    publisherEntries: publisher,
    reproducedEntries: clean.entries,
    publisherDirectoryName: clean.directoryName,
    reproducedDirectoryName: clean.directoryName,
  });
  const html = renderSkillVerificationHtml(result);
  assert.match(html, />MISMATCH</);
  assert.match(html, />NO_FINDINGS</);
});

test("web rejects a correspondence verdict that disagrees with package digests", async () => {
  const clean = await readSkillDirectory(cleanPath);
  const result = verifySkillPackages({
    publisherEntries: clean.entries,
    reproducedEntries: clean.entries,
    publisherDirectoryName: clean.directoryName,
    reproducedDirectoryName: clean.directoryName,
  });
  result.correspondence.status = "MISMATCH";
  assert.throws(() => renderSkillVerificationHtml(result), /status does not match package digests/);
});
