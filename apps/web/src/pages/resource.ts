import { escapeHtml } from "../ui/escape.mjs";
import { evidencePassportHtml, passportStampSvg } from "../ui/evidence-passport.mjs";
import { verifyResultHtml } from "../ui/verify-view.mjs";
import { policyFormHtml } from "../ui/policy-form.mjs";
import { policyResultHtml } from "../ui/policy-result.mjs";
import type { EvidenceApiResponse, ResourceApiResponse } from "../api-v1.ts";
import { renderLayoutHtml } from "./layout.ts";

export interface ResourcePageState {
  resourceApi: ResourceApiResponse;
  evidenceApi: EvidenceApiResponse;
  isDemo: boolean;
  /**
   * ADR-020: whether this exact resource resolves to a real verification target — an exact,
   * immutable source revision the catalog itself recorded. Computed server-side by
   * `resolveVerificationTarget`, never guessed from the page's own fields, so the button is only
   * ever offered where the backend would actually accept it.
   */
  verifiable?: boolean;
  /** Whether this runtime can perform exact-commit source acquisition at all (it needs `git`). */
  sourceAcquisitionAvailable?: boolean;
}

/**
 * The on-passport verification trigger (ADR-020). It posts the same `POST /api/v1/verify` body the
 * Audit Lab does — `{ resourceId }` and nothing else — and appends a new immutable row rather than
 * revising the sections above it. Refreshing the page shows the new result through the same
 * unmodified read path everything else on this page uses.
 */
function verificationPanelHtml(state: ResourcePageState): string {
  if (state.verifiable !== true) {
    return `<section class="panel panel--flat" id="run-verification" style="margin-top:26px">
      <span class="edgeLabel">09 / Package verification</span>
      <h2>Not independently reproducible yet</h2>
      <p class="passportNote">AegisOne has no exact, immutable source revision recorded for this resource, so there is nothing to independently reproduce from. Recording one is what <a href="/source/claim">a source claim</a> does. This is missing evidence, not a finding against the resource.</p>
    </section>`;
  }
  const unavailable = state.sourceAcquisitionAvailable === false
    ? `<p class="passportWarning">This deployment cannot perform exact-commit source acquisition (no <code>git</code> in this runtime), so the run would be refused with an explicit <code>source_acquisition_unavailable</code> rather than a partial result.</p>`
    : "";
  return `<section class="panel" id="run-verification" style="margin-top:26px">
    <span class="edgeLabel">09 / Package verification</span>
    <h2>Reproduce this package yourself</h2>
    <p class="passportNote">AegisOne clones the exact commit recorded above, packages it with the same deterministic packer the audit pipeline uses, and — only if a distinct distributed artifact is on record — compares the two byte-for-byte. It never installs or executes anything. Each run appends a new row to the history above; no earlier verdict is ever rewritten.</p>
    ${unavailable}
    <div class="ctaRow" style="margin-top:14px">
      <button class="button button--primary" type="button" id="verify-resource"${state.sourceAcquisitionAvailable === false ? " disabled" : ""}>Run verification <span class="arrow" aria-hidden="true">&rarr;</span></button>
    </div>
    <div id="verify-result" style="margin-top:18px">${verifyResultHtml(null)}</div>
  </section>`;
}

export function renderResourcePageHtml(state: ResourcePageState): string {
  const resource = state.resourceApi.resource;
  const demoBanner = state.isDemo
    ? `<div class="demoBanner">DEMO FIXTURE — this resource is seeded from M8.9's own tested substitution-demo identity/content, computed through the real AegisOne verification pipeline. It is not live production evidence.</div>`
    : "";

  const passport = evidencePassportHtml({
    resource,
    sourceClaims: state.evidenceApi.sourceClaims,
    capabilityVerifications: state.evidenceApi.capabilityVerifications,
    integrity: state.evidenceApi.integrity,
  });

  const policyDataJson = JSON.stringify({ resourceId: state.resourceApi.resourceId }).replace(/</g, "\\u003c");

  const body = `
    <span class="edgeLabel">Evidence passport</span>
    ${demoBanner}
    <header class="passportHead">
      <div>
        <div class="pillRow">
          <span class="pill">${escapeHtml(resource.kind ?? "resource")}</span>
        </div>
        <h1 class="tight">${escapeHtml(resource.name)}</h1>
        <p class="lede">Every dimension is independent. No dimension implies another — an authenticated repository has not thereby proven its bytes, and bytes that correspond have not thereby been proven safe.</p>
      </div>
      ${passportStampSvg(resource.trust?.correspondence?.status)}
    </header>
    ${passport}
    ${verificationPanelHtml(state)}
    <section class="panel" id="policy-playground" style="margin-top:26px">
      <span class="edgeLabel">08 / Your policy</span>
      <h2>Policy playground</h2>
      <p class="passportNote">Evaluated by the real deterministic backend (<code>POST /api/v1/policy/evaluate</code>). The browser never recomputes ALLOW/REVIEW/DENY itself.</p>
      ${policyFormHtml({ resourceId: state.resourceApi.resourceId })}
      <div id="policy-result">${policyResultHtml(null)}</div>
    </section>
    <script type="application/json" id="resource-data">${policyDataJson}</script>
  `;

  return renderLayoutHtml({
    title: `${resource.name} — AegisOne Evidence Passport`,
    activeNav: "resource",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="resource"></script>`,
  });
}

export function renderResourceNotFoundHtml(resourceId: string): string {
  const body = `<span class="edgeLabel">404</span>
    <h1>Resource not found</h1>
    <p class="lede">No AegisOne catalog resource exists with id <code class="hashValue">${escapeHtml(resourceId)}</code>.</p>
    <div class="ctaRow" style="margin-top:22px"><a class="button button--primary" href="/">Back to search <span class="arrow" aria-hidden="true">→</span></a><a class="button" href="/scan">Paste a skill to scan</a></div>`;
  return renderLayoutHtml({ title: "Resource not found — AegisOne Hub", activeNav: "none", bodyHtml: body });
}
