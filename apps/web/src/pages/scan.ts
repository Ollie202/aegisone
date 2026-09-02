// AUDIT — section 02 of the four-section IA. Served at `/audit` (its nav home) and at the original
// `/scan` URL, which keeps working byte-identically so nothing that already links to it breaks.
//
// ONE JOB: **check something before you use it.**
//
// This page used to stack four audit-type cards, an "upcoming features" grid, the package
// verification panel, the skill textarea, the advisory control and three explanatory sections into
// one continuous surface — so the actual tool started far below the fold and neither workflow was
// ever the page. It is now a two-mode workstation:
//
//     short page header → mode switch → ONE workflow, split LEFT input / RIGHT result
//
// Only one mode is visible at a time. Both are server-rendered (`state.mode`, from `?mode=`), so
// the page works with JavaScript off and each mode is linkable; `app.js` upgrades the switch to a
// client-side toggle so changing mode never loses what is in the textarea and never submits the
// wrong form. The inactive mode stays in the document but `hidden` — that is what lets the toggle
// preserve input — and `hidden` means it is neither displayed nor reachable by tab or screen
// reader, so the two workflows are never stacked for the reader.
//
// The two audit types that are NOT built (smart contract, MCP capability) no longer get cards,
// pills or controls. They get one muted line at the bottom of the page, because an oversized card
// advertising a capability that does not exist is exactly the overstatement this product refuses.
//
// The single SSR/browser render path for both results is unchanged: `scan-view.mjs` and
// `verify-view.mjs`, the same isomorphic modules `app.js` re-renders with (ADR-013).

import { scanResultHtml } from "../ui/scan-view.mjs";
import { verifyResultHtml } from "../ui/verify-view.mjs";
import { escapeHtml, shortHash } from "../ui/escape.mjs";
import { renderLayoutHtml } from "./layout.ts";
import type { VerificationTargetSummary } from "../verify-trigger.ts";

export type AuditMode = "skill" | "package";

/** `?mode=package` selects package verification; anything else is the default skill audit. A
 * malformed value is not an error — it simply falls back to the default mode. */
export function parseAuditMode(raw: string | null | undefined): AuditMode {
  return raw === "package" ? "package" : "skill";
}

export interface ScanPageState {
  /** Which workflow is visible. Defaults to the skill audit. */
  mode?: AuditMode;
  /** Whether a 0G Compute key is configured on this deployment. When false, the optional advisory
   * checkbox stays usable (the backend answers with an explicit `advisory_unavailable` state
   * rather than silently skipping) but the page says up front that it will not run here. */
  advisoryConfigured: boolean;
  /** ADR-020: catalog resources that genuinely carry an exact recorded source revision. This list
   * IS the input surface for Package / Artifact Verification — the page never offers a free-text
   * repository/URL field, because the backend would refuse one. */
  verificationTargets?: readonly VerificationTargetSummary[];
  /** Whether this runtime can perform exact-commit source acquisition at all (it needs `git`). */
  sourceAcquisitionAvailable?: boolean;
  /** Whether this deployment has locked verification behind an operator token. */
  verificationOperatorGated?: boolean;
}

/**
 * The page's ONE illustration, and deliberately a small header object rather than a poster above
 * the tool: content being *read*, not judged. It reuses the product's existing shape family (the
 * outlined magnifier from the SKILLS hero plus the shared `#ic-bytegrid`) and pointedly does NOT
 * press the `#ic-stamp` verdict seal — a stamp asserts AegisOne holds evidence, and nothing has
 * been screened at the moment this drawing is on screen.
 */
function auditHeadArtSvg(): string {
  return `<svg viewBox="0 0 250 150" role="img" aria-label="An outlined sheet of pasted content being read under a magnifier, beside a grid of bytes">
  <g color="#0a0a0a">
    <rect x="8" y="18" width="118" height="116" rx="13" fill="#fffdf8" stroke="#0a0a0a" stroke-width="3.4"/>
    <path d="M26 46h82M26 66h82M26 86h54M26 106h70" fill="none" stroke="#0a0a0a" stroke-width="3.4" stroke-linecap="round" opacity=".5"/>
    <rect x="0" y="6" width="56" height="22" rx="11" fill="#ffd91a" stroke="#0a0a0a" stroke-width="3"/>
    <text x="28" y="22" font-size="10" font-weight="900" letter-spacing="1.1" text-anchor="middle" fill="#0a0a0a">PASTE</text>
    <g transform="rotate(-8 104 96)">
      <circle cx="104" cy="96" r="33" fill="#b79cff" fill-opacity="0.32" stroke="#0a0a0a" stroke-width="3.8"/>
      <path d="M82 118 L62 139" fill="none" stroke="#0a0a0a" stroke-width="7" stroke-linecap="round"/>
    </g>
    <g transform="rotate(5 190 74)">
      <use href="#ic-bytegrid" x="156" y="40" width="68" height="68"/>
    </g>
  </g>
</svg>`;
}

const PLACEHOLDER = "Paste the contents of a SKILL.md (or any single skill file) here.";

/**
 * The Package / Artifact Verification target list (ADR-020).
 *
 * NOTE WHAT IS ABSENT: there is no repository field, no commit field and no URL field. The only
 * input is a radio choice among catalog resources the server itself resolved, because the backend
 * accepts nothing else. That is the whole reason an unauthenticated trigger is defensible, so the
 * UI is built to make it obvious rather than to hide it.
 */
function verificationTargetHtml(target: VerificationTargetSummary): string {
  const shape = target.hasDistinctDistributedArtifact
    ? "source + a distinct distributed artifact &rarr; a real MATCH / MISMATCH / DIVERGED verdict"
    : "source only &rarr; inspection and audit, and no correspondence verdict at all";
  return `<label class="verifyTarget">
    <input type="radio" name="verifyResourceId" value="${escapeHtml(target.resourceId)}">
    <span class="verifyTargetBody">
      <strong>${escapeHtml(target.resourceName)}</strong>
      <span class="verifyTargetMeta">${escapeHtml(target.repositoryUrl)} @ <code class="hashValue" title="${escapeHtml(target.commitSha)}">${escapeHtml(shortHash(target.commitSha, 8))}</code>${target.subdirectory ? ` &middot; ${escapeHtml(target.subdirectory)}` : ""}</span>
      <span class="verifyTargetMeta">Source assurance: ${escapeHtml(target.sourceAssuranceLevel)} &middot; ${shape}</span>
    </span>
  </label>`;
}

/** Mode A — Skill Audit. Left: the content you give it. Right: what it says back. */
function skillModeHtml(state: ScanPageState): string {
  const advisoryNote = state.advisoryConfigured
    ? "Optional, slower, strictly rate-limited, and it never changes the deterministic verdict."
    : "Not configured here — asking for it returns an explicit “advisory unavailable” state rather than silently skipping. It never changes the deterministic verdict either way.";

  return `<section class="toolMode" id="mode-skill" data-mode="skill"${state.mode === "package" ? " hidden" : ""}>
    <div class="toolSplit">
      <form class="panel" id="scan-form">
        <h2>Screen skill content</h2>
        <p class="sectionNote">Paste an Agent Skill and AegisOne runs the same deterministic <code>@aegisone/skill-audit</code> rules the verification pipeline uses. Nothing is installed, executed or fetched on your behalf.</p>
        <label for="scan-content" class="visually-hidden">Skill content</label>
        <textarea class="scanInput" id="scan-content" name="content" spellcheck="false" placeholder="${PLACEHOLDER}"></textarea>
        <div class="scanControls">
          <button class="button button--primary" type="submit" id="scan-submit">Audit skill <span class="arrow" aria-hidden="true">&rarr;</span></button>
        </div>
        <label class="scanOption">
          <input type="checkbox" id="scan-advisory" name="includeAdvisoryScan">
          <span><strong>Also request the advisory scan</strong>${advisoryNote}</span>
        </label>
        <p class="note">Up to 256&nbsp;KiB, at most 50 files, rate-limited per client. Identical bytes are recognised by their canonical SHA-256 and answered from the scan record.</p>
      </form>

      <div id="scan-result">${scanResultHtml(null)}</div>
    </div>

    <details class="disclose" id="verdict-vocabulary">
      <summary>What CLEAN, FLAGGED and BLACKLISTED mean</summary>
      <p class="note">The verdict comes only from the highest severity the deterministic Tier-1 rules produced — never from a language model, a relevance score, or anything a submitter asserts.</p>
      <div class="fieldRow"><span class="fieldLabel">CLEAN</span><span class="fieldValue">Nothing above LOW severity matched. A screening result for these exact bytes — not a safety guarantee.</span></div>
      <div class="fieldRow"><span class="fieldLabel">FLAGGED</span><span class="fieldValue">Highest deterministic severity was MEDIUM or HIGH. The findings are listed so you can judge them yourself.</span></div>
      <div class="fieldRow"><span class="fieldLabel">BLACKLISTED</span><span class="fieldValue">A CRITICAL deterministic finding. The same bytes report BLACKLISTED on every future submission.</span></div>
      <p class="note">Screening a paste is not verification of a published capability: pasted content has no claimed publisher and no claimed source revision, so it produces no source assurance and no byte correspondence. For those dimensions, <a href="/">search the catalog</a> and open an Evidence Passport. An agent can call the identical service through the <code>aegisone_scan</code> MCP tool or <code>POST /api/v1/scan</code> — never a second, looser pipeline.</p>
    </details>
  </section>`;
}

/** Mode B — Package / Artifact Verification. Same split: what you pick, and what came back. */
function packageModeHtml(state: ScanPageState): string {
  const targets = state.verificationTargets ?? [];
  const available = state.sourceAcquisitionAvailable !== false;

  const unavailableNote = available
    ? ""
    : `<p class="passportWarning">This deployment cannot perform exact-commit source acquisition: no <code>git</code> is available in this runtime, so there is nothing to independently reproduce from. Verification returns an explicit <code>source_acquisition_unavailable</code> refusal here rather than a partial or guessed result.</p>`;

  const operatorNote = state.verificationOperatorGated
    ? `<p class="note">This deployment has locked verification behind an operator token, so the button below will answer <code>unauthorized</code> without one.</p>`
    : `<p class="note">No account and no token — because the only thing you can hand it is a resource already in this catalog. A few runs per hour per client, one at a time: a real clone and a real download are real work.</p>`;

  const body = targets.length === 0
    ? `<p class="emptyState">No catalog resource currently carries an exact recorded source revision, so there is nothing here to independently reproduce yet. This is an empty catalog, not a broken button.</p>`
    : `<form id="verify-form">
        <div class="verifyTargets">${targets.map(verificationTargetHtml).join("")}</div>
        <div class="scanControls">
          <button class="button button--primary" type="submit" id="verify-submit"${available ? "" : " disabled"}>Verify package <span class="arrow" aria-hidden="true">&rarr;</span></button>
        </div>
      </form>`;

  return `<section class="toolMode" id="mode-package" data-mode="package"${state.mode === "package" ? "" : " hidden"}>
    <div class="toolSplit">
      <div class="panel" id="package-verification">
        <h2>Package / Artifact Verification</h2>
        <p class="sectionNote">AegisOne clones the exact 40-character commit the catalog recorded for a resource, packages that directory with the same deterministic packer the audit pipeline uses, and — only where a distinct distributed artifact is on record — compares the two byte-for-byte. Where no distinct artifact exists, it says so instead of calling the run a MATCH.</p>
        ${operatorNote}
        ${unavailableNote}
        ${body}
      </div>

      <div id="verify-result">${verifyResultHtml(null)}</div>
    </div>
  </section>`;
}

export function renderScanPageHtml(state: ScanPageState): string {
  const mode = state.mode ?? "skill";
  // Real links, so the switch works with JavaScript off and each mode is addressable. `app.js`
  // intercepts them to toggle in place, which is what keeps typed content across a mode change.
  const modeSwitch = `<nav class="modeSwitch" id="audit-mode-switch" aria-label="Audit type">
    <a href="/audit" data-mode="skill"${mode === "skill" ? ' aria-current="page"' : ""}>Skill audit</a>
    <a href="/audit?mode=package" data-mode="package"${mode === "package" ? ' aria-current="page"' : ""}>Package verification</a>
  </nav>`;

  const body = `
    <div class="pageHead">
      <div class="pageHeadRow">
        <div>
          <span class="eyebrow">02 / Audit</span>
          <h1 class="tight">Check it <span class="mark">before</span> you use it.</h1>
          <p>Two live checks. Screen skill content you paste, or independently reproduce a catalog package from its exact commit.</p>
        </div>
        <div class="pageHeadArt">${auditHeadArtSvg()}</div>
      </div>
    </div>

    ${modeSwitch}
    ${skillModeHtml(state)}
    ${packageModeHtml(state)}

    <p class="upcomingLine">Coming later, and not built today: smart-contract audit, and MCP / agent capability audit. Neither has a control on this page, because a shallow scanner presented as an audit would be worse than saying it does not exist yet.</p>
  `;

  return renderLayoutHtml({
    title: "Audit — AegisOne",
    activeNav: "audit",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="audit"></script>`,
  });
}
