// Isomorphic paste-to-scan rendering (see escape.mjs header for why this is plain `.mjs`).
//
// Renders the exact `ScanApiResponse` returned by `POST /api/v1/scan`
// (`apps/web/src/scan-service.ts`) — `contentSha256`, `verdict`, `cached`, `deterministicFindings`,
// `advisoryFindings`, `scanCount`. Every rendered claim traces to one of those named fields.
//
// Non-negotiable rules this module preserves (AGENTS.md):
//   - `verdict` (CLEAN / FLAGGED / BLACKLISTED) is rendered verbatim from the backend. The browser
//     never derives, upgrades, downgrades or re-thresholds it, and the advisory (LLM) result never
//     changes how the verdict is rendered — `deriveVerdictFromHighestSeverity` in
//     `packages/catalog-store` is the only place a verdict is ever decided.
//   - The Tier-2 advisory pass is rendered in a visually AND textually distinct container, always
//     carrying "advisory only — not authoritative". It is never merged into the verdict panel.
//   - CLEAN is a screening result for the pasted bytes, never a generic SAFE/TRUSTED badge, and
//     never a numeric score.
//   - A pasted skill has no publisher and no claimed source, so this path structurally always has
//     source assurance NONE and correspondence NOT_EVALUATED. Both are shown explicitly rather
//     than omitted, so a CLEAN screening can never be mistaken for AegisOne source/byte evidence.
//   - Every string that came from pasted content (finding `path`, `evidence`, `title`, `ruleId`)
//     or from the model (advisory `summary`) is escaped via `escapeHtml` before insertion.

import { escapeHtml, shortHash } from "./escape.mjs";
import { sourceAssuranceBadge, correspondenceBadge } from "./badges.mjs";

/** Deterministic-severity → badge tone. Mirrors the tone mapping `badges.mjs` already uses; the
 * severity text itself is always rendered alongside, so colour is never the only signal. */
const SEVERITY_TONE = {
  CRITICAL: "badge--negative",
  HIGH: "badge--negative",
  MEDIUM: "badge--caution",
  LOW: "badge--info",
  INFO: "badge--neutral",
};

/** What each backend verdict actually means, stated in the backend's own terms
 * (`packages/catalog-store/src/pasted-skill-verdict.ts`): the verdict is derived only from the
 * deterministic Tier-1 `highestSeverity`. */
const VERDICT_MEANING = {
  CLEAN: "No deterministic finding above LOW severity in the pasted content. This is a screening result for these exact bytes only — not a safety guarantee, not a source claim, and not byte-correspondence evidence.",
  FLAGGED: "The deterministic audit's highest severity was MEDIUM or HIGH. Read the findings below and decide for yourself; AegisOne is reporting what the static rules matched, not a judgement about the author.",
  BLACKLISTED: "The deterministic audit reached CRITICAL severity. Identical content is reported BLACKLISTED on every future submission of the same bytes, independent of any advisory opinion.",
};

const VERDICT_GLYPH = { CLEAN: "✓", FLAGGED: "▲", BLACKLISTED: "✕" };

/** The product's single stamp metaphor (ADR-015) applied to the screening verdict. Decorative and
 * `aria-hidden`: the verdict word itself is always rendered as large text next to it, so the state
 * survives with colour and imagery removed. */
export function verdictStampSvg(verdict) {
  const fill = verdict === "CLEAN" ? "#22dceb" : verdict === "FLAGGED" ? "#f5a524" : verdict === "BLACKLISTED" ? "#ff4a3d" : "#e6e2d6";
  const glyph = verdict === "CLEAN"
    ? `<path d="M40 56l11 12 22-25" fill="none" stroke="#0a0a0a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
    : verdict === "FLAGGED"
      ? `<path d="M56 38v24M56 71v.6" fill="none" stroke="#0a0a0a" stroke-width="7" stroke-linecap="round"/>`
      : `<path d="M43 44l26 26M69 44L43 70" fill="none" stroke="#0a0a0a" stroke-width="7" stroke-linecap="round"/>`;
  return `<span class="verdictStamp" aria-hidden="true"><svg viewBox="0 0 112 112" color="#0a0a0a"><use href="#ic-stamp" x="6" y="6" width="100" height="100"/><circle cx="56" cy="58" r="30" fill="${fill}"/>${glyph}</svg></span>`;
}

function metaPill(label) {
  return `<span class="pill">${escapeHtml(label)}</span>`;
}

function findingRowHtml(finding) {
  const severity = String(finding?.severity ?? "INFO");
  const tone = SEVERITY_TONE[severity] ?? "badge--neutral";
  const where = finding?.path ? `${finding.path}${typeof finding.line === "number" && finding.line > 0 ? `:${finding.line}` : ""}` : "";
  const evidence = typeof finding?.evidence === "string" && finding.evidence !== ""
    ? `<pre class="findingEvidence">${escapeHtml(finding.evidence)}</pre>`
    : "";
  return `<li class="findingRow">
    <span class="badge ${tone}"><span class="badge__glyph" aria-hidden="true">▲</span><span class="badge__text">${escapeHtml(severity)}</span></span>
    <div>
      <strong>${escapeHtml(finding?.title ?? finding?.ruleId ?? "finding")}</strong>
      <div class="findingRule">${escapeHtml(finding?.ruleId ?? "")}</div>
      ${where ? `<div class="findingWhere">${escapeHtml(where)}</div>` : ""}
      ${evidence}
    </div>
  </li>`;
}

export function deterministicFindingsHtml(findings) {
  const rows = Array.isArray(findings) ? findings : [];
  if (rows.length === 0) {
    return `<p class="emptyState">The deterministic audit produced no findings for this content. No findings is not proof of safety — it means these specific static rules did not match.</p>`;
  }
  return `<ul class="findingList" style="list-style:none;padding:0;margin:14px 0 0">${rows.map(findingRowHtml).join("")}</ul>`;
}

/**
 * The optional Tier-2 pass. Deliberately rendered in a dashed, differently-shaped container with
 * an explicit "advisory only — not authoritative" stamp, and never inside the verdict panel: the
 * backend contract is that this field never sets or overrides `verdict`
 * (`apps/web/src/scan-service.ts`), and the UI must not blur that for the sake of visual unity.
 */
export function advisoryFindingsHtml(advisory) {
  if (!advisory || typeof advisory !== "object") return "";
  const status = String(advisory.status ?? "error");
  const header = `<div class="sectionMark"><h3>Advisory pass (0G Compute LLM)</h3></div>
    <span class="advisoryStamp">Advisory only — not authoritative</span>`;

  if (status === "completed" && advisory.finding && typeof advisory.finding === "object") {
    const finding = advisory.finding;
    return `<section class="advisoryPanel">
      ${header}
      <div class="pillRow" style="margin:12px 0 0">
        ${metaPill(`concern level ${String(finding.concernLevel ?? "unknown")}`)}
        ${metaPill(`model ${String(finding.modelProvider ?? "unknown")}`)}
        ${finding.ranAt ? metaPill(`ran ${String(finding.ranAt)}`) : ""}
      </div>
      <p class="advisoryBody">${escapeHtml(finding.summary ?? "")}</p>
      <p class="passportNote">This is a non-deterministic language-model opinion over the pasted text. It did not and cannot change the deterministic verdict above, and it is not a source claim, a correspondence result, or a security guarantee.</p>
    </section>`;
  }

  const explanation = status === "advisory_unavailable"
    ? "The advisory pass is not configured on this deployment, so it did not run."
    : status === "rate_limited"
      ? "The advisory rate limit for this client was reached, so the advisory pass did not run."
      : "The advisory pass failed to complete.";
  const detail = typeof advisory.reason === "string" ? advisory.reason : typeof advisory.message === "string" ? advisory.message : "";
  return `<section class="advisoryPanel">
    ${header}
    <p class="advisoryBody"><strong>${escapeHtml(status.replaceAll("_", " ").toUpperCase())}</strong> — ${escapeHtml(explanation)}</p>
    ${detail ? `<p class="passportNote">${escapeHtml(detail)}</p>` : ""}
    <p class="passportNote">A missing advisory result never changes the deterministic verdict above, and never upgrades or downgrades it.</p>
  </section>`;
}

export function scanResultHtml(result) {
  if (!result || typeof result.verdict !== "string") {
    return `<p class="emptyState">No scan yet. Paste Agent Skill content on the left and screen it — nothing is installed, executed or fetched on your behalf.</p>`;
  }
  const verdict = result.verdict;
  const glyph = VERDICT_GLYPH[verdict] ?? "?";
  const meaning = VERDICT_MEANING[verdict] ?? "Verdict rendered verbatim from the AegisOne backend.";
  const findingCount = Array.isArray(result.deterministicFindings) ? result.deterministicFindings.length : 0;
  const scanCount = typeof result.scanCount === "number" ? result.scanCount : null;

  return `<div class="scanResult" data-verdict="${escapeHtml(verdict)}">
    <section class="verdictPanel verdictPanel--${escapeHtml(verdict)}">
      ${verdictStampSvg(verdict)}
      <span class="eyebrow">Deterministic screening verdict</span>
      <p class="verdictWord"><span aria-hidden="true">${escapeHtml(glyph)}</span> ${escapeHtml(verdict)}</p>
      <p class="verdictMeaning">${escapeHtml(meaning)}</p>
      <div class="scanMetaRow">
        <span class="pill">${findingCount} deterministic finding${findingCount === 1 ? "" : "s"}</span>
        ${result.cached === true ? `<span class="pill">cached result</span>` : `<span class="pill">freshly scanned</span>`}
        ${scanCount !== null ? `<span class="pill">seen ${scanCount}&times;</span>` : ""}
      </div>
    </section>

    <div class="panel" style="margin-top:18px">
      <span class="edgeLabel">Content identity</span>
      <div class="hashRow"><span class="hashLabel">Canonical content SHA-256</span><code class="hashValue" title="${escapeHtml(result.contentSha256 ?? "")}">${escapeHtml(shortHash(result.contentSha256 ?? ""))}</code></div>
      <div class="fieldRow"><span class="fieldLabel">Source assurance</span><span class="fieldValue">${sourceAssuranceBadge("NONE")}</span></div>
      <div class="fieldRow"><span class="fieldLabel">Distribution correspondence</span><span class="fieldValue">${correspondenceBadge("NOT_EVALUATED")}</span></div>
      <p class="passportNote">Pasted content has no publisher and no claimed source revision, so this path structurally cannot produce a source-assurance level above NONE or any correspondence result. Screening a paste is a different thing from AegisOne verifying a published capability.</p>
    </div>

    <div class="panel" style="margin-top:18px">
      <span class="edgeLabel">Deterministic findings</span>
      <h3>What the static rules matched</h3>
      <p class="passportNote">Produced by the same deterministic <code>@aegisone/skill-audit</code> Tier-1 analysis the verification pipeline uses. No language model participates in this list or in the verdict.</p>
      ${deterministicFindingsHtml(result.deterministicFindings)}
    </div>

    ${advisoryFindingsHtml(result.advisoryFindings)}
  </div>`;
}

/** Renders a backend error (`{ error, errorCode, message }`) without inventing a verdict — a
 * failed scan is not a CLEAN scan, and must never be rendered as one. */
export function scanErrorHtml(error) {
  const message = error && typeof error === "object" && typeof error.message === "string" ? error.message : "The scan could not be completed.";
  return `<div class="panel panel--flat"><p class="errorText">Scan failed: ${escapeHtml(message)}</p><p class="passportNote">A failed scan is not a verdict. Nothing about this content has been screened.</p></div>`;
}
