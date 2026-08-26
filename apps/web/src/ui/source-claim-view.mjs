// Isomorphic rendering for the `/source/claim` result state (see escape.mjs header). Renders the
// exact `POST /api/v1/source-claims` response (`{ claim, authorityObservations, supersededClaimId,
// conflict }`, docs/14-source-authentication.md "Implemented HTTP response shapes") verbatim.

import { escapeHtml, shortHash } from "./escape.mjs";
import { sourceAssuranceBadge } from "./badges.mjs";

export function repositoryListItemHtml(repo) {
  const disabled = !repo.supported ? " disabled" : "";
  const note = !repo.supported
    ? '<span class="repoNote">private — unsupported in M8</span>'
    : !repo.sufficientAuthority
      ? '<span class="repoNote">read-only authority — claim will stay DECLARED</span>'
      : '<span class="repoNote repoNote--good">sufficient authority</span>';
  return `<label class="repoOption"><input type="radio" name="repositoryFullName" value="${escapeHtml(repo.fullName)}"${disabled}> ${escapeHtml(repo.fullName)} ${note}</label>`;
}

export function repositoryListHtml(repositories) {
  if (!Array.isArray(repositories) || repositories.length === 0) {
    return `<p class="emptyState">No accessible repositories were returned by GitHub for this account/installation.</p>`;
  }
  return `<div class="repoList">${repositories.map(repositoryListItemHtml).join("")}</div>`;
}

export function claimResultHtml(payload) {
  const claim = payload?.claim;
  if (!claim) return `<p class="emptyState">No claim created yet.</p>`;
  const conflictNote = payload.conflict
    ? `<p class="passportWarning">SOURCE_CLAIM_CONFLICT: a different repository is already claimed for this resource version. Neither claim was silently preferred.</p>`
    : "";
  const supersededNote = payload.supersededClaimId
    ? `<p class="passportNote">This claim supersedes a prior claim for the same repository (id ${escapeHtml(payload.supersededClaimId)}).</p>`
    : "";
  return `<div class="claimResult">
    <div class="fieldRow"><span class="fieldLabel">Assurance level</span><span class="fieldValue">${sourceAssuranceBadge(claim.assuranceLevel)}</span></div>
    <div class="fieldRow"><span class="fieldLabel">Repository</span><span class="fieldValue">${escapeHtml(claim.sourceRepository)}</span></div>
    <div class="fieldRow"><span class="fieldLabel">Exact commit</span><span class="fieldValue"><code title="${escapeHtml(claim.sourceCommitSha)}">${escapeHtml(shortHash(claim.sourceCommitSha, 12))}</code></span></div>
    <div class="fieldRow"><span class="fieldLabel">Claim digest (SHA-256)</span><span class="fieldValue"><code title="${escapeHtml(claim.claimDigestSha256 ?? "")}">${escapeHtml(shortHash(claim.claimDigestSha256 ?? ""))}</code></span></div>
    <div class="fieldRow"><span class="fieldLabel">Claim id</span><span class="fieldValue">${escapeHtml(claim.id)}</span></div>
    ${conflictNote}
    ${supersededNote}
    <p class="passportNote">Connecting GitHub authenticates only the exact repository/commit claimed here — it does not automatically authenticate every resource discovered from this account.</p>
  </div>`;
}

export function claimErrorHtml(error) {
  const message = error && typeof error === "object" && typeof error.message === "string" ? error.message : "The source claim could not be created.";
  return `<div class="claimResult claimResult--error"><p class="errorText">${escapeHtml(message)}</p></div>`;
}
