import { escapeHtml } from "../ui/escape.mjs";
import { evidencePassportHtml } from "../ui/evidence-passport.mjs";
import { policyFormHtml } from "../ui/policy-form.mjs";
import { policyResultHtml } from "../ui/policy-result.mjs";
import type { EvidenceApiResponse, ResourceApiResponse } from "../api-v1.ts";
import { renderLayoutHtml } from "./layout.ts";

export interface ResourcePageState {
  resourceApi: ResourceApiResponse;
  evidenceApi: EvidenceApiResponse;
  isDemo: boolean;
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
    <h1>${escapeHtml(resource.name)}</h1>
    <p>Evidence Passport — every dimension below is independent. No dimension implies another.</p>
    ${demoBanner}
    ${passport}
    <section class="passportSection" id="policy-playground">
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
  const body = `<h1>Resource not found</h1><p>No AegisOne catalog resource exists with id <code>${escapeHtml(resourceId)}</code>.</p>`;
  return renderLayoutHtml({ title: "Resource not found — AegisOne Hub", activeNav: "none", bodyHtml: body });
}
