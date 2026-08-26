// Isomorphic search-result-card rendering (see escape.mjs header). Used both by the server-side
// initial render of `/` (`apps/web/src/pages/hub.ts`) and by the browser after a debounced
// `fetch('/search', ...)` re-query (`apps/web/public/app.js`) — one renderer, never two.
//
// `POST /search` (docs/24-m8-11-contract-freeze.md) returns one of two distinct shapes depending on
// whether the request federated:
//   - local catalog (`federation: "none"`/absent): `{ results: ArdSearchResult[], referrals }` —
//     each result is a raw pinned-ARD catalog entry (identifier/displayName/type/description/
//     tags/score/source, possibly an upstream `trustManifest`). AGENTS.md/docs/17 Threat M8-020:
//     an ARD `trustManifest`/`verified`/score-looking field is NEVER read here as ProofRail trust
//     evidence — local-catalog cards always render as discovery-only.
//   - federated (`federation: [...]`): `{ results: CapabilityResource[], providerStatuses }` —
//     each result already carries the full independent M8.1 `trust` object (still discovery-only
//     unless a real catalog/verification pipeline produced it; the federated normalizers in
//     `packages/discovery-providers` always emit empty trust for provider-sourced entries).
//
// This module never distinguishes "which shape looked more trustworthy" — it only ever reads
// `resource.trust.*` when the entry actually has a `trust` object, and otherwise renders exactly
// the discovery-only card. Relevance/`score` is always rendered in its own visually distinct
// "relevance" slot, never merged into a trust badge.

import { escapeHtml, safeHttpUrl } from "./escape.mjs";
import { discoveryBadge, sourceAssuranceBadge, correspondenceBadge, securityBadge, canonicalEvidenceBadge } from "./badges.mjs";

function isCapabilityResource(entry) {
  return entry !== null && typeof entry === "object" && "trust" in entry && "kind" in entry;
}

/** Normalizes either search-response shape into one array of `{ id, kind, name, description,
 * resourceUrl, relevanceScore, providerSource, trust | null }` — `trust` is `null` for a raw local
 * ARD entry (discovery-only), never fabricated. */
export function normalizeSearchResults(searchResponse) {
  const results = Array.isArray(searchResponse?.results) ? searchResponse.results : [];
  return results.map((entry) => {
    if (isCapabilityResource(entry)) {
      return {
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        description: entry.description,
        resourceUrl: entry.discovery?.resourceUrl ?? null,
        relevanceScore: typeof entry.discovery?.relevanceScore === "number" ? entry.discovery.relevanceScore : null,
        discoveryStatus: entry.discovery?.status ?? "INDEXED",
        providerSource: entry.discovery?.source ?? null,
        trust: entry.trust ?? null,
        // A resourceId only exists for resources ProofRail's own catalog has stored (i.e. reachable
        // via /api/v1/resources/:resourceId). Discovery-only federated results are not catalog rows
        // and therefore never link to a Passport page pretending they are.
        catalogResourceId: typeof entry.catalogResourceId === "string" ? entry.catalogResourceId : null,
      };
    }
    return {
      id: entry.identifier,
      kind: entry.type,
      name: entry.displayName,
      description: entry.description ?? "",
      resourceUrl: entry.url ?? null,
      relevanceScore: typeof entry.score === "number" ? entry.score : null,
      discoveryStatus: "INDEXED",
      providerSource: entry.source ?? null,
      trust: null,
      catalogResourceId: null,
    };
  });
}

export function providerStatusesHtml(providerStatuses) {
  if (!Array.isArray(providerStatuses) || providerStatuses.length === 0) return "";
  const items = providerStatuses.map((status) => {
    if (status.ok) {
      return `<li class="providerStatus providerStatus--ok"><span aria-hidden="true">●</span> ${escapeHtml(status.providerId)} — ${status.resourceCount} result${status.resourceCount === 1 ? "" : "s"}</li>`;
    }
    return `<li class="providerStatus providerStatus--down"><span aria-hidden="true">▲</span> ${escapeHtml(status.providerId)} unavailable${status.message ? ` — ${escapeHtml(status.message)}` : ""} (provider outage, not a security finding)</li>`;
  });
  return `<ul class="providerStatusList" aria-label="Discovery provider status">${items.join("")}</ul>`;
}

export function resultCardHtml(item) {
  const kind = escapeHtml(item.kind ?? "resource");
  const name = escapeHtml(item.name || "(untitled resource)");
  const description = escapeHtml(item.description || "No description provided.");
  const href = item.catalogResourceId ? `/resources/${encodeURIComponent(item.catalogResourceId)}` : null;
  const relevance = typeof item.relevanceScore === "number" ? `<span class="relevance" title="Relevance is a discovery-ranking signal only; it is never a trust or safety score.">relevance ${Math.round(item.relevanceScore * 100)}%</span>` : "";
  const provider = item.providerSource ? `<span class="provider">via ${escapeHtml(item.providerSource)}</span>` : "";

  let trustRow;
  if (item.trust) {
    trustRow = `<div class="cardBadges">
      ${discoveryBadge(item.discoveryStatus)}
      ${sourceAssuranceBadge(item.trust.sourceAssurance?.level)}
      ${correspondenceBadge(item.trust.correspondence?.status)}
      ${securityBadge(item.trust.security?.status, item.trust.security?.highestSeverity, item.trust.security?.findingCount)}
      ${canonicalEvidenceBadge(item.trust.canonicalEvidence?.status, item.trust.canonicalEvidence?.verifiedAt)}
    </div>`;
  } else {
    trustRow = `<div class="cardBadges">${discoveryBadge(item.discoveryStatus)}<span class="cardNote">No ProofRail evidence yet — discovery only.</span></div>`;
  }

  const titleInner = href ? `<a href="${href}">${name}</a>` : name;
  const urlLine = item.resourceUrl ? `<div class="cardUrl"><a href="${safeHttpUrl(item.resourceUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(item.resourceUrl)}</a></div>` : "";

  return `<article class="resultCard" data-kind="${kind}">
    <div class="cardHead"><h3>${titleInner}</h3><span class="kindTag">${kind}</span></div>
    <p class="cardDescription">${description}</p>
    ${trustRow}
    <div class="cardMeta">${provider}${relevance}</div>
    ${urlLine}
  </article>`;
}

export function resultListHtml(searchResponse) {
  const items = normalizeSearchResults(searchResponse);
  const statuses = providerStatusesHtml(searchResponse?.providerStatuses);
  if (items.length === 0) {
    return `${statuses}<p class="emptyState">No results. Try a different phrase, or broaden federation.</p>`;
  }
  return `${statuses}<div class="resultGrid">${items.map(resultCardHtml).join("")}</div>`;
}
