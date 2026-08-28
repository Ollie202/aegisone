import assert from "node:assert/strict";
import { test } from "node:test";
import { categoryFilterHtml, skillEntryHtml, skillLibraryHtml } from "../src/ui/skill-card.mjs";
import { browsableCategories } from "../src/ui/skill-category.mjs";

/** A library entry with every dimension genuinely unknown — the state most discovered resources
 * are actually in. */
function unknownEntry(overrides = {}) {
  return {
    resourceId: "res-1",
    name: "Some skill",
    description: "Does a thing.",
    kind: "agent-skill",
    discoveryStatus: "INDEXED",
    category: { id: "uncategorized", label: "Uncategorized", basis: "none" },
    publisherLabel: null,
    versionLabel: null,
    sourceRepositoryUrl: null,
    sourceCommitSha: null,
    contentSha256: null,
    formatValidation: null,
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
    ...overrides,
  };
}

test("unknown dimensions render the literal word 'unknown', never a blank cell", () => {
  const html = skillEntryHtml(unknownEntry(), 0);
  // Three facts, all unknown, all explicitly stated.
  assert.equal((html.match(/libFactValue--unknown">unknown</g) ?? []).length, 3);
  // An unknown author is stated, not omitted.
  assert.match(html, /author unknown/);
  // And a blank is never emitted in a fact slot.
  assert.doesNotMatch(html, /<dd><\/dd>|libFactValue"><\/span>/);
});

test("an entry with no evidence never renders a positive or collapsed verdict", () => {
  const html = skillEntryHtml(unknownEntry(), 0);
  assert.match(html, /INDEXED — discovery only/);
  assert.match(html, /NO SOURCE CLAIM/);
  assert.match(html, /NOT EVALUATED/);
  assert.match(html, /AUDIT NOT RUN/);
  assert.match(html, /NO CANONICAL EVIDENCE/);
  assert.match(html, /NOT STORED ON 0G/);
  assert.match(html, /FORMAT NOT CHECKED/);
  // No generic SAFE/TRUSTED badge and no aggregate score.
  assert.doesNotMatch(html, /badge[^>]*>\s*(SAFE|TRUSTED)\b/i);
  assert.doesNotMatch(html, /\bscore\b/i);
});

test("every badge pairs a glyph with a text label, so colour is never the only signal", () => {
  const html = skillEntryHtml(unknownEntry(), 0);
  const badges = html.match(/<span class="badge [^"]*"[^>]*>[\s\S]*?<\/span><\/span>/g) ?? [];
  assert.ok(badges.length >= 6, "expected the independent dimension badges");
  for (const badge of badges) {
    assert.match(badge, /badge__glyph/, `badge missing a glyph: ${badge}`);
    assert.match(badge, /badge__text">[^<]+</, `badge missing a text label: ${badge}`);
  }
});

test("INDEXED is visually and semantically distinct from an audited/verified state", () => {
  const indexed = skillEntryHtml(unknownEntry(), 0);
  const audited = skillEntryHtml(
    unknownEntry({
      trust: {
        ...unknownEntry().trust,
        correspondence: { status: "MATCH", publisherSha256: "a".repeat(64), reproducedSha256: "a".repeat(64) },
        security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0 },
      },
    }),
    0,
  );
  // Discovery-only uses the info tone; MATCH uses the positive tone. Different classes AND
  // different words — the textual distinction is the primary guarantee.
  assert.match(indexed, /badge--info[^>]*>[\s\S]*?INDEXED — discovery only/);
  assert.match(audited, /badge--positive[^>]*>[\s\S]*?MATCH/);
  assert.doesNotMatch(indexed, /badge__text">MATCH</);
});

test("external text is escaped, and non-http URLs never reach an href", () => {
  const hostile = unknownEntry({
    name: `<script>alert('x')</script>`,
    description: `"><img src=x onerror=alert(1)>`,
    publisherLabel: `<b>evil</b>`,
    versionLabel: `<i>1.0</i>`,
    sourceRepositoryUrl: "javascript:alert(1)",
  });
  const html = skillEntryHtml(hostile, 0);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<b>evil<\/b>/);
  assert.doesNotMatch(html, /<i>1\.0<\/i>/);
  assert.match(html, /&lt;script&gt;/);
  // safeHttpUrl collapses anything non-http(s) to "#".
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /href="#"/);
});

test("a hostile category id cannot break out of the data attribute", () => {
  const html = skillEntryHtml(unknownEntry({ category: { id: `" onmouseover="alert(1)`, label: "X", basis: "none" } }), 0);
  // The quote is escaped, so the payload stays inert *inside* the attribute value and never
  // becomes a real attribute. Assert on the unescaped form: `onmouseover="` with a raw quote.
  assert.doesNotMatch(html, / onmouseover="/);
  assert.match(html, /data-category="&quot; onmouseover=&quot;alert\(1\)"/);
});

test("the first entry is featured, giving the list one dominant element instead of a card grid", () => {
  const html = skillLibraryHtml([unknownEntry({ resourceId: "a" }), unknownEntry({ resourceId: "b" })]);
  assert.equal((html.match(/libRow--feature/g) ?? []).length, 1);
  assert.match(html, /^<ol class="library">/);
  // Numbered editorial rows, not repeated identical cards.
  assert.match(html, /libIndex" aria-hidden="true">01</);
  assert.match(html, /libIndex" aria-hidden="true">02</);
});

test("an empty library says so plainly rather than inventing filler", () => {
  const html = skillLibraryHtml([]);
  assert.match(html, /holds no library resources on this deployment yet/);
  assert.match(html, /Nothing is invented to fill the space/);
  assert.doesNotMatch(html, /libRow/);
});

test("an entry with no catalog row cannot link to an Evidence Passport it does not have", () => {
  const html = skillEntryHtml(unknownEntry({ resourceId: null }), 0);
  assert.doesNotMatch(html, /href="\/resources\//);
  assert.match(html, /No catalog row — no passport to open\./);
});

test("empty categories render disabled rather than hidden, so the taxonomy stays honest", () => {
  const html = categoryFilterHtml(browsableCategories(), { "frontend-design": 1 }, null);
  assert.match(html, /Frontend \/ Design <span class="catCount">1<\/span>/);
  // A zero-count category is still shown, and is not clickable.
  assert.match(html, /catChip--empty[^>]*disabled/);
  assert.match(html, /DeFi <span class="catCount">0<\/span>/);
});
