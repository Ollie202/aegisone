import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_KEYWORDS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  browsableCategories,
  classifySkillCategory,
} from "../src/ui/skill-category.mjs";
import { categoryArtIds, categoryArtSvg } from "../src/ui/category-art.mjs";

/**
 * ADR-016: the category classifier is deterministic, documented, and structurally incapable of
 * touching trust or policy. These tests hold that line.
 */

test("classification is deterministic — the same input always yields the same category", () => {
  const input = { name: "Solidity gas optimizer", description: "Analyse smart contract bytecode", tags: ["evm"] };
  const first = classifySkillCategory(input);
  for (let i = 0; i < 50; i += 1) {
    assert.deepEqual(classifySkillCategory(input), first);
  }
});

test("a curated category wins over keyword inference, and is labelled as curated", () => {
  const result = classifySkillCategory({
    name: "Playful Neo-Brutalist Web Design",
    description: "A design guide",
    canonicalUrl: "https://github.com/Ollie202/goat_cookbook",
  });
  assert.equal(result.id, "frontend-design");
  assert.equal(result.basis, "curated");
});

test("the highest keyword score wins, and ties break by the fixed CATEGORY_ORDER", () => {
  // "react"/"css"/"layout"/"typography" → frontend-design scores 4.
  const design = classifySkillCategory({ name: "React CSS layout and typography helper", description: "" });
  assert.equal(design.id, "frontend-design");
  assert.ok(design.matchedKeywords.length >= 4);

  // A single keyword from each of two categories must resolve by CATEGORY_ORDER, not by chance.
  const tie = classifySkillCategory({ name: "", description: "defi and vyper" });
  const defiIndex = CATEGORY_ORDER.indexOf("defi");
  const contractsIndex = CATEGORY_ORDER.indexOf("smart-contracts");
  assert.ok(defiIndex < contractsIndex, "fixture assumes defi sorts before smart-contracts");
  assert.equal(tie.id, "defi");
  assert.equal(tie.basis, "keyword");
});

test("keywords match on token boundaries, never as bare substrings", () => {
  // "data" must not match inside "validate" or "metadata".
  const notData = classifySkillCategory({ name: "Validate metadata", description: "" });
  assert.notEqual(notData.id, "data");
  // "ui" must not match inside "build" or "guide".
  const notUi = classifySkillCategory({ name: "Build guide", description: "" });
  assert.notEqual(notUi.id, "frontend-design");
  // But the real tokens do match.
  assert.equal(classifySkillCategory({ name: "CSV data extraction", description: "" }).id, "data");
  assert.equal(classifySkillCategory({ name: "UI kit", description: "" }).id, "frontend-design");
});

test("nothing is guessed into a bucket — unmatched resources are explicitly uncategorized", () => {
  const result = classifySkillCategory({ name: "Zzzz", description: "Qqqq wwww", kind: "api" });
  assert.equal(result.id, "uncategorized");
  assert.equal(result.basis, "none");
  assert.deepEqual(result.matchedKeywords, []);
  // And uncategorized is never offered as a browse destination while still being a real state.
  assert.ok(!browsableCategories().some((category) => category.id === "uncategorized"));
  assert.equal(CATEGORY_LABELS.uncategorized, "Uncategorized");
});

test("kind maps to Agents / MCP only definitionally, and only when no keyword matched", () => {
  const byKind = classifySkillCategory({ name: "Zzzz", description: "Qqqq", kind: "mcp-server" });
  assert.equal(byKind.id, "agents-mcp");
  assert.equal(byKind.basis, "kind");
  // A keyword match still outranks the kind fallback.
  const byKeyword = classifySkillCategory({ name: "Solidity contract deployment", description: "", kind: "mcp-server" });
  assert.equal(byKeyword.id, "smart-contracts");
});

test("the nine documented categories all exist, with keywords and distinct illustrations", () => {
  const expected = [
    "frontend-design",
    "defi",
    "smart-contracts",
    "research",
    "automation",
    "developer-tools",
    "data",
    "agents-mcp",
    "security",
  ];
  for (const id of expected) {
    assert.ok(CATEGORY_ORDER.includes(id), `missing category: ${id}`);
    assert.ok(CATEGORY_KEYWORDS[id]?.length > 0, `category has no keywords: ${id}`);
    assert.ok(categoryArtIds().includes(id), `category has no illustration: ${id}`);
  }
  // Every category (plus uncategorized) has its OWN illustration — the previous design reused one
  // stamp for everything, which is the explicit failure this asserts against.
  const svgs = [...expected, "uncategorized"].map((id) => categoryArtSvg(id));
  assert.equal(new Set(svgs).size, svgs.length, "two categories share an identical illustration");
});

test("category art contains no glyph that could be read as a verdict", () => {
  for (const id of categoryArtIds()) {
    const svg = categoryArtSvg(id);
    // Decorative only, so it must be hidden from assistive tech (the text label carries the state).
    assert.match(svg, /aria-hidden="true"/, id);
    // No tick/check/shield-with-approval vocabulary: a category names a topic, never a verdict.
    assert.doesNotMatch(svg, /✓|✔|check|tick|approved|verified|safe/i, id);
    // And it must never reuse the verdict stamp symbol.
    assert.doesNotMatch(svg, /#ic-stamp/, id);
  }
});

test("the classifier module has zero imports, so it cannot reach trust, evidence or policy", async () => {
  const source = await readFile(fileURLToPath(new URL("../src/ui/skill-category.mjs", import.meta.url)), "utf8");
  // No import statement of any kind. This is the structural guarantee behind ADR-016's claim that
  // a category is in the same invariant class as a relevance score.
  assert.doesNotMatch(source, /^\s*import\s/m, "skill-category.mjs must have no imports");
  assert.doesNotMatch(source, /require\s*\(/);

  // And the executable code must not name the trust/policy vocabulary at all. Comments are
  // stripped first: the module header deliberately *discusses* these names to explain what it
  // never does, and that documentation is the point rather than a violation.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  for (const forbidden of ["evaluateTrustPolicy", "sourceAssurance", "correspondence", "canonicalEvidence", "ALLOW", "DENY", "trust"]) {
    assert.doesNotMatch(code, new RegExp(`\\b${forbidden}\\b`), `classifier code must not reference ${forbidden}`);
  }
});
