import { escapeHtml } from "../ui/escape.mjs";
import { resultListHtml } from "../ui/result-card.mjs";
import { skillLibraryHtml, categoryFilterHtml } from "../ui/skill-card.mjs";
import type { SkillLibrary } from "../library.ts";
import { escapeObjectsHtml, renderLayoutHtml } from "./layout.ts";

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
  return `<svg viewBox="0 0 460 360" role="img" aria-label="Outlined skill packages scattered at several depths: three on a shelf, one lifted out under a magnifier with most of its evidence slots still empty, plus far packages, a comparison arrow and a claimed link">
  <g color="#0a0a0a">
    <!-- FAR depth: small, thin, low-contrast. A package indexed and nothing more. -->
    <g transform="rotate(-6 58 42)" opacity=".55">
      <use href="#ic-cube" x="36" y="16" width="44" height="47"/>
    </g>
    <g transform="rotate(5 403 60)" opacity=".55">
      <use href="#ic-cube" x="384" y="38" width="38" height="40"/>
    </g>
    <!-- FAR: one record linked to another. Dashed, because a claimed link is not a proven one. -->
    <g transform="rotate(3 150 40)" opacity=".72">
      <circle cx="120" cy="40" r="9" fill="none" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M131 40h30" fill="none" stroke="#0a0a0a" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 5"/>
      <rect x="163" y="31" width="18" height="18" rx="5" fill="#0a0a0a"/>
    </g>

    <!-- MID depth: the shelf of indexed, unexamined packages. -->
    <rect x="20" y="258" width="292" height="16" rx="8" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3.5"/>
    <path d="M40 274 V330 M292 274 V330" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    <g transform="rotate(-5 84 210)">
      <rect x="47" y="162" width="74" height="96" rx="11" fill="#d8e1ff" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="58" y="234" width="52" height="13" rx="6.5" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M60 184 H108 M60 200 H94" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(3 165 204)">
      <rect x="128" y="150" width="74" height="108" rx="11" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="139" y="234" width="52" height="13" rx="6.5" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M141 174 H189 M141 190 H175" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(-3 247 214)">
      <rect x="210" y="170" width="74" height="88" rx="11" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="221" y="234" width="52" height="13" rx="6.5" fill="#efece2" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M223 194 H271" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>

    <!-- The chunky comparison arrow: the act of pulling one out to actually look at it. -->
    <g transform="rotate(-16 232 121)">
      <use href="#ic-zig" x="196" y="100" width="72" height="42"/>
    </g>

    <!-- NEAR depth: the lifted package. Largest, heaviest-outlined object in the cluster. -->
    <g class="float" style="transform-origin:352px 118px">
      <g transform="rotate(6 352 118)">
        <rect x="292" y="48" width="120" height="140" rx="16" fill="#22dceb" stroke="#0a0a0a" stroke-width="4"/>
        <use href="#ic-bytegrid" x="311" y="64" width="58" height="58"/>
        <!-- Five evidence slots, two filled: the honest state of almost everything in a discovery
             catalog is "a couple of dimensions known, most still blank". -->
        <rect x="306" y="140" width="16" height="16" rx="4" fill="#0a0a0a"/>
        <rect x="326" y="140" width="16" height="16" rx="4" fill="#0a0a0a"/>
        <rect x="346" y="140" width="16" height="16" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="366" y="140" width="16" height="16" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="386" y="140" width="16" height="16" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="306" y="166" width="70" height="12" rx="6" fill="#fffdf7" stroke="#0a0a0a" stroke-width="2.5"/>
      </g>
    </g>

    <!-- NEAR: the magnifier doing the examining, deliberately overlapping the lifted package. -->
    <g transform="rotate(-10 292 164)">
      <circle cx="292" cy="164" r="43" fill="#b79cff" fill-opacity="0.34" stroke="#0a0a0a" stroke-width="4.5"/>
      <path d="M262 194 L232 224" fill="none" stroke="#0a0a0a" stroke-width="9" stroke-linecap="round"/>
    </g>

    <!-- NEAR: a detached evidence slot, one filled and one empty, tumbled clear of the cluster. -->
    <g class="float--slow" style="transform-origin:414px 258px">
      <g transform="rotate(14 414 258)">
        <rect x="382" y="236" width="64" height="44" rx="13" fill="#fffdf7" stroke="#0a0a0a" stroke-width="4"/>
        <rect x="392" y="248" width="16" height="16" rx="4" fill="#0a0a0a"/>
        <rect x="414" y="248" width="16" height="16" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3.5"/>
      </g>
    </g>

    <!-- MID: the question token. Discovery finds things; it does not answer for them. -->
    <g class="float--slow" style="transform-origin:34px 118px">
      <circle cx="34" cy="118" r="18" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3.5"/>
      <path d="M27 111 A7 7 0 1 1 34 119 V123" fill="none" stroke="#0a0a0a" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="34" cy="131" r="2.4" fill="#0a0a0a"/>
    </g>
    <use href="#ic-arrow" x="94" y="300" width="30" height="30" transform="rotate(8 109 315)" opacity=".6"/>
  </g>
</svg>`;
}

/** Three example *queries* rendered as the hero's category pills (design skill §15 step 6).
 * Deliberately queries, not results: nothing pre-populates the results region. */
// Every example must describe a SKILL someone is looking for. Earlier copy here advertised
// "Audit a Solidity contract" and "Deploy a Next.js app", which read as things AegisOne does —
// it does neither. This page finds skills and points at auditing them; nothing else.
//
// The three carry *varied* treatments — solid ink, solid cyan, outlined — each with its own small
// glyph (design skill §7 chips). They stay real, clickable queries: the query text is the label,
// unchanged, and clicking one runs a genuine search against the real backend. The variation is
// composition only; it encodes no ranking, category or trust meaning, and every chip keeps the
// same ink outline, the same size and the same interaction.
const EXAMPLES: ReadonlyArray<{ query: string; tone: "ink" | "cyan" | "outline"; glyph: string }> = [
  { query: "Pull request review", tone: "ink", glyph: "◧" },
  { query: "Code documentation", tone: "cyan", glyph: "▤" },
  { query: "Data extraction", tone: "outline", glyph: "◇" },
];

/**
 * The five objects that break the frame boundary on this page (design skill §15 step 9).
 *
 * Each one has a reason, and each is a member of the page's existing shape family:
 *   tl  a far, small package — the catalog continues past the edge of what is on screen;
 *   tr  an outlined byte-grid tile — the bytes, detached from any one record;
 *   rt  a near, large outlined package — the unit of thing this page is about, tipped out of the
 *       frame at the point where the illustration cluster runs out of room;
 *   bl  a dashed connector — a claimed link between two records, running off-page;
 *   br  an empty evidence slot — the missing dimension, escaping into the margin.
 *
 * Slot geometry keeps every one of them in the page gutter and away from the search box, the
 * pill row and the CTA row; all are `pointer-events:none` and `aria-hidden`, and all disappear
 * below 960px (see `.escape` in `layout.ts`).
 */
const HERO_ESCAPES = escapeObjectsHtml([
  { slot: "tl", shape: "cube", depth: "far", drift: "slow" },
  { slot: "tr", shape: "bytegrid", depth: "far" },
  { slot: "rt", shape: "cube", depth: "near", drift: "fast" },
  { slot: "bl", shape: "node", depth: "far" },
  { slot: "br", shape: "chip", depth: "near", drift: "slow" },
]);

export function renderSkillsPageHtml(state: SkillsPageState): string {
  const searching = state.searchResponse !== null || state.searchError !== null;

  const examples = EXAMPLES.map(
    (example) =>
      `<button type="button" class="pill exampleChip pill--${example.tone}" data-example="${escapeHtml(example.query)}"><span class="pill__glyph" aria-hidden="true">${escapeHtml(example.glyph)}</span>${escapeHtml(example.query)}</button>`,
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
      ${HERO_ESCAPES}
      <div class="heroCopy">
        <div class="pillRow">${examples}</div>
        <h1 class="tight">Find a skill. See what's <span class="capsule">actually</span> proven.</h1>
        <p class="lede">Every entry shows audited, verified and stored separately. Where there is no evidence, it says so.</p>
        <form class="searchForm" id="search-form" method="GET" action="/">
          <input type="search" name="q" id="search-input" placeholder="e.g. review a pull request" value="${escapeHtml(state.query)}" autocomplete="off" aria-label="Search capabilities">
          <button class="button button--primary" type="submit">Search <span class="arrow" aria-hidden="true">→</span></button>
        </form>
        <div class="ctaRow" style="margin-bottom:18px">
          <a class="button button--primary" href="#library-region">Browse the catalog <span class="arrow" aria-hidden="true">→</span></a>
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
