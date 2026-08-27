import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runAdvisoryScan } from "../src/advisory-scan.ts";
import { createZeroGComputeConfigFromEnv } from "../src/config.ts";
import type { AdvisoryScanTransport } from "../src/types.ts";

function fakeTransport(content: string, modelProvider = "test-provider"): AdvisoryScanTransport {
  return { async requestChatCompletion() { return { content, modelProvider }; } };
}

test("runAdvisoryScan returns a completed finding for a well-formed model response", async () => {
  const outcome = await runAdvisoryScan(
    "SKILL.md content",
    fakeTransport('{"concernLevel":"high","summary":"Attempts to instruct the agent to hide actions from the user."}'),
  );
  assert.equal(outcome.status, "completed");
  if (outcome.status !== "completed") return;
  assert.equal(outcome.finding.concernLevel, "high");
  assert.equal(outcome.finding.modelProvider, "test-provider");
  assert.match(outcome.finding.summary, /hide actions/);
  assert.match(outcome.finding.ranAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("runAdvisoryScan tolerates a markdown code fence around the JSON", async () => {
  const outcome = await runAdvisoryScan("text", fakeTransport('```json\n{"concernLevel":"none","summary":"No concerns found."}\n```'));
  assert.equal(outcome.status, "completed");
  if (outcome.status !== "completed") return;
  assert.equal(outcome.finding.concernLevel, "none");
});

test("runAdvisoryScan returns an error outcome for unparsable model output, never a fabricated finding", async () => {
  const outcome = await runAdvisoryScan("text", fakeTransport("not json at all"));
  assert.equal(outcome.status, "error");
});

test("runAdvisoryScan returns an error outcome for a valid-JSON-but-wrong-shape response", async () => {
  const outcome = await runAdvisoryScan("text", fakeTransport('{"concernLevel":"extreme","summary":"x"}'));
  assert.equal(outcome.status, "error");
});

test("runAdvisoryScan returns an error outcome when the transport throws, never a fabricated finding", async () => {
  const throwingTransport: AdvisoryScanTransport = {
    async requestChatCompletion() {
      throw new Error("network unavailable");
    },
  };
  const outcome = await runAdvisoryScan("text", throwingTransport);
  assert.equal(outcome.status, "error");
  if (outcome.status !== "error") return;
  assert.match(outcome.message, /network unavailable/);
});

test("runAdvisoryScan truncates very long skill text before sending it to the transport", async () => {
  let seenLength = 0;
  const transport: AdvisoryScanTransport = {
    async requestChatCompletion({ userContent }) {
      seenLength = userContent.length;
      return { content: '{"concernLevel":"none","summary":"ok"}', modelProvider: "p" };
    },
  };
  await runAdvisoryScan("x".repeat(50_000), transport);
  assert.ok(seenLength < 25_000, `expected truncated content, got length ${seenLength}`);
});

test("createZeroGComputeConfigFromEnv returns null when ZEROG_COMPUTE_PRIVATE_KEY is unset", () => {
  assert.equal(createZeroGComputeConfigFromEnv({}), null);
});

test("createZeroGComputeConfigFromEnv returns a config with sane defaults when the key is set", () => {
  const config = createZeroGComputeConfigFromEnv({ ZEROG_COMPUTE_PRIVATE_KEY: "0xabc" });
  assert.notEqual(config, null);
  assert.equal(config?.privateKey, "0xabc");
  assert.match(config!.rpcUrl, /^https:\/\//);
  assert.match(config!.modelProvider, /^0x/);
});

test("createZeroGComputeConfigFromEnv honors explicit overrides", () => {
  const config = createZeroGComputeConfigFromEnv({
    ZEROG_COMPUTE_PRIVATE_KEY: "0xabc",
    ZEROG_COMPUTE_MODEL_PROVIDER: "0xdeadbeef",
    ZEROG_COMPUTE_RPC_URL: "https://example.invalid",
  });
  assert.equal(config?.modelProvider, "0xdeadbeef");
  assert.equal(config?.rpcUrl, "https://example.invalid");
});

// Structural regression (same discipline as skill-verification-link's evaluateSourceOnly test):
// this advisory tier must never itself reference the deterministic verdict vocabulary — proves
// by construction that no future edit can make it silently set a strong trust verdict.
test("runAdvisoryScan's non-comment source code never references deterministic verdict/trust tokens", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/advisory-scan.ts", import.meta.url)), "utf8");
  // Strip comments before checking: the module's *documentation* legitimately explains which
  // verdict vocabulary it can never produce (see the JSDoc above `runAdvisoryScan`) — the actual
  // code must not reference it.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of ["MATCH", "MISMATCH", "sourceAssurance", "REPOSITORY_AUTHENTICATED", "BLACKLISTED", "SIGNED_RELEASE"]) {
    assert.ok(!withoutComments.includes(forbidden), `advisory-scan.ts code must not reference ${forbidden}`);
  }
});
