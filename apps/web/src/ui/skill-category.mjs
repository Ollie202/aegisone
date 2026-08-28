// Deterministic skill-library category classifier (ADR-016).
//
// ==========================================================================================
// TRUST BOUNDARY — read this before changing anything in this file.
// ==========================================================================================
// A category is **discovery/browse metadata only**. It sits in exactly the same invariant class
// as a search relevance score (AGENTS.md: "Search relevance/ranking is never a trust or safety
// score and must not enter deterministic policy evaluation"):
//
//   - It is computed in the *view* layer, at render time, from a resource's already-public
//     name/description/tags/kind.
//   - It is NEVER persisted onto a catalog row, NEVER placed inside a `CapabilityTrustEvidence`
//     object, and NEVER passed to `evaluateTrustPolicy`.
//   - The library entry type keeps `category` as a *sibling* of `capability`, never nested inside
//     `capability.trust` — see `apps/web/src/library.ts`.
//
// This module therefore has **zero imports**. That is deliberate and load-bearing: it is
// structurally incapable of reading or producing a trust/evidence/policy value, and
// `apps/web/test/skill-category.test.ts` asserts the import list stays empty.
//
// ==========================================================================================
// HOW CLASSIFICATION WORKS (fully deterministic, documented, no LLM, no heuristic "vibe")
// ==========================================================================================
// 1. A curated override table (`CURATED_CATEGORIES`) is consulted first, keyed by a resource's
//    stable canonical URL. This is how deliberately seeded library resources get an editorially
//    chosen category instead of an inferred one.
// 2. Otherwise the resource's searchable text (name + description + tags) is lowercased and each
//    category's keyword list is tested. A category scores 1 point per *distinct* keyword it
//    matches. Keywords are matched on token/phrase boundaries, never as bare substrings, so
//    "data" does not match "validate" and "ui" does not match "build".
// 3. The highest-scoring category wins. Ties are broken by the fixed `CATEGORY_ORDER` below —
//    never randomly, never by insertion order of a Map, never by score magnitude alone.
// 4. If no keyword matched at all, a resource *kind* of `mcp-server`/`a2a-agent` maps to
//    `agents-mcp` (that is a definitional fact about the kind, not a guess about the content).
// 5. Anything still unmatched is `uncategorized`. It is never guessed into a bucket, and
//    `uncategorized` is rendered as an explicit, visible state — not hidden and not defaulted
//    into a more flattering category.

/** Fixed presentation + tie-break order. The first entry of a tie wins, deterministically. */
export const CATEGORY_ORDER = [
  "frontend-design",
  "defi",
  "smart-contracts",
  "research",
  "automation",
  "developer-tools",
  "data",
  "agents-mcp",
  "security",
  "uncategorized",
];

export const CATEGORY_LABELS = {
  "frontend-design": "Frontend / Design",
  defi: "DeFi",
  "smart-contracts": "Smart Contracts",
  research: "Research",
  automation: "Automation",
  "developer-tools": "Developer Tools",
  data: "Data",
  "agents-mcp": "Agents / MCP",
  security: "Security",
  uncategorized: "Uncategorized",
};

/**
 * The complete, auditable keyword table. Every entry is a literal word or phrase; there is no
 * regex authored by a caller and no wildcard. Adding a keyword here is the *only* way to change
 * how anything classifies.
 */
export const CATEGORY_KEYWORDS = {
  "frontend-design": [
    "frontend", "front-end", "front end", "ui", "ux", "user interface", "design", "design system",
    "css", "tailwind", "react", "vue", "svelte", "next.js", "nextjs", "landing page", "typography",
    "layout", "figma", "component library", "web design", "brutalist", "styling", "stylesheet",
    "responsive", "animation", "accessibility", "wireframe", "visual",
  ],
  defi: [
    "defi", "swap", "liquidity", "yield", "lending", "borrow", "amm", "dex", "staking", "stake",
    "perpetual", "vault", "farming", "liquidity pool", "slippage", "stablecoin", "treasury",
    "portfolio", "trading", "market maker", "collateral",
  ],
  "smart-contracts": [
    "smart contract", "smart contracts", "solidity", "vyper", "evm", "erc-20", "erc20", "erc-721",
    "erc721", "nft", "hardhat", "foundry", "abi", "on-chain", "onchain", "blockchain", "ethereum",
    "gas optimization", "contract deployment", "bytecode", "web3", "wallet", "testnet", "mainnet",
  ],
  research: [
    "research", "paper", "papers", "arxiv", "literature", "citation", "citations", "survey",
    "study", "academic", "bibliography", "systematic review", "summarize", "summarization",
    "fact check", "knowledge base", "note taking", "notes",
  ],
  automation: [
    "automation", "automate", "workflow", "workflows", "scheduler", "scheduling", "cron",
    "pipeline", "orchestration", "orchestrate", "bot", "rpa", "trigger", "webhook", "integration",
    "batch job", "task runner", "no-code",
  ],
  "developer-tools": [
    "developer", "developer tool", "cli", "command line", "git", "github", "gitlab", "lint",
    "linter", "test", "testing", "debug", "debugger", "compiler", "sdk", "api client", "refactor",
    "refactoring", "code review", "pull request", "ide", "terminal", "build tool", "package manager",
    "documentation", "changelog", "code quality", "static analysis",
  ],
  data: [
    "data", "dataset", "datasets", "csv", "sql", "database", "etl", "analytics", "parquet",
    "dataframe", "pandas", "warehouse", "embedding", "embeddings", "vector", "vector database",
    "query", "schema", "ingestion", "extraction", "parsing", "spreadsheet", "json", "scraping",
    "visualization", "dashboard", "metrics",
  ],
  "agents-mcp": [
    "mcp", "model context protocol", "agent", "agents", "a2a", "agent-to-agent", "multi-agent",
    "autonomous agent", "tool server", "agent card", "tool calling", "function calling",
    "agentic", "assistant", "copilot", "llm", "prompt",
  ],
  security: [
    "security", "vulnerability", "vulnerabilities", "exploit", "malware", "phishing", "cve",
    "threat", "threat model", "sast", "dast", "pentest", "penetration test", "secrets", "secret scanning",
    "credential", "hardening", "sandbox", "supply chain", "audit", "auditing", "compliance",
    "authentication", "authorization", "encryption",
  ],
};

/**
 * Editorially curated categories for resources this repository deliberately seeds into the
 * library (ADR-016). Keyed by the resource's stable canonical URL so it survives id/uuid changes.
 * A curated entry always wins over keyword inference, and is the honest way to say "a human chose
 * this", rather than pretending the classifier inferred it.
 */
export const CURATED_CATEGORIES = {
  "https://github.com/Ollie202/goat_cookbook": "frontend-design",
};

/** Escapes a literal keyword for safe use inside a generated word-boundary RegExp. */
function escapeRegExpLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-token/phrase match. `(^|[^a-z0-9])` / `([^a-z0-9]|$)` guards mean "data" matches
 * "data extraction" and "csv/data" but NOT "validate" or "metadata"; "ui" matches "ui kit" but not
 * "build" or "guide". Keywords containing `.`/`-` (e.g. "next.js", "erc-20") still work because
 * those characters are themselves non-alphanumeric boundaries.
 */
function matchesKeyword(haystack, keyword) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExpLiteral(keyword)}([^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

/** Builds the single lowercase text blob a resource is classified from. Nothing here reads any
 * trust/evidence/policy field — only the public descriptive metadata a discovery provider or a
 * catalog row already exposes. */
export function categorySearchText(input) {
  const tags = Array.isArray(input?.tags) ? input.tags : [];
  return [input?.name ?? "", input?.description ?? "", ...tags].join(" \n ").toLowerCase();
}

/**
 * Deterministic classification. Same input always produces the same output; no clock, no random,
 * no network, no model.
 *
 * @param {{ name?: string, description?: string, tags?: string[], kind?: string, canonicalUrl?: string|null }} input
 * @returns {{ id: string, label: string, basis: "curated" | "keyword" | "kind" | "none", matchedKeywords: string[] }}
 */
export function classifySkillCategory(input) {
  const curated = input?.canonicalUrl ? CURATED_CATEGORIES[input.canonicalUrl] : undefined;
  if (curated && Object.hasOwn(CATEGORY_LABELS, curated)) {
    return { id: curated, label: CATEGORY_LABELS[curated], basis: "curated", matchedKeywords: [] };
  }

  const haystack = categorySearchText(input);
  let best = null;
  // CATEGORY_ORDER drives iteration, so an equal score always resolves to the earlier category.
  for (const id of CATEGORY_ORDER) {
    const keywords = CATEGORY_KEYWORDS[id];
    if (!keywords) continue;
    const matched = keywords.filter((keyword) => matchesKeyword(haystack, keyword));
    if (matched.length === 0) continue;
    if (best === null || matched.length > best.matchedKeywords.length) {
      best = { id, label: CATEGORY_LABELS[id], basis: "keyword", matchedKeywords: matched };
    }
  }
  if (best) return best;

  // Definitional, not inferential: an MCP server / A2A agent *is* an Agents / MCP resource by kind.
  if (input?.kind === "mcp-server" || input?.kind === "a2a-agent") {
    return { id: "agents-mcp", label: CATEGORY_LABELS["agents-mcp"], basis: "kind", matchedKeywords: [] };
  }

  return { id: "uncategorized", label: CATEGORY_LABELS.uncategorized, basis: "none", matchedKeywords: [] };
}

/** All browsable categories in presentation order, excluding the explicit `uncategorized` bucket
 * (which is rendered, but is not offered as a browse destination). */
export function browsableCategories() {
  return CATEGORY_ORDER.filter((id) => id !== "uncategorized").map((id) => ({ id, label: CATEGORY_LABELS[id] }));
}
