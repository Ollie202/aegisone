// Isomorphic policy-evaluation result rendering (see escape.mjs header). Renders the exact
// `TrustPolicyResult` returned by `POST /api/v1/policy/evaluate`
// (docs/20-m8-api-contract.md) verbatim: `decision` and every `reasons[].message` are rendered
// as-is, never reinterpreted/recomputed in the browser (docs/18 "Policy Playground": "render
// backend reasons exactly; browser must not independently reinterpret evidence into a different
// policy result").

import { escapeHtml } from "./escape.mjs";
import { policyDecisionBadge } from "./badges.mjs";

export function policyResultHtml(result) {
  if (!result || typeof result.decision !== "string") {
    return `<p class="emptyState">No policy evaluation yet. Adjust the controls above and evaluate.</p>`;
  }
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const reasonItems = reasons
    .map((reason) => `<li class="policyReason"><code>${escapeHtml(reason.code)}</code> <span>${escapeHtml(reason.message)}</span></li>`)
    .join("");
  const reasonsBlock = reasons.length > 0
    ? `<ul class="policyReasons">${reasonItems}</ul>`
    : `<p class="policyReasonsEmpty">No reasons returned — evidence satisfied every configured requirement.</p>`;

  return `<div class="policyResult" data-decision="${escapeHtml(result.decision)}">
    <div class="policyDecision">${policyDecisionBadge(result.decision)}</div>
    ${reasonsBlock}
  </div>`;
}

/** Renders a backend `ApiV1ErrorResponse`/`ProductErrorResponse`-shaped error without inventing a
 * decision. Used when policy evaluation itself fails (malformed policy, resource not found, etc.)
 * — this is distinct from a DENY decision and must never be rendered as one. */
export function policyErrorHtml(error) {
  const message = error && typeof error === "object" && typeof error.message === "string" ? error.message : "Policy evaluation failed.";
  return `<div class="policyResult policyResult--error"><p class="errorText">Could not evaluate policy: ${escapeHtml(message)}</p></div>`;
}
