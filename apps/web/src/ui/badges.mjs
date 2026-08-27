// Isomorphic dimension-badge rendering (see escape.mjs header for why this is plain .mjs).
//
// Non-negotiable rule enforced here (AGENTS.md / docs/17 Threat M8-020 / docs/18 "Data-loading
// rules"): never render a generic SAFE/TRUSTED badge or a numeric trust score, and never encode
// state in color alone — every badge always carries a text label and a symbol/icon glyph, so the
// state remains understandable with color perception removed (accessibility) and in a
// text-only/screen-reader context.

import { escapeHtml } from "./escape.mjs";

const TONE = {
  neutral: "badge--neutral",
  positive: "badge--positive",
  negative: "badge--negative",
  caution: "badge--caution",
  info: "badge--info",
};

/** `label` and `text` are both required and both rendered; `glyph` is a short ASCII/Unicode symbol
 * (never relied on alone — always paired with `text`). */
function badge(tone, glyph, text, title) {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<span class="badge ${TONE[tone] ?? TONE.neutral}"${titleAttr}><span class="badge__glyph" aria-hidden="true">${escapeHtml(glyph)}</span><span class="badge__text">${escapeHtml(text)}</span></span>`;
}

export function discoveryBadge(status) {
  switch (status) {
    case "INDEXED":
      return badge("info", "◎", "INDEXED — discovery only", "A discovery provider found this resource. This is not AegisOne verification.");
    case "STALE":
      return badge("caution", "⟳", "STALE discovery", "The provider that indexed this resource has not confirmed it recently.");
    case "UNAVAILABLE":
      return badge("caution", "⚠", "PROVIDER UNAVAILABLE", "The discovery provider was unreachable; this reflects provider outage, not a trust/security finding.");
    default:
      return badge("neutral", "?", String(status ?? "UNKNOWN"));
  }
}

export function sourceAssuranceBadge(level) {
  switch (level) {
    case "NONE":
      return badge("neutral", "–", "NO SOURCE CLAIM");
    case "DECLARED":
      return badge("caution", "◐", "DECLARED", "A source mapping was supplied, but repository authority has not been proven.");
    case "REPOSITORY_AUTHENTICATED":
      return badge("positive", "✓", "REPOSITORY AUTHENTICATED", "A GitHub-authenticated identity with sufficient repository authority authenticated this exact claim.");
    case "SIGNED_RELEASE":
      return badge("positive", "✓✓", "SIGNED RELEASE", "Cryptographic release-signature verification succeeded.");
    default:
      return badge("neutral", "?", String(level ?? "UNKNOWN"));
  }
}

/** `resource.trust.sourceInspection.status` (M8.1 model) rendered verbatim. Source *inspection* is
 * deliberately a separate dimension from source *assurance*: inspecting a source revision proves
 * nothing about who authorized it, and vice versa. Unknown states are printed as-is, never
 * upgraded. */
export function sourceInspectionBadge(status) {
  switch (status) {
    case "INSPECTED":
      return badge("info", "◍", "INSPECTED", "The exact claimed source revision was fetched and hashed. Inspection is not authority and is not correspondence.");
    case "NOT_RUN":
    case null:
    case undefined:
      return badge("neutral", "–", "INSPECTION NOT RUN");
    default:
      return badge("neutral", "?", String(status));
  }
}

export function correspondenceBadge(status) {
  switch (status) {
    case "MATCH":
      return badge("positive", "✓", "MATCH", "The independently reproduced artifact is byte-identical to the distributed artifact. MATCH does not mean safe.");
    case "MISMATCH":
      return badge("negative", "✕", "MISMATCH", "The independently reproduced artifact differs from the distributed artifact.");
    case "DIVERGED":
      return badge("caution", "≉", "DIVERGED", "Reproduction differs from the distributed artifact in a way consistent with legitimate build divergence, not necessarily tampering.");
    case "INSUFFICIENT_EVIDENCE":
      return badge("caution", "?", "INSUFFICIENT EVIDENCE");
    case "NOT_EVALUATED":
    default:
      return badge("neutral", "–", "NOT EVALUATED");
  }
}

export function securityBadge(status, highestSeverity, findingCount) {
  if (status !== "COMPLETED") return badge("neutral", "–", "AUDIT NOT RUN");
  const severity = highestSeverity ?? "INFO";
  const count = typeof findingCount === "number" ? findingCount : 0;
  const tone = severity === "CRITICAL" || severity === "HIGH" ? "negative" : severity === "MEDIUM" ? "caution" : "info";
  const text = `${escapeHtmlPlain(severity)} · ${count} finding${count === 1 ? "" : "s"}`;
  return badge(tone, "▲", text, "No findings is not proof of safety. This is a separate deterministic static-analysis result, independent of correspondence.");
}

function escapeHtmlPlain(value) {
  // badge() escapes the whole text already; this just avoids double-escaping ampersands etc. by
  // building the raw label here and letting badge() do the single escaping pass.
  return String(value);
}

export function canonicalEvidenceBadge(status, verifiedAt) {
  if (status !== "AVAILABLE") return badge("neutral", "–", "NO CANONICAL EVIDENCE");
  const age = freshnessLabel(verifiedAt);
  return badge("info", "◈", `AVAILABLE${age ? ` · ${age}` : ""}`);
}

export function policyDecisionBadge(decision) {
  switch (decision) {
    case "ALLOW":
      return badge("positive", "✓", "ALLOW");
    case "REVIEW":
      return badge("caution", "◐", "REVIEW");
    case "DENY":
      return badge("negative", "✕", "DENY");
    default:
      return badge("neutral", "?", String(decision ?? "UNKNOWN"));
  }
}

export function freshnessLabel(isoTimestamp) {
  if (!isoTimestamp) return null;
  const then = Date.parse(isoTimestamp);
  if (!Number.isFinite(then)) return null;
  const ms = Date.now() - then;
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  const days = Math.floor(hours / 24);
  return `${days}d old`;
}
