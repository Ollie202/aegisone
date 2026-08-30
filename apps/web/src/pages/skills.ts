import { escapeHtml } from "../ui/escape.mjs";
import { resultListHtml } from "../ui/result-card.mjs";
import { skillLibraryHtml, categoryFilterHtml } from "../ui/skill-card.mjs";
import type { SkillLibrary } from "../library.ts";
import { renderLayoutHtml } from "./layout.ts";

/**
 * SKILLS — section 1 of the four-section IA (ADR-016), served at `/`.
 *
 * This is a **quality-focused skill library**, not a generic marketplace and not the ARD fixture
 * catalog. Two rules make that concrete:
 *
 *   1. The library block renders only real rows from the AegisOne catalog store, assembled through
 *      the same evidence path the Evidence Passport uses (`apps/web/src/library.ts`). The four
 *      pinned ARD protocol fixtures still back `POST /search` and `/.well-known/ai-catalog.json`
 *      unchanged, but they can never appear here.
 *   2. Every entry shows its real independent dimensions, with unknowns rendered as the word
 *      "unknown". There is no aggregate score, no SAFE badge, and no blank-implies-good cell.
 *
 * Search is preserved exactly as it was (SSR `?q=`, client-side `POST /search`, federation
 * toggle). When a search is active the library is hidden and results take its place; clearing the
 * query restores the library.
 */

export interface SkillsPageState {
  query: string;
  /** `null` means no search has run yet (fresh page load with no `?q=`). */
  searchResponse: unknown | null;
  searchError: string | null;
  library: SkillLibrary;
  demoAvailable: boolean;
  demoResourceId: string | null;
}

/**
 * The hero illustration cluster — one dominant, original visual metaphor for this page
 * (design skill §15 Hero Formula step 5, §16 Design Restraint Rules).
 *
 * The metaphor: **skill packages on a shelf, one lifted out and examined.** The lifted package
 * shows a byte grid and a strip of five dimension slots of which only two are filled — because
 * that is the honest state of almost everything in a discovery catalog: a few dimensions known,
 * most still blank.
 *
 * Note what is deliberately absent: the `#ic-stamp` verdict stamp. The stamp means AegisOne
 * actually holds correspondence evidence, so pressing it onto a hero full of merely-indexed
 * packages would be exactly the overstatement this product exists to refuse. Inline SVG only —
 * no external asset request, no raster art.
 */
function heroArtSvg(): string {
  return `<svg viewBox="0 0 440 340" role="img" aria-label="Outlined skill packages on a shelf, with one lifted out and examined under a magnifier; its evidence slots are mostly empty">
  <g color="#0a0a0a">
    <!-- shelf -->
    <rect x="20" y="246" width="292" height="16" rx="8" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3.5"/>
    <path d="M40 262 V314 M292 262 V314" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>

    <!-- packages still on the shelf: indexed, unexamined -->
    <g transform="rotate(-5 84 198)">
      <rect x="47" y="150" width="74" height="96" rx="11" fill="#d8e1ff" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="58" y="222" width="52" height="13" rx="6.5" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M60 172 H108 M60 188 H94" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(3 165 192)">
      <rect x="128" y="138" width="74" height="108" rx="11" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="139" y="222" width="52" height="13" rx="6.5" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M141 162 H189 M141 178 H175" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(-3 247 202)">
      <rect x="210" y="158" width="74" height="88" rx="11" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="221" y="222" width="52" height="13" rx="6.5" fill="#efece2" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M223 182 H271" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>

    <!-- the lifted package, under examination -->
    <g class="float" style="transform-origin:352px 112px">
      <g transform="rotate(7 352 112)">
        <rect x="296" y="46" width="112" height="132" rx="15" fill="#22dceb" stroke="#0a0a0a" stroke-width="3.5"/>
        <use href="#ic-bytegrid" x="314" y="62" width="54" height="54"/>
        <!-- five evidence slots; only two are filled, because most dimensions are genuinely unknown -->
        <rect x="310" y="132" width="15" height="15" rx="4" fill="#0a0a0a"/>
        <rect x="329" y="132" width="15" height="15" rx="4" fill="#0a0a0a"/>
        <rect x="348" y="132" width="15" height="15" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="367" y="132" width="15" height="15" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="386" y="132" width="15" height="15" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="310" y="156" width="66" height="11" rx="5.5" fill="#fffdf7" stroke="#0a0a0a" stroke-width="2.5"/>
      </g>
    </g>

    <!-- magnifier doing the examining -->
    <g transform="rotate(-10 296 152)">
      <circle cx="296" cy="152" r="40" fill="#b79cff" fill-opacity="0.35" stroke="#0a0a0a" stroke-width="4"/>
      <path d="M268 180 L242 208" fill="none" stroke="#0a0a0a" stroke-width="8" stroke-linecap="round"/>
    </g>

    <!-- decorative objects breaking the composition edge -->
    <g class="float--slow" style="transform-origin:34px 52px">
      <circle cx="34" cy="52" r="17" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3.5"/>
      <path d="M28 46 A6.5 6.5 0 1 1 34 53 V57" fill="none" stroke="#0a0a0a" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="34" cy="64" r="2.2" fill="#0a0a0a"/>
    </g>
    <rect x="404" y="236" width="26" height="26" rx="7" fill="#b79cff" stroke="#0a0a0a" stroke-width="3.5" transform="rotate(16 417 249)"/>
    <use href="#ic-arrow" x="196" y="96" width="26" height="26" transform="rotate(-24 209 109)"/>
  </g>
</svg>`;
}

/** Three example *queries* rendered as the hero's category pills (design skill §15 step 6).
 * Deliberately queries, not results: nothing pre-populates the results region. */
// Every example must describe a SKILL someone is looking for. Earlier copy here advertised
// "Audit a Solidity contract" and "Deploy a Next.js app", which read as things AegisOne does —
// it does neither. This page finds skills and points at auditing them; nothing else.
const EXAMPLES = ["Pull request review", "Code documentation", "Data extraction"];

export function renderSkillsPageHtml(state: SkillsPageState): string {
  const searching = state.searchResponse !== null || state.searchError !== null;

  const examples = EXAMPLES.map(
    (example) => `<button type="button" class="pill exampleChip" data-example="${escapeHtml(example)}">${escapeHtml(example)}</button>`,
  ).join("");

  const resultsHtml = state.searchError
    ? `<p class="errorText">Search failed: ${escapeHtml(state.searchError)}</p>`
    : state.searchResponse
      ? resultListHtml(state.searchResponse)
      : "";

  const demoBanner = state.demoAvailable && state.demoResourceId
    ? `<div class="demoBanner">Demo mode available: <a href="/resources/${encodeURIComponent(state.demoResourceId)}?demo=1">open the labeled M8.9 demo-fixture Evidence Passport</a> (genuine MATCH vs. controlled MISMATCH), reusing M8.9's real tested fixture identity/content — not live production evidence.</div>`
    : "";

  const libraryRegion = `
    <div id="library-region"${searching ? " hidden" : ""}>
      <div class="sectionHeadRow">
        <h2>In the AegisOne catalog</h2>
        <span class="eyebrow">${state.library.entries.length} resource${state.library.entries.length === 1 ? "" : "s"}</span>
      </div>
      <p class="sectionNote">Real rows AegisOne's own catalog holds, each linking to its full Evidence Passport. This is deliberately small and real — the ARD protocol fixtures that make <code>/search</code> and <code>/.well-known/ai-catalog.json</code> conformant are not shown here and never will be.</p>
      ${categoryFilterHtml(state.library.categories, state.library.counts, null)}
      ${skillLibraryHtml(state.library.entries)}
    </div>`;

  // Loaded client-side after first paint (see app.js): a page load must not block on three
  // upstream discovery APIs, and AGENTS.md requires discovery to stay cheap and read-only.
  const liveStrip = `
    <section class="liveStrip" id="live-federated">
      <div class="sectionHeadRow">
        <h2>Live from federated providers</h2>
        <span class="eyebrow">Discovery only</span>
      </div>
      <p class="sectionNote">Real, live results from the MCP Official Registry, GitHub Agent Finder and Hugging Face Discover. These are not AegisOne catalog rows and carry no AegisOne evidence — being findable is not being verified.</p>
      <div class="federationRow">
        <button type="button" class="button" id="live-federated-load">Discover live <span class="arrow" aria-hidden="true">→</span></button>
      </div>
      <div id="live-federated-results"><p class="emptyState">Not loaded yet. Nothing is shown here until a real federated query has actually run.</p></div>
    </section>`;

  const body = `
    <section class="hero">
      <div class="heroCopy">
        <div class="pillRow">${examples}</div>
        <h1 class="tight">Find a skill. See what's <span class="mark">actually proven</span>.</h1>
        <p class="lede">Every entry shows audited, verified and stored separately. Where there is no evidence, it says so.</p>
        <form class="searchForm" id="search-form" method="GET" action="/">
          <input type="search" name="q" id="search-input" placeholder="e.g. review a pull request" value="${escapeHtml(state.query)}" autocomplete="off" aria-label="Search capabilities">
          <button class="button button--primary" type="submit">Search <span class="arrow" aria-hidden="true">→</span></button>
        </form>
        <div class="ctaRow" style="margin-bottom:18px">
          <a class="button" href="/audit">Audit a skill you already have <span class="arrow" aria-hidden="true">→</span></a>
        </div>
      </div>
      <div class="heroArt">${heroArtSvg()}</div>
    </section>
    ${demoBanner}
    <div class="federationRow">
      <label><input type="checkbox" id="federation-toggle"> Include federated providers in search (GitHub Agent Finder, Hugging Face Discover, MCP Registry)</label>
    </div>
    <div id="search-results">${resultsHtml}</div>
    ${libraryRegion}
    ${liveStrip}
  `;

  return renderLayoutHtml({
    title: "AegisOne — skill library with evidence attached",
    activeNav: "skills",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="skills"></script>`,
  });
}
