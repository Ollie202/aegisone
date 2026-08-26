import assert from "node:assert/strict";
import { test } from "node:test";
import { computeCanonicalKey, computeCanonicalKeyFromResource, deriveProviderId } from "../src/canonical-key.ts";
import { ardResource, federatedResource } from "./fixtures.ts";

test("tier 1: a valid urn:air identifier is used verbatim as the canonical key", () => {
  const key = computeCanonicalKey({
    sourceResourceId: "urn:air:proofrail-app-production.up.railway.app:skill:hello",
    providerId: "ard",
    resourceUrl: "https://example.com/skills/hello",
  });
  assert.equal(key, "urn:air:proofrail-app-production.up.railway.app:skill:hello");
});

test("tier 2: provider ID + provider resource ID when no urn:air identifier is present", () => {
  const key = computeCanonicalKey({
    sourceResourceId: "urn:ai:12345",
    providerId: "github-agent-finder",
    resourceUrl: "https://github.com/example/mcp-server",
  });
  assert.equal(key, "github-agent-finder::urn:ai:12345");
});

test("tier 3: falls back to a normalized resource URL when no identifier/provider pair is usable", () => {
  const key = computeCanonicalKey({ resourceUrl: "HTTPS://Example.COM/Path/" });
  assert.equal(key, "https://example.com/Path");
});

test("tier 3 normalization is case/trailing-slash stable", () => {
  const a = computeCanonicalKey({ resourceUrl: "https://example.com/path/" });
  const b = computeCanonicalKey({ resourceUrl: "HTTPS://EXAMPLE.COM/path" });
  assert.equal(a, b);
});

test("throws when no identifier, provider pairing, or usable URL exists", () => {
  assert.throws(() => computeCanonicalKey({}), /computeCanonicalKey requires/);
  assert.throws(() => computeCanonicalKey({ resourceUrl: "not a url" }), /computeCanonicalKey requires/);
});

test("deriveProviderId reads the short slug prefix AegisOne's own normalizers use", () => {
  assert.equal(deriveProviderId(ardResource()), "ard");
  assert.equal(deriveProviderId(federatedResource()), "github-agent-finder");
});

test("computeCanonicalKeyFromResource is stable across repeated observations of the same resource", () => {
  const first = federatedResource({ discovery: { ...federatedResource().discovery, discoveredAt: "2026-08-26T00:00:00.000Z" } });
  const second = federatedResource({ discovery: { ...federatedResource().discovery, discoveredAt: "2026-08-27T12:00:00.000Z", relevanceScore: 0.1 } });
  assert.equal(computeCanonicalKeyFromResource(first), computeCanonicalKeyFromResource(second));
});

test("an ARD-shaped resource and a federated-shaped resource never collide on canonical key", () => {
  assert.notEqual(computeCanonicalKeyFromResource(ardResource()), computeCanonicalKeyFromResource(federatedResource()));
});
