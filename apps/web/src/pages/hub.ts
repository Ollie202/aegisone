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

/**
 * Example *queries* (docs/18-m9-frontend-plan.md "Hub / Search"), rendered as the hero's three
 * category pills. Deliberately three, per the design language's Hero Formula and its Design
 * Restraint Rules — and deliberately queries rather than results: the Hub renders **no** result
 * rows until a real search has run, so a first-time visitor never sees the local ARD fixture
 * catalog presented as live search output.
 */
const EXAMPLES = ["Review a pull request", "Audit a Solidity contract", "Deploy a Next.js app"];

/**
 * The hero illustration cluster — the product's single visual metaphor (ADR-015): the publisher's
 * distributed byte grid on one side, AegisOne's independently reproduced byte grid on the other,
 * a comparison arrow between them, and the outlined stamp that is only ever pressed when real
 * evidence exists. Pure inline SVG built from the shared `#ic-*` symbols in `layout.ts` — no
 * external asset request, no raster art.
 */
function heroArtSvg(): string {
  return `<svg viewBox="0 0 420 340" role="img" aria-label="Two byte grids compared side by side beneath an outlined verification stamp">
  <g color="#0a0a0a">
    <!-- distributed artifact -->
    <g transform="rotate(-5 95 210)">
      <rect x="30" y="150" width="130" height="130" rx="18" fill="#d8e1ff" stroke="#0a0a0a" stroke-width="3"/>
      <use href="#ic-bytegrid" x="55" y="175" width="80" height="80"/>
      <rect x="30" y="292" width="118" height="24" rx="12" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
      <text x="89" y="309" font-size="11" font-weight="900" letter-spacing="1.4" text-anchor="middle" fill="#0a0a0a">DISTRIBUTED</text>
    </g>
    <!-- reproduced artifact -->
    <g transform="rotate(5 325 210)">
      <rect x="260" y="150" width="130" height="130" rx="18" fill="#22dceb" stroke="#0a0a0a" stroke-width="3"/>
      <use href="#ic-bytegrid" x="285" y="175" width="80" height="80"/>
      <rect x="272" y="292" width="118" height="24" rx="12" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
      <text x="331" y="309" font-size="11" font-weight="900" letter-spacing="1.4" text-anchor="middle" fill="#0a0a0a">REPRODUCED</text>
    </g>
    <!-- comparison arrows -->
    <use href="#ic-arrow" x="176" y="180" width="30" height="30"/>
    <g transform="rotate(180 205 235)"><use href="#ic-arrow" x="190" y="220" width="30" height="30"/></g>
    <!-- the stamp -->
    <g class="float" style="transform-origin:210px 70px">
      <use href="#ic-stamp" x="150" y="8" width="124" height="124"/>
      <circle cx="212" cy="72" r="30" fill="#ffd91a"/>
      <path d="M198 72l10 11 20-22" fill="none" stroke="#0a0a0a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
}

export function renderHubPageHtml(state: HubPageState): string {
  const examples = EXAMPLES.map(
    (example) => `<button type="button" class="pill exampleChip" data-example="${escapeHtml(example)}">${escapeHtml(example)}</button>`,
  ).join("");

  const resultsHtml = state.searchError
    ? `<p class="errorText">Search failed: ${escapeHtml(state.searchError)}</p>`
    : state.searchResponse
      ? resultListHtml(state.searchResponse)
      : `<p class="emptyState" id="search-empty-state">No search yet — nothing is shown here until you run one. Type a capability above or pick one of the three examples; results come from the real AegisOne discovery backend (local catalog, plus federated providers when selected) and always separate discovery and relevance from AegisOne-verified evidence.</p>`;

  const demoBanner = state.demoAvailable && state.demoResourceId
    ? `<div class="demoBanner">Demo mode available: <a href="/resources/${encodeURIComponent(state.demoResourceId)}?demo=1">open the labeled M8.9 demo-fixture Evidence Passport</a> (genuine MATCH vs. controlled MISMATCH), reusing M8.9's real tested fixture identity/content — not live production evidence.</div>`
    : "";

  const body = `
    <section class="hero">
      <div class="heroCopy">
        <div class="pillRow">${examples}</div>
        <h1>What capability does your <span class="mark">agent</span> need?</h1>
        <p class="lede">Discovery finds candidates. It does not authenticate a publisher, and it does not prove that the bytes you would install were built from the source anyone claims.</p>
        <form class="searchForm" id="search-form" method="GET" action="/">
          <input type="search" name="q" id="search-input" placeholder="e.g. review a pull request" value="${escapeHtml(state.query)}" autocomplete="off" aria-label="Search capabilities">
          <button class="button button--primary" type="submit">Search <span class="arrow" aria-hidden="true">→</span></button>
        </form>
        <div class="ctaRow" style="margin-bottom:18px">
          <a class="button" href="/scan">Paste a skill instead <span class="arrow" aria-hidden="true">→</span></a>
        </div>
      </div>
      <div class="heroArt">${heroArtSvg()}</div>
    </section>
    ${demoBanner}
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
