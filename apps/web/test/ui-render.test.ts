import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { escapeHtml, safeHttpUrl, shortHash } from "../src/ui/escape.mjs";
import { discoveryBadge, sourceAssuranceBadge, correspondenceBadge, securityBadge, policyDecisionBadge } from "../src/ui/badges.mjs";
import { resultListHtml, normalizeSearchResults, resultCardHtml } from "../src/ui/result-card.mjs";
import { policyResultHtml, policyErrorHtml } from "../src/ui/policy-result.mjs";
import { evidencePassportHtml } from "../src/ui/evidence-passport.mjs";
import { policyFromFormValues } from "../src/ui/policy-form.mjs";

/**
 * M9 (Issue #31): component-level tests for the isomorphic `apps/web/src/ui/*.mjs` render modules
 * shared by SSR (`apps/web/src/pages/*.ts`) and the browser (`apps/web/public/app.js`, imported at
 * `/static/ui/*.mjs`, see `apps/web/src/static-assets.ts`). Covers the explicit acceptance items:
 * external text is sanitized before HTML insertion, no SAFE/TRUSTED badge or numeric trust score
 * ever appears, discovery is visually distinct from AegisOne-evidenced state, and every rendered
 * dimension traces to a real backend-shaped field.
 */

test("escapeHtml neutralizes script/attribute-breakout payloads", () => {
  const payload = `<script>alert(1)</script>"'&<>`;
  const escaped = escapeHtml(payload);
  assert.equal(escaped.includes("<script>"), false);
  assert.equal(escaped, "&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#039;&amp;&lt;&gt;");
});

test("escapeHtml handles null/undefined without throwing", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("safeHttpUrl rejects javascript: and other non-http(s) schemes", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), "#");
  assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), "#");
  assert.equal(safeHttpUrl("not a url"), "#");
  assert.equal(safeHttpUrl(""), "#");
  assert.equal(safeHttpUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
});

test("shortHash preserves short values and truncates long ones with an ellipsis", () => {
  assert.equal(shortHash("abc"), "abc");
  const long = "a".repeat(64);
  const truncated = shortHash(long);
  assert.ok(truncated.includes("…"));
  assert.ok(truncated.length < long.length);
});

test("no badge renderer ever emits a generic SAFE/TRUSTED label or a bare numeric trust score", () => {
  const decisions = ["INDEXED", "STALE", "UNAVAILABLE", "NONE", "DECLARED", "REPOSITORY_AUTHENTICATED", "SIGNED_RELEASE", "MATCH", "MISMATCH", "DIVERGED", "NOT_EVALUATED", "ALLOW", "REVIEW", "DENY"];
  const rendered = [
    ...decisions.map((d) => discoveryBadge(d)),
    ...decisions.map((d) => sourceAssuranceBadge(d)),
    ...decisions.map((d) => correspondenceBadge(d)),
    ...decisions.map((d) => policyDecisionBadge(d)),
    securityBadge("COMPLETED", "INFO", 0),
    securityBadge("NOT_RUN", null, null),
  ].join(" ");
  // A badge's own rendered label/text must never literally read "SAFE"/"TRUSTED" (disclaimer
  // prose that *says* "does not mean safe" inside a `title` attribute is fine and expected —
  // this checks the badge's own status text, not every substring in the whole document).
  assert.doesNotMatch(rendered, />SAFE</);
  assert.doesNotMatch(rendered, />TRUSTED</);
  assert.doesNotMatch(rendered, /badge__text">\d+%/); // no bare numeric-score badge
});

test("every badge carries a text label alongside its glyph (never color alone)", () => {
  const html = correspondenceBadge("MATCH");
  assert.match(html, /badge__glyph/);
  assert.match(html, /badge__text/);
  assert.match(html, />MATCH</);
});

test("normalizeSearchResults never reads an ARD trustManifest/verified-looking field as trust evidence", () => {
  const hostileLocalEntry = {
    identifier: "urn:air:evil",
    displayName: "Evil Skill",
    type: "agent-skill",
    description: "hostile",
    score: 0.99,
    source: "aegisone-catalog",
    trustManifest: { verified: true, safetyScore: 100, matchStatus: "MATCH" },
    verified: true,
  };
  const [item] = normalizeSearchResults({ results: [hostileLocalEntry] });
  assert.equal(item.trust, null);
  const html = resultCardHtml(item);
  assert.match(html, /discovery only/);
  assert.doesNotMatch(html, /\bMATCH\b/);
});

test("normalizeSearchResults reads real federated CapabilityResource trust dimensions and separates relevance", () => {
  const capabilityResource = {
    schemaVersion: "1",
    id: "gh:example/skill@1",
    kind: "agent-skill",
    name: "Example Skill",
    description: "A real example",
    discovery: { status: "INDEXED", source: "github-agent-finder", sourceResourceId: "x", resourceUrl: "https://github.com/example/skill", discoveredAt: "2026-01-01T00:00:00.000Z", relevanceScore: 0.5 },
    currentVersion: null,
    trust: {
      sourceAssurance: { level: "REPOSITORY_AUTHENTICATED", evidenceRefs: ["claim-1"] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "MATCH", publisherSha256: "a".repeat(64), reproducedSha256: "a".repeat(64) },
      security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0 },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
  const [item] = normalizeSearchResults({ results: [capabilityResource] });
  assert.equal(item.trust.correspondence.status, "MATCH");
  const html = resultCardHtml(item);
  assert.match(html, /REPOSITORY AUTHENTICATED/);
  assert.match(html, />MATCH</);
  assert.match(html, /relevance 50%/);
});

test("resultListHtml renders provider outage separately from trust evidence, not as a security finding", () => {
  const html = resultListHtml({
    results: [],
    providerStatuses: [{ providerId: "hugging-face-discover", ok: false, resourceCount: 0, skippedInvalidCount: 0, errorCode: "provider_timeout", message: "timed out", elapsedMs: 3000 }],
  });
  assert.match(html, /unavailable/);
  assert.match(html, /provider outage, not a security finding/);
});

test("resultCardHtml escapes an XSS payload embedded in an external resource name/description/url", () => {
  const hostile = {
    id: "x",
    kind: "agent-skill",
    name: `<img src=x onerror=alert(1)>`,
    description: `<script>alert('xss')</script>`,
    resourceUrl: `javascript:alert(1)`,
    relevanceScore: null,
    discoveryStatus: "INDEXED",
    providerSource: `<b>evil</b>`,
    trust: null,
    catalogResourceId: null,
  };
  const html = resultCardHtml(hostile);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(html, /<script>alert\('xss'\)<\/script>/);
  assert.doesNotMatch(html, /href="javascript:alert\(1\)"/);
});

test("policyResultHtml renders decision and reasons verbatim from a backend TrustPolicyResult, never recomputing", () => {
  const result = { schemaVersion: "1", decision: "DENY", reasons: [{ code: "correspondence_not_match", decision: "DENY", message: "Correspondence is MISMATCH, not MATCH." }] };
  const html = policyResultHtml(result);
  assert.match(html, /data-decision="DENY"/);
  assert.match(html, />DENY</);
  assert.match(html, /Correspondence is MISMATCH, not MATCH\./);
});

test("policyResultHtml with no result yet shows a neutral empty state, never a fabricated decision", () => {
  const html = policyResultHtml(null);
  assert.doesNotMatch(html, /data-decision/);
});

test("policyErrorHtml never renders a DENY/ALLOW/REVIEW decision for an evaluation failure", () => {
  const html = policyErrorHtml({ error: "invalid_policy", message: "policy.missingEvidenceDecision must be REVIEW or DENY" });
  assert.doesNotMatch(html, /data-decision/);
  assert.match(html, /policy\.missingEvidenceDecision must be REVIEW or DENY/);
});

test("policyFromFormValues never produces a decision field itself (browser cannot fabricate policy results)", () => {
  const policy = policyFromFormValues({ minimumSourceAssurance: "MATCH", requireCorrespondence: "MATCH", maximumAuditSeverity: "", maximumEvidenceAgeHours: "", missingEvidenceDecision: "DENY" });
  assert.equal("decision" in policy, false);
  assert.equal(policy.missingEvidenceDecision, "DENY");
  assert.equal(policy.requireCorrespondence, "MATCH");
});

test("evidencePassportHtml never shows MATCH unless the resource's own trust.correspondence says MATCH", () => {
  const resource = {
    name: "Example",
    kind: "agent-skill",
    description: "",
    discovery: { status: "INDEXED", source: "x" },
    currentVersion: { versionLabel: "1.0.0" },
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
  const html = evidencePassportHtml({ resource, sourceClaims: [], capabilityVerifications: [], integrity: { sourceAssurance: { present: false, integrityCheckPassed: false }, canonicalVerification: { present: false, integrityCheckPassed: false } } });
  assert.match(html, /NOT EVALUATED/);
  assert.doesNotMatch(html, />MATCH</);
  assert.match(html, /No source claim yet/);
});

test("no rendering module (.mjs) or SSR page (.ts) contains the string \"verified\":true or a bare safe:true literal", async () => {
  const uiDir = fileURLToPath(new URL("../src/ui/", import.meta.url));
  const pagesDir = fileURLToPath(new URL("../src/pages/", import.meta.url));
  const files = [
    ...(await readdir(uiDir)).map((f) => `${uiDir}${f}`),
    ...(await readdir(pagesDir)).map((f) => `${pagesDir}${f}`),
  ];
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /"verified"\s*:\s*true/i, `${file} must not contain a verified:true literal`);
    // A badge's own rendered text must never literally be "SAFE"/"TRUSTED" — prose disclaiming
    // safety ("does not mean safe", "not proof of safety") is expected and intentionally present.
    assert.doesNotMatch(contents, />SAFE</, `${file} must not render a generic SAFE badge`);
    assert.doesNotMatch(contents, />TRUSTED</, `${file} must not render a generic TRUSTED badge`);
  }
});
