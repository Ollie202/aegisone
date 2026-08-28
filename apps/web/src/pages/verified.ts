import { escapeHtml } from "../ui/escape.mjs";
import {
  GITHUB_URL,
  M5_MAINNET_RECORD,
  M5_MAINNET_REGISTRY,
  M5_MAINNET_TX,
  M5_STORAGE_ROOT,
  M5_STORAGE_TX,
  M7_GALILEO_RECORD,
  M7_GALILEO_TX,
  M7_SKILL_DIGEST,
  M7_SOURCE_COMMIT,
  M7_STORAGE_ROOT,
  M7_STORAGE_TX,
  galileoTxUrl,
  mainnetAddressUrl,
  mainnetTxUrl,
} from "../live-evidence.ts";
import { renderLayoutHtml } from "./layout.ts";

/**
 * VERIFIED — section 3 of the four-section IA (ADR-016).
 *
 * ==========================================================================================
 * WHAT IS REAL ON THIS PAGE TODAY, AND WHAT IS EXPLICITLY NOT BUILT YET
 * ==========================================================================================
 * REAL: the definition of what AegisOne means by verified, and every 0G anchor listed below.
 * Those roots, records and transactions come from AegisOne's completed live M5 and M7 runs and
 * resolve on the public 0G explorers right now (`apps/web/src/live-evidence.ts`).
 *
 * NOT BUILT YET: the browsable, filterable index of every verified catalog resource. That is a
 * later change in this restructure. This page says so plainly and links to the three things that
 * genuinely work today rather than showing an empty grid or a dead control. Nothing here is a
 * placeholder pretending to be a feature.
 */

export interface VerifiedPageState {
  /** Resource id of the labeled M8.9 demo fixture, when it has been seeded — the one resource
   * that currently demonstrates a real MATCH/MISMATCH pair end to end. `null` when unavailable,
   * in which case no link is rendered rather than a broken one. */
  demoResourceId: string | null;
}

function anchorRow(label: string, value: string, href: string | null): string {
  const valueHtml = `<code class="hashValue">${escapeHtml(value)}</code>`;
  const link = href ? ` <a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">open ↗</a>` : "";
  return `<div class="hashRow"><span class="hashLabel">${escapeHtml(label)}</span><span class="fieldValue">${valueHtml}${link}</span></div>`;
}

export function renderVerifiedPageHtml(state: VerifiedPageState): string {
  const demoLink = state.demoResourceId
    ? `<a class="button button--primary" href="/resources/${encodeURIComponent(state.demoResourceId)}?demo=1">Open a real MATCH / MISMATCH passport <span class="arrow" aria-hidden="true">→</span></a>`
    : `<a class="button button--primary" href="/?demo=1">Enable the demo fixture <span class="arrow" aria-hidden="true">→</span></a>`;

  const body = `
    <span class="edgeLabel">03 / Verified</span>
    <span class="sectionNum" aria-hidden="true">03</span>
    <h1 class="tight">Verified means one <span class="mark">specific</span> thing.</h1>
    <p class="lede">AegisOne independently rebuilds an artifact from the exact source commit a publisher claims, and compares the resulting bytes with the bytes actually distributed. Equal bytes are a <strong>MATCH</strong>. That is the whole claim.</p>

    <section class="panel" style="margin-top:26px">
      <span class="edgeLabel">What MATCH does not mean</span>
      <h2>The limits, stated first</h2>
      <ul class="findingList">
        <li><strong>MATCH does not mean safe.</strong> It is not a malware scan, a code review, or a statement about the publisher. A skill can correspond exactly to its source and still tell an agent to do something harmful.</li>
        <li><strong>MATCH requires a distinct distributed artifact.</strong> Packaging the same source twice and comparing it with itself is not correspondence evidence, so AegisOne refuses to call that a MATCH.</li>
        <li><strong>Indexed is not verified.</strong> A resource appearing in discovery, or a repository simply existing, proves nothing about authorisation or bytes.</li>
        <li><strong>Missing evidence stays missing.</strong> An absent digest, storage root or audit is shown as absent. It is never inferred to complete a picture.</li>
      </ul>
    </section>

    <section class="panel" style="margin-top:22px">
      <span class="edgeLabel">Real 0G evidence</span>
      <h2>Anchors a judge can check without trusting this page</h2>
      <p class="passportNote">These are recorded results of AegisOne's completed live runs, not demo placeholders. Every one resolves on a public 0G explorer.</p>
      ${anchorRow("M5 software storage root", M5_STORAGE_ROOT, null)}
      ${anchorRow("M5 storage transaction", M5_STORAGE_TX, galileoTxUrl(M5_STORAGE_TX))}
      ${anchorRow("M5 Aristotle mainnet registry", M5_MAINNET_REGISTRY, mainnetAddressUrl(M5_MAINNET_REGISTRY))}
      ${anchorRow("M5 mainnet record", M5_MAINNET_RECORD, null)}
      ${anchorRow("M5 mainnet transaction", M5_MAINNET_TX, mainnetTxUrl(M5_MAINNET_TX))}
      ${anchorRow("M7 Agent Skill source commit", M7_SOURCE_COMMIT, null)}
      ${anchorRow("M7 Agent Skill package digest", M7_SKILL_DIGEST, null)}
      ${anchorRow("M7 Agent Skill storage root", M7_STORAGE_ROOT, null)}
      ${anchorRow("M7 storage transaction", M7_STORAGE_TX, galileoTxUrl(M7_STORAGE_TX))}
      ${anchorRow("M7 Galileo registry record", M7_GALILEO_RECORD, null)}
      ${anchorRow("M7 Galileo registration tx", M7_GALILEO_TX, galileoTxUrl(M7_GALILEO_TX))}
      <p class="passportWarning">Boundary, stated rather than glossed: the live TDX quote proves provider/runtime evidence only — the artifact digest is not cryptographically bound into the quote, so AegisOne does not claim TEE output binding. M7's mainnet commitments are deliberately PREPARED_NOT_SUBMITTED.</p>
    </section>

    <section class="upcoming">
      <span class="edgeLabel">Not built yet</span>
      <h2>A browsable index of every verified resource is still to come</h2>
      <p>This section will list and filter each catalog resource that carries a real correspondence verdict, with its digests and evidence pointers. It is not built yet, and this page will not fake it with an empty grid.</p>
      <p>What genuinely works today:</p>
      <div class="ctaRow">
        ${demoLink}
        <a class="button" href="/proof">The full 0G evidence ledger <span class="arrow" aria-hidden="true">→</span></a>
        <a class="button" href="/agents">Read evidence as an agent <span class="arrow" aria-hidden="true">→</span></a>
        <a class="button" href="${escapeHtml(GITHUB_URL)}/blob/main/hackathon/evidence.md" rel="noopener noreferrer" target="_blank">Structured evidence files ↗</a>
      </div>
    </section>
  `;

  return renderLayoutHtml({
    title: "Verified — AegisOne",
    activeNav: "verified",
    bodyHtml: body,
  });
}
