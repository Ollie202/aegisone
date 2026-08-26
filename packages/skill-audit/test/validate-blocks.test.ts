import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSkillPackage } from "../src/validate.ts";

const enc = new TextEncoder();

test("SKILL.md accepts folded and literal YAML block scalar fields", () => {
  const source = `---
name: block-skill
description: >
  Review repository changes
  and explain important risks.
compatibility: |-
  Requires git.
  Works offline.
metadata:
  author: aegisone
---
# Block Skill
`;
  const validation = validateSkillPackage([{ path: "SKILL.md", bytes: enc.encode(source) }], "block-skill");
  assert.equal(validation.valid, true, JSON.stringify(validation.issues));
  assert.equal(validation.metadata?.description, "Review repository changes and explain important risks.\n");
  assert.equal(validation.metadata?.compatibility, "Requires git.\nWorks offline.");
  assert.equal(validation.metadata?.metadata.author, "aegisone");
});
