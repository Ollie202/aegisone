import { escapeHtml } from "../ui/escape.mjs";
import { evidencePassportHtml, passportStampSvg } from "../ui/evidence-passport.mjs";
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
    <span class="edgeLabel">Evidence passport</span>
    ${demoBanner}
    <header class="passportHead">
      <div>
        <div class="pillRow">
          <span class="pill">${escapeHtml(resource.kind ?? "resource")}</span>
          <span class="pill pill--peri">7 independent dimensions</span>
        </div>
        <h1 class="tight">${escapeHtml(resource.name)}</h1>
        <p class="lede">Every dimension below is independent. No dimension implies another — a repository that authenticates its source has not thereby proven its bytes, and bytes that correspond have not thereby been proven safe.</p>
      </div>
      ${passportStampSvg(resource.trust?.correspondence?.status)}
    </header>
    ${passport}
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
