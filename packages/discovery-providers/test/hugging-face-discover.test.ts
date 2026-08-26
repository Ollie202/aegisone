import assert from "node:assert/strict";
import { test } from "node:test";
import { HUGGING_FACE_DISCOVER_ENDPOINT, HUGGING_FACE_DISCOVER_PROVIDER_ID } from "../src/constants.ts";
import { createHuggingFaceDiscoverProvider } from "../src/hugging-face-discover.ts";
import { HUGGING_FACE_DISCOVER_FIXTURE_RESPONSE } from "./fixtures.ts";
import { jsonResponseFetch } from "./test-fetch.ts";

test("provider id and endpoint match the pinned Hugging Face Discover contract", () => {
  assert.equal(HUGGING_FACE_DISCOVER_PROVIDER_ID, "hugging-face-discover");
  assert.equal(HUGGING_FACE_DISCOVER_ENDPOINT, "https://huggingface-hf-discover.hf.space/search");
});

test("end-to-end: recorded Hugging Face Discover fixture normalizes into attributed, discovery-only resources and ignores referrals", async () => {
  const provider = createHuggingFaceDiscoverProvider({ fetchImpl: jsonResponseFetch(HUGGING_FACE_DISCOVER_FIXTURE_RESPONSE) });
  const outcome = await provider.search({ text: "upload files to a dataset repo", mediaTypes: null, pageSize: 10 }, new AbortController().signal);

  assert.ok(outcome.ok);
  assert.equal(outcome.providerId, "hugging-face-discover");
  // 3 results in the fixture; the top-level "referrals" entry (an ai-registry+json pointer, not a
  // resource) must never be surfaced as a discovered capability.
  assert.equal(outcome.resources.length, 3);
  assert.ok(!outcome.resources.some((resource) => resource.kind !== "agent-skill"));
  for (const resource of outcome.resources) {
    assert.equal(resource.discovery.source, "https://huggingface-hf-discover.hf.space");
    assert.equal(resource.trust.canonicalEvidence.status, "NONE");
  }
});

test("the huggingface-native urn:air identifier scheme still normalizes correctly", () => {
  const first = HUGGING_FACE_DISCOVER_FIXTURE_RESPONSE.results[0]!;
  assert.match(first.identifier, /^urn:air:/);
});
