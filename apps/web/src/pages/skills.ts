import { escapeHtml } from "../ui/escape.mjs";
import { resultListHtml } from "../ui/result-card.mjs";
import { skillLibraryHtml, categoryFilterHtml } from "../ui/skill-card.mjs";
import type { SkillLibrary } from "../library.ts";
import { renderLayoutHtml } from "./layout.ts";

/**
 * SKILLS — section 01 of the four-section IA, served at `/`.
 *
 * ONE JOB: **discover agent skills and capabilities.** Everything on this page either helps
 * someone find something or shows them what was found. The hierarchy is deliberate and fixed:
 *
 *     small expressive intro → DOMINANT SEARCH → category controls → the catalog → external
 *     registries, only once asked for
 *
 * What this page is NOT, and used to be: a mini-homepage. There is no audit workflow here (only a
 * small cross-link), no second "live from federated providers" product bolted below the catalog,
 * and no competing primary CTA next to Search. Search is the strongest interactive object on the
 * page, and the catalog — the actual content — starts inside the first viewport.
 *
 * Two content rules make "discovery, not verification" concrete:
 *
 *   1. The catalog renders only real rows from the AegisOne catalog store, assembled through the
 *      same evidence path the Evidence Passport uses (`apps/web/src/library.ts`). The four pinned
 *      ARD protocol fixtures still back `POST /search` and `/.well-known/ai-catalog.json`
 *      unchanged, but they can never appear here.
 *   2. Every entry shows its real independent dimensions, with unknowns rendered as the word
 *      "unknown". No aggregate score, no SAFE badge, no blank-implies-good cell. Relevance is a
 *      ranking signal and is never presented as trust.
 *
 * Search behaviour is unchanged (SSR `?q=`, client-side `POST /search`, federation scope). When a
 * search is active the catalog is hidden and results take its place; clearing the query restores
 * it.
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
 * The page's ONE primary illustration: **skill packages on a shelf, one lifted out and examined.**
 * The lifted package shows a byte grid and a strip of five evidence slots of which only two are
 * filled — the honest state of almost everything in a discovery catalog: a few dimensions known,
 * most still blank.
 *
 * Two things are deliberately absent. The `#ic-stamp` verdict stamp: a stamp means AegisOne holds
 * correspondence evidence, so pressing one onto a hero full of merely-indexed packages would be
 * exactly the overstatement this product exists to refuse. And the three stray floating objects
 * that used to orbit this drawing (a question-mark bubble, a tilted square, an arrow) — none of
 * them was doing a compositional or conceptual job, so they are gone rather than shrunk.
 */
function heroArtSvg(): string {
  return `<svg viewBox="0 0 400 320" role="img" aria-label="Outlined skill packages on a shelf, with one lifted out and examined under a magnifier; its evidence slots are mostly empty">
  <g color="#0a0a0a">
    <!-- shelf -->
    <rect x="16" y="240" width="284" height="15" rx="7.5" fill="#fffdf8" stroke="#0a0a0a" stroke-width="3.5"/>
    <path d="M36 255 V304 M282 255 V304" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>

    <!-- packages still on the shelf: indexed, unexamined -->
    <g transform="rotate(-5 80 194)">
      <rect x="43" y="146" width="72" height="94" rx="11" fill="#d8e1ff" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="54" y="216" width="50" height="13" rx="6.5" fill="#fffdf8" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M56 168 H102 M56 184 H88" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(3 159 188)">
      <rect x="123" y="134" width="72" height="106" rx="11" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="134" y="216" width="50" height="13" rx="6.5" fill="#fffdf8" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M136 158 H182 M136 174 H168" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(-3 239 198)">
      <rect x="203" y="154" width="72" height="86" rx="11" fill="#fffdf8" stroke="#0a0a0a" stroke-width="3.5"/>
      <rect x="214" y="216" width="50" height="13" rx="6.5" fill="#eceadf" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M216 178 H262" fill="none" stroke="#0a0a0a" stroke-width="3.5" stroke-linecap="round"/>
    </g>

    <!-- the lifted package, under examination -->
    <g class="float" style="transform-origin:326px 106px">
      <g transform="rotate(7 326 106)">
        <rect x="272" y="42" width="108" height="128" rx="15" fill="#22dceb" stroke="#0a0a0a" stroke-width="3.5"/>
        <use href="#ic-bytegrid" x="289" y="58" width="52" height="52"/>
        <!-- five evidence slots; only two are filled, because most dimensions are genuinely unknown -->
        <rect x="286" y="126" width="15" height="15" rx="4" fill="#0a0a0a"/>
        <rect x="305" y="126" width="15" height="15" rx="4" fill="#0a0a0a"/>
        <rect x="324" y="126" width="15" height="15" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="343" y="126" width="15" height="15" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="362" y="126" width="15" height="15" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3"/>
        <rect x="286" y="150" width="64" height="11" rx="5.5" fill="#fffdf8" stroke="#0a0a0a" stroke-width="2.5"/>
      </g>
    </g>

    <!-- magnifier doing the examining -->
    <g transform="rotate(-10 272 146)">
      <circle cx="272" cy="146" r="39" fill="#b79cff" fill-opacity="0.34" stroke="#0a0a0a" stroke-width="4"/>
      <path d="M245 173 L220 200" fill="none" stroke="#0a0a0a" stroke-width="8" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
}

/**
 * Example *queries* — deliberately queries, not results: clicking one runs a real search against
 * the real backend, and nothing pre-populates the results region.
 *
 * Every example must describe a SKILL someone is looking for. Earlier copy here advertised "Audit
 * a Solidity contract" and "Deploy a Next.js app", which read as things AegisOne does — it does
 * neither.
 */
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

  // The catalog IS the content of this page, so it starts immediately below the hero frame.
  const libraryRegion = `
    <section class="section" id="library-region"${searching ? " hidden" : ""}>
      <div class="sectionHeadRow">
        <h2>The AegisOne catalog</h2>
        <span class="eyebrow">${state.library.entries.length} resource${state.library.entries.length === 1 ? "" : "s"}</span>
      </div>
      <p class="sectionNote">Real rows AegisOne's own catalog holds, each linking to its full Evidence Passport. Deliberately small and real: the ARD protocol fixtures that make <code>/search</code> and <code>/.well-known/ai-catalog.json</code> conformant are not shown here.</p>
      ${categoryFilterHtml(state.library.categories, state.library.counts, null)}
      ${skillLibraryHtml(state.library.entries)}
    </section>`;

  // External registries are a *scope* of discovery, not a second product. Nothing is queried and
  // nothing is shown until someone asks for it — see `app.js`, which no longer auto-loads this.
  const externalRegistries = `
    <section class="section" id="live-federated">
      <div class="sectionHeadRow">
        <h2>External registries</h2>
        <span class="eyebrow">Discovery only</span>
      </div>
      <p class="sectionNote">The MCP Official Registry, GitHub Agent Finder and Hugging Face Discover, queried live. These are not AegisOne catalog rows and carry no AegisOne evidence — being findable is not being verified.</p>
      <div class="ctaRow" style="margin-bottom:14px">
        <button type="button" class="button button--sm" id="live-federated-load">Query external registries</button>
      </div>
      <div id="live-federated-results"><p class="emptyState">Not loaded yet. Nothing is shown here until a real federated query has actually run.</p></div>
    </section>`;

  const body = `
    <section class="frame heroPanel">
      <div>
        <span class="eyebrow">01 / Skills</span>
        <h1 class="hero">Find agent skills.<br>Know what's <span class="mark">actually proven</span>.</h1>
        <p class="lede">Audited, verified and stored are shown separately for every entry. Where there is no evidence, it says so.</p>
        <form class="searchForm" id="search-form" method="GET" action="/">
          <input type="search" name="q" id="search-input" placeholder="e.g. pull request review" value="${escapeHtml(state.query)}" autocomplete="off" aria-label="Search capabilities">
          <button class="button button--primary button--lg" type="submit">Search</button>
        </form>
        <div class="exampleRow"><span>Try</span>${examples}</div>
        <div class="searchScope">
          <label><input type="checkbox" id="federation-toggle"> Also search external registries (MCP Registry, GitHub Agent Finder, Hugging Face)</label>
        </div>
        <p class="crossLink">Already have a skill? <a class="textLink" href="/audit">Audit it before you use it</a></p>
      </div>
      <div class="heroArt">${heroArtSvg()}</div>
    </section>
    ${demoBanner}
    <div id="search-results">${resultsHtml}</div>
    ${libraryRegion}
    ${externalRegistries}
  `;

  return renderLayoutHtml({
    title: "AegisOne — find agent skills with evidence attached",
    activeNav: "skills",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="skills"></script>`,
  });
}
