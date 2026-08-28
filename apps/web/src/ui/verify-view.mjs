// Isomorphic Package / Artifact Verification result rendering (see escape.mjs header).
//
// Renders a `POST /api/v1/verify` response — and only that response. Every state word
// (INSPECTED, NOT_EVALUATED, MATCH, MISMATCH, DIVERGED, INSUFFICIENT_EVIDENCE, the severity) and
// every digest is a backend field written out verbatim. This module computes no verdict, derives
// no score, and has no branch that can upgrade one state into another. Everything else on the
// page is fixed explanatory copy that is true regardless of the data.
//
// The plain-English register is the one PR 2 established for the scan report: say what AegisOne
// inspected, say what it compared, show the exact digests, say what the verdict means — and then,
// unconditionally, say what it does NOT mean.

import { escapeHtml, safeHttpUrl, shortHash } from "./escape.mjs";
import { correspondenceBadge, securityBadge, sourceInspectionBadge } from "./badges.mjs";

function hashRow(label, value) {
  if (!value) {
    return `<div class="hashRow"><span class="hashLabel">${escapeHtml(label)}</span><code class="hashValue hashValue--empty">unavailable</code></div>`;
  }
  return `<div class="hashRow"><span class="hashLabel">${escapeHtml(label)}</span><code class="hashValue" title="${escapeHtml(value)}">${escapeHtml(shortHash(value))}</code></div>`;
}

function fieldRow(label, valueHtml) {
  return `<div class="fieldRow"><span class="fieldLabel">${escapeHtml(label)}</span><span class="fieldValue">${valueHtml}</span></div>`;
}

/**
 * What each correspondence state means, in plain English, keyed by the exact backend string. An
 * unrecognised state falls through to a neutral sentence rather than being guessed at — the safe
 * failure mode, matching `rule-explanations.mjs`.
 *
 * Note what DIVERGED says: legitimate build divergence is not an accusation. AGENTS.md is explicit
 * that divergence is "insufficient reproducibility evidence", never "malicious".
 */
const CORRESPONDENCE_MEANING = {
  MATCH: "The bytes AegisOne rebuilt from the exact claimed source commit are byte-identical to the distributed artifact. Nobody swapped the package between the source and what is being handed out.",
  MISMATCH: "The distributed artifact is NOT byte-identical to an independent reproduction of the exact claimed source commit. Something is being distributed that the claimed source does not produce.",
  DIVERGED: "The two artifacts differ in a way AegisOne cannot attribute to substitution. Builds legitimately diverge — timestamps, packaging order, toolchain versions. This is insufficient reproducibility evidence, not an accusation.",
  INSUFFICIENT_EVIDENCE: "There was not enough evidence to compare. No verdict is asserted either way.",
  NOT_EVALUATED: "No correspondence verdict exists. Only the source was inspected — there was no distinct distributed artifact to compare it against, so MATCH and MISMATCH are both structurally unreachable for this run.",
};

/** Always rendered, on every outcome including MATCH. Threat M8-019: a reader must never leave
 * this panel believing more was proven than was. */
function notProvenHtml(result) {
  const items = [
    "<strong>MATCH is not “safe.”</strong> Byte correspondence says the distributed package is what the claimed source produces. It says nothing about whether that package is benign.",
    "<strong>A clean audit is not source authentication.</strong> The deterministic audit looks for specific patterns in the bytes it read. Absence of findings is absence of those patterns, not proof of safety.",
    "<strong>A declared repository is not an authorised one.</strong> A repository existing, or being named in a claim, is not proof the publisher authorised it as the source of this capability.",
    "<strong>Nothing was installed or executed.</strong> AegisOne cloned a commit and read files. It did not run the skill, and it never will on your behalf.",
  ];
  if (!result?.comparedDistinctDistributedArtifact) {
    items.unshift(
      "<strong>No distributed artifact was compared.</strong> This run inspected source only, so it produced no correspondence verdict at all — not a passing one.",
    );
  }
  return `<section class="panel panel--flat notProven" style="margin-top:18px">
    <span class="edgeLabel">Limits</span>
    <h3>What this does NOT prove</h3>
    <ul class="notProvenList">${items.map((item) => `<li>${item}</li>`).join("")}</ul>
  </section>`;
}

function inspectedHtml(result) {
  const inspected = result?.inspected ?? {};
  return `<div class="verifyInspected">
    <h3>What AegisOne inspected</h3>
    ${fieldRow("Repository", `<a href="${safeHttpUrl(inspected.repositoryUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(inspected.repositoryUrl ?? "unavailable")}</a>`)}
    ${fieldRow("Exact commit", `<code class="hashValue" title="${escapeHtml(inspected.exactCommitSha ?? "")}">${escapeHtml(shortHash(inspected.exactCommitSha ?? "", 12))}</code>`)}
    ${fieldRow("Subdirectory", escapeHtml(inspected.subdirectory ?? "(repository root)"))}
    ${fieldRow("Source inspection", sourceInspectionBadge(result?.sourceInspection?.status))}
    ${hashRow("Independently packaged source SHA-256", inspected.sourceSnapshotSha256)}
    <p class="passportNote">The commit is an exact 40-character SHA read from the catalog's own recorded source claim — never a branch name, and never a repository the caller typed in.</p>
  </div>`;
}

function comparedHtml(result) {
  const correspondence = result?.correspondence ?? {};
  const status = correspondence.status ?? "NOT_EVALUATED";
  const meaning = CORRESPONDENCE_MEANING[status] ?? "This state is reported verbatim by the backend.";
  const compared = Boolean(result?.comparedDistinctDistributedArtifact);
  return `<div class="verifyCompared">
    <h3>What AegisOne compared</h3>
    ${fieldRow("Correspondence", correspondenceBadge(status))}
    ${
      compared
        ? `${hashRow("Publisher / distributed SHA-256", correspondence.publisherSha256)}
           ${hashRow("Independently reproduced SHA-256", correspondence.reproducedSha256)}`
        : `<p class="emptyState">Nothing was compared. This resource has no distinct distributed artifact recorded, so there was a source reproduction and nothing to hold it against.</p>`
    }
    <p class="passportNote">${escapeHtml(meaning)}</p>
  </div>`;
}

function securityHtml(result) {
  const security = result?.security ?? {};
  const target = security.auditTarget === "publisher"
    ? "the distributed artifact"
    : security.auditTarget === "source"
      ? "the source reproduction"
      : "no package";
  return `<div class="verifySecurity">
    <h3>What the deterministic audit found</h3>
    ${fieldRow("Result", securityBadge(security.status, security.highestSeverity, security.findingCount))}
    ${fieldRow("Ran against", escapeHtml(target))}
    ${fieldRow("Analysis kind", escapeHtml(security.analysisKind ?? "not run"))}
    <p class="passportNote">Security findings are a separate dimension from correspondence. A package can correspond exactly and still be dangerous; a package can diverge and be perfectly benign.</p>
  </div>`;
}

/** The whole panel. `result === null` renders the resting state — never a placeholder verdict. */
export function verifyResultHtml(result) {
  if (!result) {
    return `<section class="panel verifyPanel" aria-live="polite">
      <span class="edgeLabel">Verification result</span>
      <h2>No verification run yet</h2>
      <p class="passportNote">Pick a catalog resource that has a recorded exact source revision, then run the verification. AegisOne will clone that exact commit, package it with the same deterministic packer the audit pipeline uses, and — only if a distinct distributed artifact is recorded — compare the two byte-for-byte.</p>
    </section>`;
  }
  return `<section class="panel verifyPanel" aria-live="polite">
    <span class="edgeLabel">Verification result</span>
    <h2>${escapeHtml(result.resourceId ?? "")}</h2>
    ${inspectedHtml(result)}
    ${comparedHtml(result)}
    ${securityHtml(result)}
    ${notProvenHtml(result)}
    <p class="passportNote">Recorded as a new, immutable verification row (<code class="hashValue">${escapeHtml(result.capabilityVerificationId ?? "")}</code>). Previous verdicts for this resource are never overwritten — open its <a href="/resources/${encodeURIComponent(result.resourceId ?? "")}">Evidence Passport</a> for the full history.</p>
  </section>`;
}

/** Backend error envelopes, rendered as themselves. Never softened into a verdict, and never
 * presented as a finding about the resource. */
export function verifyErrorHtml(error) {
  const code = escapeHtml(error?.error ?? "error");
  const message = escapeHtml(error?.message ?? "Verification could not be completed.");
  return `<section class="panel verifyPanel" aria-live="polite">
    <span class="edgeLabel">Verification result</span>
    <h2>Verification did not run</h2>
    ${fieldRow("Reason", `<code class="hashValue">${code}</code>`)}
    <p class="passportNote">${message}</p>
    <p class="passportNote">This is a statement about AegisOne's run, not a finding about the resource. Nothing was recorded.</p>
  </section>`;
}
