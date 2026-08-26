import { escapeHtml } from "../ui/escape.mjs";
import { resultListHtml } from "../ui/result-card.mjs";
import { renderLayoutHtml } from "./layout.ts";

export interface HubPageState {
  query: string;
  /** `null` means no search has run yet (fresh page load with no `?q=`). */
  searchResponse: unknown | null;
  searchError: string | null;
  demoAvailable: boolean;
  demoResourceId: string | null;
}

const EXAMPLES = ["Review a pull request", "Audit a Solidity contract", "Deploy a Next.js app", "Analyze a repository"];

export function renderHubPageHtml(state: HubPageState): string {
  const examples = EXAMPLES.map((example) => `<button type="button" class="button exampleChip" data-example="${escapeHtml(example)}">${escapeHtml(example)}</button>`).join("");

  const resultsHtml = state.searchError
    ? `<p class="errorText">Search failed: ${escapeHtml(state.searchError)}</p>`
    : state.searchResponse
      ? resultListHtml(state.searchResponse)
      : `<p class="searchHint">Search calls the real AegisOne discovery backend (local catalog and, when selected, federated providers). Results always separate discovery/relevance from AegisOne-verified evidence.</p>`;

  const demoBanner = state.demoAvailable && state.demoResourceId
    ? `<div class="demoBanner">Demo mode available: <a href="/resources/${encodeURIComponent(state.demoResourceId)}?demo=1">open the labeled M8.9 demo-fixture Evidence Passport</a> (genuine MATCH vs. controlled MISMATCH), reusing M8.9's real tested fixture identity/content — not live production evidence.</div>`
    : "";

  const body = `
    <h1>What capability does your agent need?</h1>
    <p>Search across AegisOne's discovery catalog. Discovery finds candidates; it does not authenticate a publisher or prove correspondence.</p>
    ${demoBanner}
    <form class="searchForm" id="search-form" method="GET" action="/">
      <input type="search" name="q" id="search-input" placeholder="e.g. review a pull request" value="${escapeHtml(state.query)}" autocomplete="off">
      <button class="button button--primary" type="submit">Search</button>
    </form>
    <div class="federationRow">
      <span>Try:</span>
      ${examples}
    </div>
    <div class="federationRow">
      <label><input type="checkbox" id="federation-toggle"> Include federated providers (GitHub Agent Finder, Hugging Face Discover, MCP Registry)</label>
    </div>
    <div id="search-results">${resultsHtml}</div>
  `;

  return renderLayoutHtml({
    title: "AegisOne Hub — capability search",
    activeNav: "hub",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="hub"></script>`,
  });
}
