// Isomorphic Evidence Passport section rendering (see escape.mjs header).
//
// Renders `GET /api/v1/resources/:resourceId` (`ResourceApiResponse`) and
// `GET /api/v1/resources/:resourceId/evidence` (`EvidenceApiResponse`) — docs/20-m8-api-contract.md
// — into the sections `docs/18-m9-frontend-plan.md` "Resource / Evidence Passport" specifies:
// Capability, Source assurance, Distribution correspondence, Security audit, Independent
// execution, Canonical evidence, Verification history. Every rendered claim traces to a named
// field on one of these two responses; nothing here is invented client-side copy beyond fixed
// section labels/disclaimers that hold regardless of the data (e.g. "no findings is not proof of
// safety").

import { escapeHtml, safeHttpUrl, shortHash } from "./escape.mjs";
import {
  discoveryBadge,
  sourceAssuranceBadge,
  correspondenceBadge,
  securityBadge,
  canonicalEvidenceBadge,
  freshnessLabel,
} from "./badges.mjs";

function hashCell(label, value) {
  if (!value) return `<div class="hashRow"><span class="hashLabel">${escapeHtml(label)}</span><code class="hashValue hashValue--empty">unavailable</code></div>`;
  return `<div class="hashRow"><span class="hashLabel">${escapeHtml(label)}</span><code class="hashValue" title="${escapeHtml(value)}">${escapeHtml(shortHash(value))}</code></div>`;
}

function fieldRow(label, valueHtml) {
  return `<div class="fieldRow"><span class="fieldLabel">${escapeHtml(label)}</span><span class="fieldValue">${valueHtml}</span></div>`;
}

export function capabilitySectionHtml(resource) {
  const version = resource.currentVersion;
  return `<section class="passportSection" id="capability">
    <h2>Capability</h2>
    ${fieldRow("Name", escapeHtml(resource.name))}
    ${fieldRow("Kind", escapeHtml(resource.kind))}
    ${fieldRow("Version", escapeHtml(version?.versionLabel ?? "unlabeled"))}
    ${fieldRow("Discovery", discoveryBadge(resource.discovery?.status))}
    ${fieldRow("Discovery provider", escapeHtml(resource.discovery?.source ?? "unknown"))}
    <p class="passportDescription">${escapeHtml(resource.description || "No description provided.")}</p>
  </section>`;
}

export function sourceAssuranceSectionHtml(resource, sourceClaims, integrity) {
  const claim = Array.isArray(sourceClaims) && sourceClaims.length > 0 ? sourceClaims[0] : null;
  const level = resource.trust?.sourceAssurance?.level ?? "NONE";
  const integrityNote = integrity && integrity.present && !integrity.integrityCheckPassed
    ? `<p class="integrityWarning">A stored claim failed its integrity re-check and is treated as unavailable rather than trusted.</p>`
    : "";
  const body = claim
    ? `
    ${fieldRow("Repository", escapeHtml(claim.sourceRepository))}
    ${fieldRow("Exact commit", `<code class="hashValue" title="${escapeHtml(claim.sourceCommitSha)}">${escapeHtml(shortHash(claim.sourceCommitSha, 12))}</code>`)}
    ${fieldRow("Subdirectory", escapeHtml(claim.sourceSubdirectory ?? "(repository root)"))}
    ${fieldRow("Claim status", escapeHtml(claim.claimStatus))}
    ${fieldRow("Authenticated at", escapeHtml(claim.authenticatedAt ?? "not authenticated"))}
    ${hashCell("Declared distribution SHA-256", claim.distributionSha256)}
    ${fieldRow("Claim digest integrity", claim.integrityCheckPassed ? "verified" : "failed — treated as unavailable")}
    ${fieldRow("Claim id / digest", `<a href="/api/v1/source-claims/${encodeURIComponent(claim.id)}">${escapeHtml(claim.id)}</a>`)}
    `
    : `<p class="emptyState">No source claim yet. <a href="/source/claim">Authenticate a source claim</a> for this resource.</p>`;

  return `<section class="passportSection" id="source-assurance">
    <h2>Source assurance</h2>
    ${fieldRow("Level", sourceAssuranceBadge(level))}
    ${integrityNote}
    ${body}
  </section>`;
}

export function correspondenceSectionHtml(resource) {
  const correspondence = resource.trust?.correspondence ?? { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null };
  return `<section class="passportSection" id="correspondence">
    <h2>Distribution correspondence</h2>
    ${fieldRow("Result", correspondenceBadge(correspondence.status))}
    ${hashCell("Publisher / distributed SHA-256", correspondence.publisherSha256)}
    ${hashCell("Independently reproduced SHA-256", correspondence.reproducedSha256)}
    <p class="passportNote">MATCH means the independently reproduced artifact is byte-identical to the distributed artifact for the exact claimed source commit. MATCH does not mean safe, and is never shown here unless the backend's own integrity re-check passed.</p>
  </section>`;
}

export function securitySectionHtml(resource, findings) {
  const security = resource.trust?.security ?? { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null };
  const list = Array.isArray(findings) && findings.length > 0
    ? `<ul class="findingList">${findings.map((finding) => `<li><strong>${escapeHtml(finding.severity ?? "")}</strong> ${escapeHtml(finding.message ?? finding.description ?? JSON.stringify(finding))}</li>`).join("")}</ul>`
    : `<p class="passportNote">No itemized findings available from this endpoint.</p>`;
  return `<section class="passportSection" id="security">
    <h2>Security audit</h2>
    ${fieldRow("Result", securityBadge(security.status, security.highestSeverity, security.findingCount))}
    ${fieldRow("Analysis kind", escapeHtml(security.analysisKind ?? "not run"))}
    ${security.status === "COMPLETED" ? list : ""}
    <p class="passportWarning">No findings is not proof of safety. Security assessment is independent from source assurance and distribution correspondence.</p>
  </section>`;
}

export function independentExecutionSectionHtml(resource) {
  return `<section class="passportSection" id="independent-execution">
    <h2>Independent execution</h2>
    <p class="passportNote">Independent reproduction runs in the AegisOne 0G Sandbox when a distribution artifact and exact source commit are available. AegisOne records provider/runtime execution evidence only: unless canonical evidence explicitly binds the artifact digest to attestation evidence, no TEE artifact-output binding is claimed here.</p>
    ${fieldRow("Correspondence result", correspondenceBadge(resource.trust?.correspondence?.status))}
  </section>`;
}

export function canonicalEvidenceSectionHtml(resource) {
  const evidence = resource.trust?.canonicalEvidence ?? { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null };
  const fresh = freshnessLabel(evidence.verifiedAt);
  return `<section class="passportSection" id="canonical-evidence">
    <h2>Canonical evidence</h2>
    ${fieldRow("Status", canonicalEvidenceBadge(evidence.status, evidence.verifiedAt))}
    ${hashCell("Canonical evidence SHA-256", evidence.sha256)}
    ${fieldRow("Verified at", escapeHtml(evidence.verifiedAt ?? "unavailable"))}
    ${fresh ? fieldRow("Freshness", escapeHtml(fresh)) : ""}
    ${hashCell("0G Storage root", evidence.storageRoot)}
    ${fieldRow("Registry record", evidence.registryRecordId ? `<code class="hashValue" title="${escapeHtml(evidence.registryRecordId)}">${escapeHtml(shortHash(evidence.registryRecordId))}</code>` : "unavailable")}
  </section>`;
}

export function verificationHistorySectionHtml(verifications) {
  const rows = Array.isArray(verifications) ? verifications : [];
  if (rows.length === 0) {
    return `<section class="passportSection" id="history"><h2>Verification history</h2><p class="emptyState">No verification history recorded yet.</p></section>`;
  }
  const items = rows.map((row) => {
    const when = escapeHtml(row.verifiedAt ?? row.createdAt ?? "");
    return `<li class="historyRow"><span class="historyWhen">${when}</span>${correspondenceBadge(row.correspondenceStatus)}${securityBadge(row.securityStatus, row.securityHighestSeverity, row.securityFindingCount)}${row.integrityCheckPassed ? "" : '<span class="badge badge--negative"><span class="badge__glyph" aria-hidden="true">!</span><span class="badge__text">integrity check failed</span></span>'}</li>`;
  });
  return `<section class="passportSection" id="history"><h2>Verification history</h2><ul class="historyList">${items.join("")}</ul></section>`;
}

export function evidencePassportHtml({ resource, sourceClaims, capabilityVerifications, integrity }) {
  return [
    capabilitySectionHtml(resource),
    sourceAssuranceSectionHtml(resource, sourceClaims, integrity?.sourceAssurance),
    correspondenceSectionHtml(resource),
    securitySectionHtml(resource, null),
    independentExecutionSectionHtml(resource),
    canonicalEvidenceSectionHtml(resource),
    verificationHistorySectionHtml(capabilityVerifications),
  ].join("\n");
}

export function safeExternalLink(url, label) {
  return `<a href="${safeHttpUrl(url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(label ?? url ?? "")}</a>`;
}
