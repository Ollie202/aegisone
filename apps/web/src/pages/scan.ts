// SSR shell for the paste-to-scan page (`/scan`), following the exact pattern the other three Hub
// pages already use (ADR-013 technology decision, ADR-015 visual language): a pure server-side
// function that returns an HTML string, delegating every piece of markup that must render
// identically on the server and in the browser to an isomorphic `apps/web/src/ui/*.mjs` module
// (here `scan-view.mjs`, exactly as `resource.ts` delegates to `evidence-passport.mjs`).
//
// The page renders a materially useful view with JavaScript disabled (what the feature is, what
// the three verdicts mean, the real limits, the API/MCP equivalents); submitting content is
// inherently a `fetch` interaction, handled by `apps/web/public/app.js` via the `data-page`
// attribute below.

import { scanResultHtml } from "../ui/scan-view.mjs";
import { renderLayoutHtml } from "./layout.ts";

export interface ScanPageState {
  /** Whether a 0G Compute key is configured on this deployment. When false, the optional advisory
   * checkbox stays usable (the backend answers with an explicit `advisory_unavailable` state
   * rather than silently skipping) but the page says up front that it will not run here. */
  advisoryConfigured: boolean;
}

/** The scan-beam variant of the product's single stamp metaphor (ADR-015): pasted bytes pass under
 * the outlined stamp, which is only pressed once the deterministic rules have run. */
function scanArtSvg(): string {
  return `<svg viewBox="0 0 300 220" role="img" aria-label="Pasted skill content passing under an outlined screening stamp">
  <g color="#0a0a0a">
    <rect x="24" y="70" width="150" height="128" rx="16" fill="#fffdf7" stroke="#0a0a0a" stroke-width="3"/>
    <path d="M44 96h108M44 116h108M44 136h74M44 156h96M44 176h60" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <rect x="10" y="56" width="60" height="24" rx="12" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3"/>
    <text x="40" y="73" font-size="11" font-weight="900" letter-spacing="1.2" text-anchor="middle" fill="#0a0a0a">PASTE</text>
    <path d="M182 134h34" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 7"/>
    <g class="float" style="transform-origin:236px 128px">
      <use href="#ic-stamp" x="180" y="72" width="112" height="112"/>
      <circle cx="236" cy="130" r="27" fill="#b79cff"/>
      <use href="#ic-bytegrid" x="219" y="113" width="34" height="34"/>
    </g>
  </g>
</svg>`;
}

const PLACEHOLDER = "Paste the contents of a SKILL.md (or any single skill file) here.";

export function renderScanPageHtml(state: ScanPageState): string {
  const advisoryNote = state.advisoryConfigured
    ? "Optional, slower and strictly rate-limited. It never changes the deterministic verdict."
    : "Not configured on this deployment — requesting it returns an explicit “advisory unavailable” state rather than silently skipping. It never changes the deterministic verdict either way.";

  const body = `
    <section class="hero">
      <div class="heroCopy">
        <div class="pillRow">
          <span class="pill pill--yellow">No publisher needed</span>
          <span class="pill">Deterministic rules</span>
          <span class="pill pill--peri">Nothing is executed</span>
        </div>
        <h1>Paste a skill. Get the <span class="mark">receipts</span>, not a vibe.</h1>
        <p class="lede">Screen raw Agent Skill content with the same deterministic <code>@aegisone/skill-audit</code> analysis the verification pipeline uses. No GitHub repository, no source claim, no discovery step — and AegisOne never installs, executes, or fetches anything on your behalf.</p>
      </div>
      <div class="heroArt">${scanArtSvg()}</div>
    </section>

    <div class="scanGrid" style="margin-top:8px">
      <section class="panel">
        <span class="edgeLabel">Your content</span>
        <h2>Content to screen</h2>
        <form id="scan-form">
          <label for="scan-content" class="eyebrow" style="display:block;margin-bottom:8px">Skill content</label>
          <textarea class="scanInput" id="scan-content" name="content" spellcheck="false" placeholder="${PLACEHOLDER}"></textarea>
          <div class="scanControls">
            <button class="button button--primary" type="submit" id="scan-submit">Screen this content <span class="arrow" aria-hidden="true">&rarr;</span></button>
            <label class="scanOption">
              <input type="checkbox" id="scan-advisory" name="includeAdvisoryScan">
              <span><strong>Include advisory scan</strong>${advisoryNote}</span>
            </label>
          </div>
        </form>
        <p class="passportNote">Limits: up to 256&nbsp;KiB of content, at most 50 files, rate-limited per client. Identical content is recognised by its canonical SHA-256 and answered from the scan record.</p>
      </section>

      <section>
        <div id="scan-result">${scanResultHtml(null)}</div>
      </section>
    </div>

    <section class="panel panel--flat" style="margin-top:26px">
      <span class="edgeLabel">What the verdicts mean</span>
      <h2>Three deterministic outcomes</h2>
      <p class="passportNote">The verdict comes only from the highest severity the deterministic Tier-1 rules produced. It is never derived from a language model, a relevance score, or anything a submitter asserts.</p>
      <div class="fieldRow"><span class="fieldLabel">CLEAN</span><span class="fieldValue">Nothing above LOW severity matched. A screening result for these exact bytes — not a safety guarantee.</span></div>
      <div class="fieldRow"><span class="fieldLabel">FLAGGED</span><span class="fieldValue">Highest deterministic severity was MEDIUM or HIGH. The findings are listed so you can judge them yourself.</span></div>
      <div class="fieldRow"><span class="fieldLabel">BLACKLISTED</span><span class="fieldValue">A CRITICAL deterministic finding. The same bytes report BLACKLISTED on every future submission.</span></div>
      <p class="passportWarning">Screening a paste is not verification of a published capability. It produces no source assurance and no byte correspondence, because pasted content has no claimed publisher and no claimed source revision. To see those dimensions, <a href="/">search the catalog</a> and open an Evidence Passport.</p>
      <p class="passportNote">An AI agent can call this identical screening service through the <code>aegisone_scan</code> MCP tool at <code>/mcp</code>, or <code>POST /api/v1/scan</code> directly — never a second, looser pipeline.</p>
    </section>
  `;

  return renderLayoutHtml({
    title: "Audit a skill — AegisOne",
    // AUDIT is section 2 of the four-section IA (ADR-016). This one page is served at both
    // `/audit` (its nav home) and the original `/scan` URL, which keeps working unchanged.
    activeNav: "audit",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="audit"></script>`,
  });
}
