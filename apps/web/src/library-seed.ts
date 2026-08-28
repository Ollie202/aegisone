import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha256Bytes } from "../../../packages/core/src/hash.ts";
import { canonicalSkillPackageBytes } from "../../../packages/skill-audit/src/package.ts";
import { auditSkillPackage } from "../../../packages/skill-audit/src/audit.ts";
import { validateSkillPackage } from "../../../packages/skill-audit/src/validate.ts";
import type { SkillFormatValidation, SkillPackageEntry } from "../../../packages/skill-audit/src/model.ts";
import { buildCanonicalSourceClaim, computeSourceClaimDigest } from "../../../packages/source-auth-github/src/index.ts";
import type { CatalogStore, NewCapabilityVerification, NewSourceClaim } from "../../../packages/catalog-store/src/index.ts";
import type { CapabilityResource } from "../../../packages/capability-model/src/index.ts";

/**
 * The AegisOne skill library's real seed resource (ADR-016).
 *
 * ==========================================================================================
 * WHAT THIS IS, AND WHAT WAS AND WAS NOT DONE TO IT
 * ==========================================================================================
 * This seeds exactly one real, non-fixture resource: the repo owner's own published design
 * document from `Ollie202/goat_cookbook`, pinned to the exact immutable commit
 * `1471116222dfe959f091f3d5818993edd968d57c` (AGENTS.md: "Always pin source/build/security claims
 * to immutable commit SHAs; never use a mutable branch name as a security claim").
 *
 * The file's real bytes are committed verbatim at `apps/web/fixtures/goat-cookbook/` so every
 * digest below is reproducible offline and in CI with no network call, and `.gitattributes` marks
 * that path `-text` so Git cannot rewrite its line endings and silently change the digest between
 * a Windows checkout and Linux CI.
 *
 * Every value this module persists is COMPUTED AT RUNTIME from those bytes by the existing,
 * unmodified production functions — `canonicalSkillPackageBytes`, `sha256Bytes`,
 * `auditSkillPackage`, `validateSkillPackage`. Nothing is a literal digest, finding, verdict or
 * evidence value copied from anywhere. `apps/web/test/library-seed.test.ts` pins the expected
 * digests so a fixture edit fails loudly instead of quietly changing displayed evidence.
 *
 * ------------------------------------------------------------------------------------------
 * THE HONEST NUANCE: this is a design guide, not a valid Agent Skill package.
 * ------------------------------------------------------------------------------------------
 * `playful_neo_brutalist_web.md` is prose documentation. It has no YAML frontmatter and it is not
 * named `SKILL.md`, so `validateSkillPackage` genuinely REJECTS it with `missing_skill_md`.
 *
 * **No wrapping of any kind was applied.** The file is packaged verbatim, alone, at its real
 * repository path (`frontend_design/playful_neo_brutalist_web.md`). It was deliberately not
 * renamed to `SKILL.md`, not given synthesised frontmatter, and not paired with a generated
 * sibling file — any of which would have manufactured a passing validation that is not true.
 * The real failing validation result is persisted and rendered as its own visible dimension
 * (`skillFormatBadge`), because "this is not a valid Agent Skill package" is a plain fact about
 * the file's structure, and stating it is the product working correctly.
 *
 * ------------------------------------------------------------------------------------------
 * WHY EACH TRUST DIMENSION IS SET THE WAY IT IS (all four are deliberately conservative)
 * ------------------------------------------------------------------------------------------
 * - sourceAssurance = DECLARED. An explicit source mapping was supplied by this deployment's
 *   operator; nobody has proven GitHub repository authority for it through the M8.5 flow. It is
 *   NOT `REPOSITORY_AUTHENTICATED`, even though the repo owner happens to also own the cookbook
 *   repository — authority that was never actually proven is not evidence (AGENTS.md).
 *
 * - sourceInspection = INSPECTED, with a real `sourceSnapshotSha256`. The exact claimed source
 *   revision really was fetched at that exact commit and hashed. Inspection is not authority and
 *   is not correspondence.
 *
 * - correspondence = NOT_EVALUATED, with null digests. There is no distinct *distributed*
 *   artifact for this document — there is only the source file. AGENTS.md is explicit: "`MATCH`
 *   requires a distinct distributed/publisher artifact compared with an independent exact-source
 *   reproduction. Do not package the same source twice and call that correspondence proof."
 *   Hashing this file into a package and comparing it to itself would be exactly that, so
 *   correspondence stays honestly unevaluated.
 *
 * - security = COMPLETED, carrying whatever `auditSkillPackage` really returned. At the pinned
 *   commit that is `INFO` / 0 findings. Zero findings is NOT a safety claim; it means the
 *   deterministic ruleset matched nothing, and the UI says so.
 *
 * - canonicalEvidence = NONE, and no 0G Storage root. Nothing about this resource was written to
 *   0G, so no canonical evidence pointer or storage root is recorded. Missing evidence stays
 *   missing rather than being invented to make the row look complete.
 */

/** The exact immutable commit the fixture bytes were fetched at. Resolved via
 * `gh api repos/Ollie202/goat_cookbook/commits?path=frontend_design/playful_neo_brutalist_web.md`. */
export const COOKBOOK_COMMIT_SHA = "1471116222dfe959f091f3d5818993edd968d57c";
export const COOKBOOK_REPOSITORY = "Ollie202/goat_cookbook";
export const COOKBOOK_REPOSITORY_URL = `https://github.com/${COOKBOOK_REPOSITORY}`;
/** The file's real path inside that repository — also the path it is packaged under, unmodified. */
export const COOKBOOK_FILE_PATH = "frontend_design/playful_neo_brutalist_web.md";

const FIXTURE_URL = new URL("../fixtures/goat-cookbook/playful_neo_brutalist_web.md", import.meta.url);

/** Stable catalog identity. `aegisone-curated` is a truthful provider id: this row was seeded by
 * this repository as a curated library entry, not returned by a discovery provider. */
const RESOURCE_ID = "aegisone-curated:goat-cookbook/playful-neo-brutalist-web";
const PROVIDER_RESOURCE_ID = `${COOKBOOK_REPOSITORY}:${COOKBOOK_FILE_PATH}`;

const NAME = "Playful Neo-Brutalist Web Design";
const DESCRIPTION =
  "A reusable frontend design system for bold editorial interfaces: neo-brutalist linework, Memphis-style graphics, oversized typography, flat colour fields and controlled anti-grid layout. Published as a markdown design guide, not as a packaged Agent Skill.";

export interface CookbookSeedResult {
  readonly resourceId: string;
  readonly resourceVersionId: string;
  readonly claimId: string;
  /** SHA-256 of the canonical skill package containing the single real file. */
  readonly packageSha256: string;
  /** SHA-256 of the raw file bytes at the pinned commit. */
  readonly sourceSnapshotSha256: string;
  readonly auditHighestSeverity: string;
  readonly auditFindingCount: number;
  /** The genuine (failing) Agent Skill format validation result, persisted for display. */
  readonly formatValidation: SkillFormatValidation;
  /** The exact canonical package bytes whose SHA-256 is `packageSha256`. Retained so an evidence
   * publication can carry the real artifact rather than a placeholder. */
  readonly canonicalPackageBytes: Uint8Array;
  /** The deterministic audit report, retained for the same reason. */
  readonly auditReport: ReturnType<typeof auditSkillPackage>;
}

/** Reads the committed fixture and derives every real value from it. Network-free and pure. */
export async function computeCookbookSkillEvidence(): Promise<{
  entries: SkillPackageEntry[];
  packageSha256: string;
  sourceSnapshotSha256: string;
  audit: ReturnType<typeof auditSkillPackage>;
  formatValidation: SkillFormatValidation;
}> {
  const bytes = new Uint8Array(await readFile(fileURLToPath(FIXTURE_URL)));
  const entries: SkillPackageEntry[] = [{ path: COOKBOOK_FILE_PATH, bytes }];
  return {
    entries,
    packageSha256: sha256Bytes(canonicalSkillPackageBytes(entries)),
    sourceSnapshotSha256: sha256Bytes(bytes),
    audit: auditSkillPackage(entries),
    // Directory name is the file's real parent directory. It fails regardless (there is no
    // SKILL.md at all), but passing the true directory keeps the failure honest rather than
    // engineering a different failure code.
    formatValidation: validateSkillPackage(entries, "frontend_design"),
  };
}

function cookbookResource(): CapabilityResource {
  return {
    schemaVersion: "1",
    id: RESOURCE_ID,
    kind: "agent-skill",
    name: NAME,
    description: DESCRIPTION,
    discovery: {
      status: "INDEXED",
      source: "aegisone-curated",
      sourceResourceId: PROVIDER_RESOURCE_ID,
      resourceUrl: `${COOKBOOK_REPOSITORY_URL}/blob/${COOKBOOK_COMMIT_SHA}/${COOKBOOK_FILE_PATH}`,
      discoveredAt: new Date(0).toISOString(),
    },
    currentVersion: {
      id: COOKBOOK_COMMIT_SHA,
      versionLabel: `commit ${COOKBOOK_COMMIT_SHA.slice(0, 7)}`,
      source: {
        repositoryUrl: COOKBOOK_REPOSITORY_URL,
        commitSha: COOKBOOK_COMMIT_SHA,
        subdirectory: "frontend_design",
      },
      distribution: null,
    },
    // Seeded rows never carry trust; the catalog conversion boundary would blank it anyway. Real
    // evidence is attached below through the same source-claim / capability-verification tables
    // any production resource uses.
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

/**
 * Idempotent. Re-running upserts the same resource/version (same canonical key and version key),
 * and appends a further historical verification row — matching how every other AegisOne write
 * path behaves: verifications are historical evidence, never mutated in place.
 */
export async function seedCookbookSkill(store: CatalogStore): Promise<CookbookSeedResult> {
  const evidence = await computeCookbookSkillEvidence();

  const { resource, version } = await store.upsertDiscoveredResource(cookbookResource());
  if (!version) throw new Error("library seed: expected a resource version from upsertDiscoveredResource");

  // DECLARED: an explicit mapping, with no `authority` block, because no repository authority was
  // ever proven for it. `buildCanonicalSourceClaim` omits absent fields entirely rather than
  // writing null-as-a-guess, so this claim canonicalizes differently from an authenticated one.
  const canonicalClaim = buildCanonicalSourceClaim({
    resourceId: resource.id,
    resourceVersionId: version.id,
    provider: "github",
    repository: { id: null, fullName: COOKBOOK_REPOSITORY },
    source: { commitSha: COOKBOOK_COMMIT_SHA, subdirectory: "frontend_design" },
    distribution: null,
    authority: null,
  });

  const newClaim: NewSourceClaim = {
    resourceVersionId: version.id,
    provider: "github",
    assuranceLevel: "DECLARED",
    sourceRepository: COOKBOOK_REPOSITORY,
    sourceRepositoryId: null,
    sourceRepositoryNodeId: null,
    sourceOwnerLogin: "Ollie202",
    sourceOwnerId: null,
    sourceCommitSha: COOKBOOK_COMMIT_SHA,
    sourceSubdirectory: "frontend_design",
    distributionUrl: null,
    distributionSha256: null,
    claimDigestSha256: computeSourceClaimDigest(canonicalClaim),
    canonicalClaimJson: canonicalClaim,
    // Never authenticated — there is no authentication event to timestamp.
    authenticatedAt: null,
    authorityObservations: [],
  };
  // This seed runs on every cold start, so it MUST be idempotent. The canonical claim is
  // deterministic, therefore so is its digest — and `source_claims.claim_digest_sha256` is UNIQUE.
  // Creating unconditionally succeeded exactly once and then threw
  // `duplicate key value violates unique constraint "source_claims_digest_idx"` on every
  // subsequent boot. Because the cookbook is seeded first, that one failure emptied the entire
  // library in production while every local test (which starts from a clean store) passed.
  // Reuse the existing claim instead; re-seeding must never mint a second claim for identical
  // evidence, and must never mutate the stored one.
  const claimDigest = newClaim.claimDigestSha256;
  const existingClaims = await store.listActiveSourceClaimsByResourceVersion(version.id);
  const existingClaim = existingClaims.find((candidate) => candidate.claimDigestSha256 === claimDigest);
  const claimResult = existingClaim ? { claim: existingClaim } : await store.createSourceClaim(newClaim);

  const verification: NewCapabilityVerification = {
    resourceVersionId: version.id,
    sourceClaimId: claimResult.claim.id,
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "INSPECTED",
    sourceSnapshotSha256: evidence.sourceSnapshotSha256,
    // See the header: no distinct distributed artifact exists, so correspondence is honestly
    // unevaluated and carries no digests.
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    // The genuine deterministic static-audit result, straight from `auditSkillPackage`.
    securityStatus: "COMPLETED",
    securityHighestSeverity: evidence.audit.highestSeverity,
    securityFindingCount: evidence.audit.findingCount,
    // Nothing was written to 0G for this resource, so there is no canonical evidence pointer,
    // no storage root and no registry record. All stay null.
    canonicalEvidenceSha256: null,
    storageRoot: null,
    storageTransaction: null,
    registryContract: null,
    registryRecordId: null,
    registryTransaction: null,
    verifiedAt: null,
  };
  // Same idempotency requirement. `capability_verifications` has no unique constraint, so an
  // unconditional insert would not fail loudly — it would quietly append an identical evidence row
  // on every cold start forever. Only record one when the latest row does not already describe
  // exactly this evidence. A genuinely new result (different snapshot digest or audit outcome)
  // still appends a new row and never mutates the previous verdict.
  const latestVerification = await store.getLatestCapabilityVerification(version.id);
  const alreadyRecorded =
    latestVerification !== null &&
    latestVerification.sourceClaimId === claimResult.claim.id &&
    latestVerification.sourceSnapshotSha256 === verification.sourceSnapshotSha256 &&
    latestVerification.correspondenceStatus === verification.correspondenceStatus &&
    latestVerification.securityHighestSeverity === verification.securityHighestSeverity &&
    latestVerification.securityFindingCount === verification.securityFindingCount;
  if (!alreadyRecorded) await store.createCapabilityVerification(verification);

  return {
    resourceId: resource.id,
    resourceVersionId: version.id,
    claimId: claimResult.claim.id,
    packageSha256: evidence.packageSha256,
    sourceSnapshotSha256: evidence.sourceSnapshotSha256,
    auditHighestSeverity: evidence.audit.highestSeverity,
    auditFindingCount: evidence.audit.findingCount,
    formatValidation: evidence.formatValidation,
    canonicalPackageBytes: canonicalSkillPackageBytes(evidence.entries),
    auditReport: evidence.audit,
  };
}
