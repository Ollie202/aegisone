import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { SkillLibraryLoader } from "../src/library.ts";
import { seedCleanReviewSkill, seedMaliciousSyncSkill } from "../src/library-seed-fixtures.ts";

/**
 * Pins the *real* evidence values the two newly-seeded Agent Skill fixtures carry (PR 2/4,
 * ADR-017 section 4). Both digests/audit results were produced by running the repository's own
 * unmodified `canonicalSkillPackageBytes`/`auditSkillPackage`/`validateSkillPackage` over
 * `examples/agent-skills/clean-review` and `examples/agent-skills/malicious-sync`; pinning them
 * here means an accidental edit to either fixture fails loudly instead of silently changing what
 * the UI presents as evidence.
 */

// These are the digests of the committed LF bytes — the same bytes Linux CI and production read.
// `.gitattributes` marks `examples/agent-skills/** -text` so a Windows checkout is handed those
// identical bytes rather than a CRLF-normalised copy, which would otherwise hash differently here
// than in CI and make the digest the UI presents as evidence platform-dependent.
const CLEAN_REVIEW_PACKAGE_SHA256 = "5bf754ab6273fadfb7fe358d9b41a8ef15160dbe7e7efb0df4c63cf780db0434";
const MALICIOUS_SYNC_PACKAGE_SHA256 = "1b7100fbe4b58bedcc00f83067e60fffd124fce506703cea1a72aaafbc430799";

test("clean-review is a genuinely well-formed SKILL.md package that audits CLEAN", async () => {
  const store = new InMemoryCatalogStore();
  const seeded = await seedCleanReviewSkill(store);

  assert.equal(seeded.packageSha256, CLEAN_REVIEW_PACKAGE_SHA256);
  assert.equal(seeded.formatValidation.valid, true);
  assert.equal(seeded.formatValidation.metadata?.name, "clean-review");
  assert.equal(seeded.auditHighestSeverity, "INFO");
  assert.equal(seeded.auditFindingCount, 0);
});

test("malicious-sync is a genuinely well-formed SKILL.md package that audits CRITICAL", async () => {
  const store = new InMemoryCatalogStore();
  const seeded = await seedMaliciousSyncSkill(store);

  assert.equal(seeded.packageSha256, MALICIOUS_SYNC_PACKAGE_SHA256);
  // Even a fixture explicitly labelled "do not execute" and "security-test-only" is still a
  // valid Agent Skill package structurally — format validity and security assessment are
  // independent dimensions (AGENTS.md).
  assert.equal(seeded.formatValidation.valid, true);
  assert.equal(seeded.formatValidation.metadata?.name, "malicious-sync");
  assert.equal(seeded.auditHighestSeverity, "CRITICAL");
  assert.ok(seeded.auditFindingCount >= 6, "expected multiple genuine deterministic findings");
});

test("both fixtures persist as repository fixtures with no source claim and no correspondence claim", async () => {
  const store = new InMemoryCatalogStore();
  const cleanSeed = await seedCleanReviewSkill(store);
  const maliciousSeed = await seedMaliciousSyncSkill(store);

  const library = await new SkillLibraryLoader(store).load();

  const cleanEntry = library.entries.find((entry) => entry.resourceId === cleanSeed.resourceId);
  const maliciousEntry = library.entries.find((entry) => entry.resourceId === maliciousSeed.resourceId);
  assert.ok(cleanEntry, "expected clean-review in the library");
  assert.ok(maliciousEntry, "expected malicious-sync in the library");

  for (const entry of [cleanEntry!, maliciousEntry!]) {
    // No claimed external repository/commit was made for an inline repository fixture, so
    // source assurance/inspection/correspondence stay honestly absent — only security is real.
    assert.equal(entry.trust.sourceAssurance.level, "NONE");
    assert.equal(entry.trust.sourceInspection.status, "NOT_RUN");
    assert.equal(entry.trust.correspondence.status, "NOT_EVALUATED");
    assert.equal(entry.trust.correspondence.publisherSha256, null);
    assert.equal(entry.trust.correspondence.reproducedSha256, null);
    assert.equal(entry.trust.canonicalEvidence.status, "NONE");
    assert.equal(entry.trust.security.status, "COMPLETED");
  }

  assert.equal(cleanEntry!.trust.security.highestSeverity, "INFO");
  assert.equal(cleanEntry!.trust.security.findingCount, 0);
  assert.equal(maliciousEntry!.trust.security.highestSeverity, "CRITICAL");
  assert.ok((maliciousEntry!.trust.security.findingCount ?? 0) >= 6);
});
