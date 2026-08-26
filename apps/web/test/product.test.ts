import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createVerification, recipeDigest } from "../../../packages/core/src/index.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../../../packages/core/src/index.ts";
import type { VerificationJob } from "../../../packages/job-store/src/index.ts";
import { readSkillDirectory, verifySkillPackages } from "../../../packages/skill-audit/src/index.ts";
import { renderJobHtml, renderProductHomeHtml } from "../src/product.ts";

const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: "examples/hello-aegisone",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/hello-aegisone.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 60_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "hello-aegisone@1",
  publisherIdentity: { type: "github", subject: "Ollie202", assuranceLevel: "DECLARED", evidenceReferences: [] },
  source: { provider: "git", repository: "https://github.com/Ollie202/aegisone.git", commitSha: "e9c82277cef2f7630977e2473664e14eed2f860d" },
  recipeDigest: recipeDigest(recipe),
  artifactName: "hello-aegisone.json",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "0g",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  attestationAvailable: true,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: ["tdx:provider-only"],
};

function job(overrides: Partial<VerificationJob> = {}): VerificationJob {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: null,
    createdAt: "2026-08-18T08:00:00.000Z",
    updatedAt: "2026-08-18T08:00:00.000Z",
    status: "queued",
    artifactKind: "software",
    projectId: claim.projectId,
    sourceRepository: claim.source.repository,
    sourceCommitSha: claim.source.commitSha,
    sourceSubdirectory: null,
    publisherArtifactName: claim.artifactName,
    publisherArtifactSha256: null,
    evidence: {
      manifestSha256: null,
      storageRoot: null,
      storageTransaction: null,
      registryContract: null,
      registryTransaction: null,
      registryRecordId: null,
    },
    verificationJson: null,
    failure: null,
    ...overrides,
  };
}

test("product home leads with real proven MATCH/MISMATCH evidence", () => {
  const html = renderProductHomeHtml();
  assert.match(html, /Don’t trust the release\. Rebuild it\./);
  assert.match(html, /9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154/);
  assert.match(html, /d5318963f53126b4c4bd448bffca222a8e08f068764e379516fc0ad3bd1f8889/);
  assert.match(html, /fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878/);
  assert.match(html, /da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb/);
});

test("product home exposes real 0G evidence and preserves honesty boundaries", () => {
  const html = renderProductHomeHtml();
  assert.match(html, /0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181/);
  assert.match(html, /0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66/);
  assert.match(html, /0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac/);
  assert.match(html, /0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db/);
  assert.match(html, /Provider evidence only/);
  assert.match(html, /M7 is PREPARED_NOT_SUBMITTED/);
  assert.match(html, /MATCH never means safe/);
  assert.match(html, /LLM advisory: NOT_RUN/);
});

test("pipeline status cannot override a core MISMATCH verdict", () => {
  const verification = createVerification({
    claim,
    recipe,
    publisherBytes: new TextEncoder().encode("publisher"),
    reproducedBytes: new TextEncoder().encode("different"),
    environment,
  });
  const html = renderJobHtml(job({ status: "verified", verificationJson: verification }));
  assert.match(html, />MISMATCH</);
  assert.doesNotMatch(html, /class="badge match">MATCH/);
});

test("persisted agent-skill job renders correspondence and audit independently", async () => {
  const maliciousPath = fileURLToPath(new URL("../../../examples/agent-skills/malicious-sync/", import.meta.url));
  const skill = await readSkillDirectory(maliciousPath);
  const verification = verifySkillPackages({
    publisherEntries: skill.entries,
    reproducedEntries: skill.entries,
    publisherDirectoryName: skill.directoryName,
    reproducedDirectoryName: skill.directoryName,
  });
  const html = renderJobHtml(job({ artifactKind: "agent-skill", status: "verified", verificationJson: verification }));
  assert.match(html, />MATCH</);
  assert.match(html, />CRITICAL_FINDINGS</);
  assert.match(html, /does not mean the skill is safe or benevolent/);
});

test("job page does not invent a correspondence verdict before evidence exists", () => {
  const html = renderJobHtml(job({ status: "running" }));
  assert.match(html, /Pipeline status: <strong>running<\/strong>/);
  assert.match(html, /No correspondence verdict is shown/);
  assert.doesNotMatch(html, />MATCH</);
});
