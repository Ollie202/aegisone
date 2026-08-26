import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { authorizeVerificationTrigger } from "../src/authorization.ts";
import { runSkillVerificationEnrichment } from "../src/enrichment.ts";
import { canonicalSkillPackageBytes, summarizeSkillPackage } from "../../skill-audit/src/package.ts";
import { createFixtureGitRepository } from "./fixtures.ts";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const TOKEN = "test-worker-token";
const TOKEN_DIGEST = sha256Hex(TOKEN);

function authorization() {
  return authorizeVerificationTrigger(TOKEN, TOKEN_DIGEST, "test-worker");
}

test("STRUCTURAL: source-only code path never references verifySkillPackages/compareArtifacts", async () => {
  // This is the regression the issue calls out explicitly: prove the impossibility, not just
  // that a particular input happens not to trigger it. Read enrichment.ts's own source and
  // confirm evaluateSourceOnly's body (up to the next top-level function) contains no call to
  // the comparison functions.
  const source = await readFile(fileURLToPath(new URL("../src/enrichment.ts", import.meta.url)), "utf8");
  const start = source.indexOf("function evaluateSourceOnly");
  const end = source.indexOf("function evaluateWithDistribution");
  assert.ok(start > 0 && end > start, "expected to locate both functions in enrichment.ts");
  const body = source.slice(start, end);
  assert.equal(body.includes("verifySkillPackages"), false);
  assert.equal(body.includes("compareArtifacts"), false);
  assert.equal(body.includes("MATCH"), false);
  assert.equal(body.includes("MISMATCH"), false);
});

test("source-only enrichment (no distribution) always yields NOT_EVALUATED correspondence, never MATCH/MISMATCH", async () => {
  const fixture = await createFixtureGitRepository();
  const result = await runSkillVerificationEnrichment({
    authorization: authorization(),
    source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
    distribution: null,
    allowLocalFixtureRepository: true,
  });
  assert.equal(result.sourceInspection.status, "INSPECTED");
  assert.equal(result.correspondence.status, "NOT_EVALUATED");
  assert.equal(result.correspondence.publisherSha256, null);
  assert.equal(result.correspondence.reproducedSha256, null);
  assert.equal(result.security.auditTarget, "source");
  assert.equal(result.fullVerification, null);
});

test("runSkillVerificationEnrichment cannot be called without a real authorization object", async () => {
  const fixture = await createFixtureGitRepository();
  // @ts-expect-error deliberately omitting the required authorization field
  await assert.rejects(runSkillVerificationEnrichment({
    source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
    distribution: null,
    allowLocalFixtureRepository: true,
  }));
});

async function withServer(bytes: Uint8Array, fn: (baseUrl: string, fetcher: typeof fetch) => Promise<void>): Promise<void> {
  const server: Server = createServer((_request, response) => { response.end(Buffer.from(bytes)); });
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("failed to bind test server");
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    url.protocol = "http:";
    return fetch(url, init);
  };
  try {
    await fn(`https://127.0.0.1:${address.port}/fixture.skillpkg`, fetcher);
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

test("a genuine distribution package matching the exact source commit yields MATCH", async () => {
  const fixture = await createFixtureGitRepository();
  const skillMarkdown = "---\nname: fixture-skill\ndescription: A deterministic fixture Agent Skill used only by skill-verification-link tests.\nlicense: MIT\n---\n\n# Fixture Skill\n\n1. Read the requested input.\n2. Return a deterministic fixture response.\n";
  const genuineBytes = canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: new TextEncoder().encode(skillMarkdown) }]);

  await withServer(genuineBytes, async (url, fetcher) => {
    const result = await runSkillVerificationEnrichment({
      authorization: authorization(),
      source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
      distribution: { url, expectedSha256: null },
      allowLocalFixtureRepository: true,
      distributionFetchOptions: { allowPrivateNetworkForTesting: true, fetcher },
    });
    assert.equal(result.correspondence.status, "MATCH");
    assert.equal(result.correspondence.publisherSha256, result.correspondence.reproducedSha256);
    assert.equal(result.security.auditTarget, "publisher");
    assert.ok(result.fullVerification);
  });
});

test("a tampered/substituted distribution package (same claimed source) yields MISMATCH, not a downgraded label", async () => {
  const fixture = await createFixtureGitRepository();
  const tamperedBytes = canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: new TextEncoder().encode("---\nname: fixture-skill\ndescription: tampered\n---\nbody") }]);

  await withServer(tamperedBytes, async (url, fetcher) => {
    const result = await runSkillVerificationEnrichment({
      authorization: authorization(),
      source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
      distribution: { url, expectedSha256: null },
      allowLocalFixtureRepository: true,
      distributionFetchOptions: { allowPrivateNetworkForTesting: true, fetcher },
    });
    assert.equal(result.correspondence.status, "MISMATCH");
    assert.notEqual(result.correspondence.publisherSha256, result.correspondence.reproducedSha256);
  });
});

test("an invalid distribution (digest mismatch) fails closed: the whole enrichment call rejects, never falling back to source-only NOT_EVALUATED", async () => {
  const fixture = await createFixtureGitRepository();
  const genuineBytes = canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: new TextEncoder().encode("anything") }]);

  await withServer(genuineBytes, async (url, fetcher) => {
    await assert.rejects(runSkillVerificationEnrichment({
      authorization: authorization(),
      source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
      distribution: { url, expectedSha256: "f".repeat(64) },
      allowLocalFixtureRepository: true,
      distributionFetchOptions: { allowPrivateNetworkForTesting: true, fetcher },
    }));
  });
});

test("distribution digest, when supplied, must equal the summary sha256 that the audit/correspondence actually used", async () => {
  const skillMarkdown = "---\nname: fixture-skill\ndescription: A deterministic fixture Agent Skill used only by skill-verification-link tests.\nlicense: MIT\n---\n\n# Fixture Skill\n\n1. Read the requested input.\n2. Return a deterministic fixture response.\n";
  const genuineBytes = canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: new TextEncoder().encode(skillMarkdown) }]);
  const expectedSha256 = summarizeSkillPackage([{ path: "SKILL.md", bytes: new TextEncoder().encode(skillMarkdown) }]).sha256;
  const fixture = await createFixtureGitRepository();

  await withServer(genuineBytes, async (url, fetcher) => {
    const result = await runSkillVerificationEnrichment({
      authorization: authorization(),
      source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
      distribution: { url, expectedSha256 },
      allowLocalFixtureRepository: true,
      distributionFetchOptions: { allowPrivateNetworkForTesting: true, fetcher },
    });
    assert.equal(result.correspondence.status, "MATCH");
  });
});
