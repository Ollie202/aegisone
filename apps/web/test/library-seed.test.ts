import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { SkillLibraryLoader } from "../src/library.ts";
import {
  COOKBOOK_COMMIT_SHA,
  COOKBOOK_FILE_PATH,
  computeCookbookSkillEvidence,
  seedCookbookSkill,
} from "../src/library-seed.ts";

/**
 * Pins the *real* evidence values the seeded library resource carries (ADR-016).
 *
 * These digests are not decoration: they are rendered to users as evidence. Pinning them here
 * means an accidental edit to the committed fixture — or a Git line-ending normalisation slipping
 * past `.gitattributes` — fails loudly in CI instead of silently changing what the UI claims.
 *
 * Values were produced by running the repository's own unmodified `canonicalSkillPackageBytes` /
 * `sha256Bytes` / `auditSkillPackage` / `validateSkillPackage` over the bytes of
 * `frontend_design/playful_neo_brutalist_web.md` at commit
 * `1471116222dfe959f091f3d5818993edd968d57c` of `Ollie202/goat_cookbook`.
 */

const EXPECTED_FILE_SHA256 = "00bebc7df532b47ba9e70319c4058e7725241ed7749c81b3f88ab93265b7c398";
const EXPECTED_PACKAGE_SHA256 = "5ae591eac9078b26f243675f721456485f85ecf3737ac36ffa565eca87df685a";

test("the committed cookbook fixture hashes to its real pinned digests", async () => {
  const evidence = await computeCookbookSkillEvidence();
  assert.equal(evidence.sourceSnapshotSha256, EXPECTED_FILE_SHA256);
  assert.equal(evidence.packageSha256, EXPECTED_PACKAGE_SHA256);
  // Packaged verbatim at its real repository path — never renamed to SKILL.md.
  assert.equal(evidence.entries.length, 1);
  assert.equal(evidence.entries[0]!.path, COOKBOOK_FILE_PATH);
});

test("the real deterministic audit result is INFO with zero findings, and is not called safe", async () => {
  const evidence = await computeCookbookSkillEvidence();
  assert.equal(evidence.audit.highestSeverity, "INFO");
  assert.equal(evidence.audit.findingCount, 0);
  assert.deepEqual(evidence.audit.findings, []);
  // The LLM advisory tier was not run, and must be reported as such rather than omitted.
  assert.equal(evidence.audit.advisory.status, "NOT_RUN");
});

test("format validation genuinely FAILS — no wrapping was applied to manufacture a pass", async () => {
  const evidence = await computeCookbookSkillEvidence();
  assert.equal(evidence.formatValidation.valid, false);
  assert.equal(evidence.formatValidation.issues[0]?.code, "missing_skill_md");
  // If someone later "fixes" this by renaming the file to SKILL.md or synthesising frontmatter,
  // that is a fabricated validation result and this assertion must stop them.
  assert.equal(evidence.entries.some((entry) => entry.path === "SKILL.md"), false);
});

test("the seeded resource persists exactly the conservative trust dimensions it can prove", async () => {
  const store = new InMemoryCatalogStore();
  const seeded = await seedCookbookSkill(store);

  const library = await new SkillLibraryLoader(store).load();
  const entry = library.entries.find((item) => item.resourceId === seeded.resourceId);
  assert.ok(entry, "expected the seeded cookbook skill in the library");

  // Source assurance: DECLARED only. Never REPOSITORY_AUTHENTICATED — no authority was proven.
  assert.equal(entry.trust.sourceAssurance.level, "DECLARED");
  // Source inspection: real, at the exact immutable commit.
  assert.equal(entry.trust.sourceInspection.status, "INSPECTED");
  assert.equal(entry.trust.sourceInspection.exactCommitSha, COOKBOOK_COMMIT_SHA);
  assert.equal(entry.trust.sourceInspection.sourceSnapshotSha256, EXPECTED_FILE_SHA256);
  // Correspondence: honestly unevaluated, with no digests — there is no distinct distributed
  // artifact, and hashing the same source twice is not correspondence proof (AGENTS.md).
  assert.equal(entry.trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(entry.trust.correspondence.publisherSha256, null);
  assert.equal(entry.trust.correspondence.reproducedSha256, null);
  // Security: the genuine audit result.
  assert.equal(entry.trust.security.status, "COMPLETED");
  assert.equal(entry.trust.security.highestSeverity, "INFO");
  assert.equal(entry.trust.security.findingCount, 0);
  // Nothing was written to 0G, so canonical evidence and the storage root stay absent.
  assert.equal(entry.trust.canonicalEvidence.status, "NONE");
  assert.equal(entry.trust.canonicalEvidence.storageRoot, null);

  // The real content hash and the real (failing) format validation are carried for display.
  assert.equal(entry.contentSha256, EXPECTED_PACKAGE_SHA256);
  assert.equal(entry.formatValidation?.valid, false);
  // Genuinely available author metadata, derived from the declared repository owner.
  assert.equal(entry.publisherLabel, "Ollie202");
  assert.equal(entry.category.id, "frontend-design");
});

test("a failed seed degrades to an empty library rather than inventing entries", async () => {
  const broken = {
    async upsertDiscoveredResource() {
      throw new Error("catalog unavailable");
    },
  } as unknown as InMemoryCatalogStore;
  const library = await new SkillLibraryLoader(broken).load();
  assert.deepEqual(library.entries, []);
  assert.deepEqual(library.counts, {});
});
