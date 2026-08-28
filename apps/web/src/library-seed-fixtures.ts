import { fileURLToPath } from "node:url";
import { sha256Bytes } from "../../../packages/core/src/hash.ts";
import { canonicalSkillPackageBytes, readSkillDirectory } from "../../../packages/skill-audit/src/package.ts";
import { auditSkillPackage } from "../../../packages/skill-audit/src/audit.ts";
import { validateSkillPackage } from "../../../packages/skill-audit/src/validate.ts";
import type { SkillFormatValidation } from "../../../packages/skill-audit/src/model.ts";
import { buildCanonicalSourceClaim, computeSourceClaimDigest } from "../../../packages/source-auth-github/src/index.ts";
import type { CatalogStore, NewCapabilityVerification, NewSourceClaim } from "../../../packages/catalog-store/src/index.ts";
import type { CapabilityResource } from "../../../packages/capability-model/src/index.ts";

/**
 * Two additional real, well-formed Agent Skill fixtures seeded into the library (PR 2/4, "grow
 * the library with real, well-formed skills").
 *
 * ==========================================================================================
 * WHAT THESE ARE, HONESTLY
 * ==========================================================================================
 * `examples/agent-skills/clean-review/` and `examples/agent-skills/malicious-sync/` are real
 * files committed to THIS repository (`examples/README.md`), not a third-party discovery and
 * not fetched from any external publisher. They are packaged and audited here through exactly
 * the same unmodified production functions the cookbook seed and the GitHub-source pipeline use
 * (`canonicalSkillPackageBytes`, `sha256Bytes`, `auditSkillPackage`, `validateSkillPackage`) —
 * nothing about their digests, audit findings, or format-validation result is invented.
 *
 * ==========================================================================================
 * WHY THEY NOW CARRY A DECLARED SOURCE CLAIM (ADR-020)
 * ==========================================================================================
 * PR 2 seeded these with no source claim at all, because nothing could act on one. ADR-020's
 * Package / Artifact Verification trigger changes that: a resource is verifiable exactly when the
 * catalog holds an exact, immutable source revision for it. These files genuinely do live at an
 * exact commit of a real public repository — this one — so each fixture now records that pin:
 * `FIXTURE_SOURCE_REPOSITORY_URL` at the exact 40-character commit `FIXTURE_SOURCE_COMMIT_SHA`
 * below, subdirectory `examples/agent-skills/<name>`. That is a statement of fact anyone can
 * check, and it is what makes "verify this package" a real button rather than a promise.
 *
 * The assurance level is `DECLARED`, and deliberately not more. Nobody completed a GitHub App
 * authorization flow for these rows, so no authority observation exists and none is invented:
 * AGENTS.md is explicit that `DECLARED`, `REPOSITORY_AUTHENTICATED` and `SIGNED_RELEASE` mean
 * different things, and that a repository existing is not proof the publisher authorised it.
 *
 * `sourceInspection` still starts at `NOT_RUN` and `correspondence` at `NOT_EVALUATED`: recording
 * where the source is claimed to be is not the same act as going and reproducing it, and there is
 * no distinct *distributed* artifact for either fixture, only the source files themselves
 * (AGENTS.md: packaging the same source twice is not correspondence proof). Running the ADR-020
 * trigger against one of these appends a real `INSPECTED` row; it can never produce MATCH or
 * MISMATCH, because there is nothing distinct to compare against. Only `security` carries real
 * evidence at seed time, because a real deterministic audit really ran over these real bytes.
 *
 * `clean-review` passes real `SKILL.md` format validation (valid frontmatter, `name` matches its
 * parent directory) and audits `INFO` / 0 findings — a genuine "nothing detected" example.
 *
 * `malicious-sync` also passes format validation (it too is a well-formed `SKILL.md` package) but
 * its body is a deliberate, clearly-labelled security-test fixture ("Security test fixture — do
 * not execute") containing credential-harvesting, exfiltration, destructive-command,
 * download-pipe-to-shell, and persistence-modification instruction patterns. Auditing it produces
 * genuine CRITICAL findings from the real deterministic ruleset — an honest demonstration that
 * detection actually works, not a scripted result.
 *
 * Both resources are labelled in the UI as repository fixtures (`discoverySource:
 * "aegisone-repository-fixture"`), never dressed up as an external discovery.
 */

const EXAMPLES_ROOT = new URL("../../../examples/agent-skills/", import.meta.url);

/**
 * The exact, immutable commit these two fixtures are pinned to on the public AegisOne repository.
 * A 40-character SHA, never a branch name (AGENTS.md: "immutable source revisions use exact commit
 * SHAs, not mutable branches") — a branch tip would silently change what "the source" means.
 *
 * If the fixture files are ever edited, this pin does NOT move automatically, and that is correct:
 * the pin says where these bytes came from, and a later edit is a different revision that would
 * need its own claim. A verification run against this commit reproduces what was really there.
 */
export const FIXTURE_SOURCE_REPOSITORY_FULL_NAME = "Ollie202/aegisone";
export const FIXTURE_SOURCE_REPOSITORY_URL = `https://github.com/${FIXTURE_SOURCE_REPOSITORY_FULL_NAME}`;
export const FIXTURE_SOURCE_COMMIT_SHA = "eeac27076bbd98f99a147f51004d8ce07afad331";

export interface FixtureSkillDefinition {
  readonly resourceId: string;
  readonly providerResourceId: string;
  readonly name: string;
  readonly description: string;
  /** Directory name under `examples/agent-skills/` — read via the same `readSkillDirectory`
   * production function `packages/skill-verification-link` uses for a real Git checkout, so a
   * fixture is packaged identically to how a real source acquisition would package it. */
  readonly directory: string;
}

export interface FixtureSeedResult {
  readonly resourceId: string;
  readonly resourceVersionId: string;
  readonly packageSha256: string;
  readonly auditHighestSeverity: string;
  readonly auditFindingCount: number;
  readonly formatValidation: SkillFormatValidation;
  /** Exact canonical package bytes and the deterministic audit report, retained so an evidence
   * publication carries the real artifact instead of a placeholder. */
  readonly canonicalPackageBytes: Uint8Array;
  readonly auditReport: ReturnType<typeof auditSkillPackage>;
}

const CLEAN_REVIEW: FixtureSkillDefinition = {
  resourceId: "aegisone-curated:examples/agent-skills/clean-review",
  providerResourceId: "examples/agent-skills/clean-review",
  name: "Clean Review",
  description:
    "Review a text file for clear headings and concise paragraphs, without changing files automatically. A real, well-formed Agent Skill package used as an honest CLEAN detection example.",
  directory: "clean-review",
};

const MALICIOUS_SYNC: FixtureSkillDefinition = {
  resourceId: "aegisone-curated:examples/agent-skills/malicious-sync",
  providerResourceId: "examples/agent-skills/malicious-sync",
  name: "malicious-sync (security-test fixture — do not execute)",
  description:
    "Security-test fixture containing intentionally suspicious instructions for AegisOne's static Agent Skill auditor. Never execute this fixture. Used as an honest CRITICAL detection example.",
  directory: "malicious-sync",
};

async function computeFixtureEvidence(definition: FixtureSkillDefinition): Promise<{
  packageSha256: string;
  audit: ReturnType<typeof auditSkillPackage>;
  formatValidation: SkillFormatValidation;
}> {
  const directoryPath = fileURLToPath(new URL(definition.directory, EXAMPLES_ROOT));
  const { entries, directoryName } = await readSkillDirectory(directoryPath);
  return {
    entries,
    packageSha256: sha256Bytes(canonicalSkillPackageBytes(entries)),
    audit: auditSkillPackage(entries),
    formatValidation: validateSkillPackage(entries, directoryName),
  };
}

function fixtureResource(definition: FixtureSkillDefinition): CapabilityResource {
  return {
    schemaVersion: "1",
    id: definition.resourceId,
    kind: "agent-skill",
    name: definition.name,
    description: definition.description,
    discovery: {
      status: "INDEXED",
      // Truthful provider id: this row is a curated repository fixture seeded by this
      // repository itself, never presented as a third-party discovery result.
      source: "aegisone-repository-fixture",
      sourceResourceId: definition.providerResourceId,
      resourceUrl: `https://github.com/Ollie202/aegisone/tree/main/examples/agent-skills/${definition.providerResourceId.split("/").pop()}`,
      discoveredAt: new Date(0).toISOString(),
    },
    currentVersion: {
      id: "fixture",
      versionLabel: "repository fixture",
      // The exact immutable revision these bytes live at in the public AegisOne repository. This
      // is a *claim about where the source is*, not evidence that it was reproduced — the
      // `sourceInspection`/`correspondence` values below stay honestly absent until a real
      // verification run appends one.
      source: {
        repositoryUrl: FIXTURE_SOURCE_REPOSITORY_URL,
        commitSha: FIXTURE_SOURCE_COMMIT_SHA,
        subdirectory: `examples/agent-skills/${definition.directory}`,
      },
      // No distinct distributed artifact exists for a repository fixture: there is the source and
      // nothing else. Correspondence is therefore structurally unevaluable for these two, which is
      // exactly what the verification trigger reports for them.
      distribution: null,
    },
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

async function seedFixtureSkill(store: CatalogStore, definition: FixtureSkillDefinition): Promise<FixtureSeedResult> {
  const evidence = await computeFixtureEvidence(definition);
  const { resource, version } = await store.upsertDiscoveredResource(fixtureResource(definition));
  if (!version) throw new Error(`library seed: expected a resource version for ${definition.resourceId}`);

  /**
   * The DECLARED source claim. Built with the same unmodified `buildCanonicalSourceClaim` +
   * `computeSourceClaimDigest` functions the real M8.5 flow uses, so `assembleTrustEvidence`
   * recomputes the digest and accepts it for the same reason it accepts a real one — and would
   * reject it for the same reason too, if the row were ever mutated. `authority: null`: no
   * authorization flow was performed, so no authority is asserted and the level stays `DECLARED`.
   */
  const subdirectory = `examples/agent-skills/${definition.directory}`;
  const canonicalClaim = buildCanonicalSourceClaim({
    resourceId: resource.id,
    resourceVersionId: version.id,
    provider: "github",
    repository: { id: null, fullName: FIXTURE_SOURCE_REPOSITORY_FULL_NAME },
    source: { commitSha: FIXTURE_SOURCE_COMMIT_SHA, subdirectory },
    distribution: null,
    authority: null,
  });
  const claim: NewSourceClaim = {
    resourceVersionId: version.id,
    provider: "github",
    assuranceLevel: "DECLARED",
    sourceRepository: FIXTURE_SOURCE_REPOSITORY_FULL_NAME,
    sourceRepositoryId: null,
    sourceRepositoryNodeId: null,
    sourceOwnerLogin: null,
    sourceOwnerId: null,
    sourceCommitSha: FIXTURE_SOURCE_COMMIT_SHA,
    sourceSubdirectory: subdirectory,
    distributionUrl: null,
    distributionSha256: null,
    claimDigestSha256: computeSourceClaimDigest(canonicalClaim),
    canonicalClaimJson: canonicalClaim,
    // Never authenticated: DECLARED means a mapping was stated, not proven.
    authenticatedAt: null,
    authorityObservations: [],
  };
  const claimResult = await store.createSourceClaim(claim);

  const verification: NewCapabilityVerification = {
    resourceVersionId: version.id,
    sourceClaimId: claimResult.claim.id,
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "NOT_RUN",
    sourceSnapshotSha256: null,
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "COMPLETED",
    securityHighestSeverity: evidence.audit.highestSeverity,
    securityFindingCount: evidence.audit.findingCount,
    canonicalEvidenceSha256: null,
    storageRoot: null,
    storageTransaction: null,
    registryContract: null,
    registryRecordId: null,
    registryTransaction: null,
    verifiedAt: null,
  };
  await store.createCapabilityVerification(verification);

  return {
    resourceId: resource.id,
    resourceVersionId: version.id,
    packageSha256: evidence.packageSha256,
    auditHighestSeverity: evidence.audit.highestSeverity,
    auditFindingCount: evidence.audit.findingCount,
    formatValidation: evidence.formatValidation,
    canonicalPackageBytes: canonicalSkillPackageBytes(evidence.entries),
    auditReport: evidence.audit,
  };
}

export async function seedCleanReviewSkill(store: CatalogStore): Promise<FixtureSeedResult> {
  return seedFixtureSkill(store, CLEAN_REVIEW);
}

export async function seedMaliciousSyncSkill(store: CatalogStore): Promise<FixtureSeedResult> {
  return seedFixtureSkill(store, MALICIOUS_SYNC);
}
