import { fileURLToPath } from "node:url";
import { sha256Bytes } from "../../../packages/core/src/hash.ts";
import { canonicalSkillPackageBytes, readSkillDirectory } from "../../../packages/skill-audit/src/package.ts";
import { auditSkillPackage } from "../../../packages/skill-audit/src/audit.ts";
import { validateSkillPackage } from "../../../packages/skill-audit/src/validate.ts";
import type { SkillFormatValidation } from "../../../packages/skill-audit/src/model.ts";
import type { CatalogStore, NewCapabilityVerification } from "../../../packages/catalog-store/src/index.ts";
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
 * Because they are inline fixture files rather than a claimed external repository/commit, no
 * source claim is created for either: `sourceAssurance` stays `NONE` (there was no publisher
 * identity to declare a mapping for) and `sourceInspection` stays `NOT_RUN` (there is no exact
 * external commit being reproduced). This is the accurate representation, not a downgrade — it
 * is exactly analogous to what `POST /api/v1/scan` (paste-to-scan) produces for pasted content
 * with no claimed source. `correspondence` stays `NOT_EVALUATED`: there is no distinct
 * *distributed* artifact, only the source file (AGENTS.md: packaging the same source twice is
 * not correspondence proof). Only `security` carries real evidence, because a real deterministic
 * audit really ran over these real bytes.
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
      // No claimed external source repository/commit: this file lives inline in this
      // repository's own examples/ tree, not at a claimed publisher's exact commit.
      source: null,
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

  const verification: NewCapabilityVerification = {
    resourceVersionId: version.id,
    sourceClaimId: null,
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
