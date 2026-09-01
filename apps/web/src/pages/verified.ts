import { escapeHtml, safeHttpUrl } from "../ui/escape.mjs";
import { categoryArtSvg } from "../ui/category-art.mjs";
import { libraryStateLabel, libraryStateMeaning, type LibraryStateFact, type LibraryStateId } from "../library-state.ts";
import type { SkillLibraryEntry } from "../library.ts";
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
import { escapeObjectsHtml, renderLayoutHtml } from "./layout.ts";

/**
 * Three frame-breaking objects. This is the one page where the *proven* end of the vocabulary is
 * the subject, so the escapes are: a near byte-grid tile past the top-left (the bytes that were
 * actually compared), a connector past the right edge (a record linked to its published evidence),
 * and a small far package bottom-right (everything still only indexed).
 *
 * The verdict stamp is not used as ornament anywhere, here included: it means AegisOne holds
 * correspondence evidence for one specific resource, and it only ever appears attached to one.
 */
const HERO_ESCAPES = escapeObjectsHtml([
  { slot: "tl", shape: "bytegrid", depth: "near", drift: "slow" },
  { slot: "rt", shape: "node", depth: "far" },
  { slot: "br", shape: "cube", depth: "far", drift: "fast" },
]);

/**
 * VERIFIED LIBRARY — section 3 of the four-section IA (ADR-016), now the real thing.
 *
 * ==========================================================================================
 * WHAT THIS PAGE IS ALLOWED TO SAY
 * ==========================================================================================
 * Every entry is a real catalog resource read through `SkillLibraryLoader`, which reads through
 * `loadAssembledResource` — the same integrity-checked path `GET /api/v1/resources/:id`, the MCP
 * tools and the Evidence Passport use. This page performs no verification, recomputes nothing, and
 * cannot upgrade any state. It renders four *independent* facts per resource
 * (`library-state.ts`), each shown as present or explicitly absent:
 *
 *   INDEXED · AUDITED · VERIFIED · STORED ON 0G
 *
 * They are never summed, never collapsed into one badge, and there is no numeric score anywhere.
 * An absent state is stated as missing evidence about what AegisOne knows — never as a finding
 * against the resource, and never quietly omitted so the row looks complete.
 *
 * `STORED ON 0G` in particular is unfakeable by construction: it renders only from
 * `entry.states.storedOn0g.present`, which comes from `checkStoragePublicationIntegrity`, and the
 * root it displays comes only from `entry.publication`, which is `null` unless that same gate
 * passed. There is no branch in this file that can print a 0G root from a raw catalog column.
 *
 * ==========================================================================================
 * THE RECORDED M5/M7 EVIDENCE IS LABELLED AS HISTORY, NOT AS A FRESH PUBLISH
 * ==========================================================================================
 * The anchors in the "Recorded live runs" section are genuine results of AegisOne's completed M5
 * and M7 runs and resolve on the public 0G explorers. They are presented in their own section,
 * explicitly dated to those milestones, and are never attached to a library entry as though a
 * resource in the list had produced them.
 */

export interface VerifiedPageState {
  readonly entries: readonly SkillLibraryEntry[];
  /** Resource id of the labeled M8.9 demo fixture, when seeded. */
  readonly demoResourceId: string | null;
  /** Whether an operator publication path is configured on this deployment. Purely informational —
   * no publish control is ever rendered for a visitor, because publishing is not a visitor action. */
  readonly publicationConfigured: boolean;
}

function anchorRow(label: string, value: string, href: string | null): string {
  const valueHtml = `<code class="hashValue">${escapeHtml(value)}</code>`;
  const link = href ? ` <a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">open ↗</a>` : "";
  return `<div class="hashRow"><span class="hashLabel">${escapeHtml(label)}</span><span class="fieldValue">${valueHtml}${link}</span></div>`;
}

/** One state chip. Present states carry a label, a glyph and a meaning; absent states carry the
 * reason they are absent. Both are always text — state is never encoded in colour alone. */
function stateChip(fact: LibraryStateFact): string {
  const label = libraryStateLabel(fact.id);
  if (fact.present) {
    return `<span class="stateChip stateChip--on stateChip--${escapeHtml(fact.id)}" title="${escapeHtml(libraryStateMeaning(fact.id))}"><span class="stateChip__glyph" aria-hidden="true">●</span>${escapeHtml(label)}</span>`;
  }
  return `<span class="stateChip stateChip--off" title="${escapeHtml(fact.absentReason ?? "not established")}"><span class="stateChip__glyph" aria-hidden="true">○</span>${escapeHtml(label)} <span class="stateChip__not">not established</span></span>`;
}

function stateLedger(entry: SkillLibraryEntry): string {
  const facts = [entry.states.indexed, entry.states.audited, entry.states.verified, entry.states.storedOn0g];
  return `<div class="stateLedger" role="group" aria-label="Evidence AegisOne holds">${facts.map(stateChip).join("")}</div>`;
}

/** The absent-evidence notes, printed in full rather than hidden behind a tooltip. Missing evidence
 * is part of the record, so it is shown as prose, not merely as a greyed chip. */
function absenceNotes(entry: SkillLibraryEntry): string {
  const absent = [entry.states.audited, entry.states.verified, entry.states.storedOn0g].filter((fact) => !fact.present);
  if (absent.length === 0) return "";
  const items = absent
    .map((fact) => `<li><strong>${escapeHtml(libraryStateLabel(fact.id))}:</strong> ${escapeHtml(fact.absentReason ?? "not established")}</li>`)
    .join("");
  return `<ul class="absenceList">${items}</ul>`;
}

/** 0G pointers. Only ever reachable when `entry.publication` is non-null, i.e. the gate passed. */
function publicationRows(entry: SkillLibraryEntry): string {
  const publication = entry.publication;
  if (publication === null) return "";
  const rows = [
    anchorRow("0G Storage root", publication.storageRoot, null),
    anchorRow("0G Storage transaction", publication.storageTransaction, galileoTxUrl(publication.storageTransaction)),
    anchorRow("Canonical evidence digest", publication.canonicalEvidenceSha256, null),
  ];
  if (publication.registryRecordId !== null) {
    rows.push(anchorRow("Chain commitment record", publication.registryRecordId, null));
  }
  if (publication.registryTransaction !== null) {
    rows.push(anchorRow("Chain commitment transaction", publication.registryTransaction, galileoTxUrl(publication.registryTransaction)));
  }
  return `<div class="pubBlock"><span class="edgeLabel">Where this evidence lives</span>${rows.join("")}<p class="pubNote">${escapeHtml(
    `Stored on ${publication.network} (chain ${publication.chainId}). The root commits to the exact evidence bundle; the digest above is AegisOne's canonical manifest, which the root is bound into. Check them on 0G rather than taking this page's word for it.`,
  )}</p></div>`;
}

function entryRow(entry: SkillLibraryEntry, index: number): string {
  const art = categoryArtSvg(entry.category.id, { className: "libArt" });
  const repositoryUrl = safeHttpUrl(entry.sourceRepositoryUrl);
  const by = entry.publisherLabel
    ? `<span class="libBy">by ${escapeHtml(entry.publisherLabel)}</span>`
    : `<span class="libBy libBy--unknown">author unknown</span>`;

  const digest = entry.contentSha256
    ? `<div class="libFact"><dt>Content SHA-256</dt><dd><code class="libFactValue libFactValue--mono">${escapeHtml(entry.contentSha256)}</code></dd></div>`
    : `<div class="libFact"><dt>Content SHA-256</dt><dd><span class="libFactValue libFactValue--unknown">not packaged by AegisOne</span></dd></div>`;

  const commit = entry.sourceCommitSha
    ? `<div class="libFact"><dt>Source commit</dt><dd><code class="libFactValue libFactValue--mono">${escapeHtml(entry.sourceCommitSha)}</code></dd></div>`
    : `<div class="libFact"><dt>Source commit</dt><dd><span class="libFactValue libFactValue--unknown">no pinned commit</span></dd></div>`;

  const severity = entry.trust.security.status === "COMPLETED"
    ? `<div class="libFact"><dt>Audit result</dt><dd><span class="libFactValue">${escapeHtml(String(entry.trust.security.highestSeverity ?? "INFO"))} · ${escapeHtml(String(entry.trust.security.findingCount ?? 0))} finding${entry.trust.security.findingCount === 1 ? "" : "s"}</span></dd></div>`
    : `<div class="libFact"><dt>Audit result</dt><dd><span class="libFactValue libFactValue--unknown">audit not run</span></dd></div>`;

  const correspondence = `<div class="libFact"><dt>Correspondence</dt><dd><span class="libFactValue">${escapeHtml(entry.trust.correspondence.status)}</span></dd></div>`;

  return `
    <li class="libRow">
      <span class="libIndex" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      ${art}
      <div class="libBody">
        <div class="libHead">
          <h3>${escapeHtml(entry.name)}</h3>
          ${by}
        </div>
        <p class="libDesc">${escapeHtml(entry.description)}</p>
        ${stateLedger(entry)}
        <dl class="libFacts">${digest}${commit}${severity}${correspondence}</dl>
        ${absenceNotes(entry)}
        ${publicationRows(entry)}
        ${repositoryUrl ? `<p class="libUrl"><a href="${escapeHtml(repositoryUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(repositoryUrl)} ↗</a></p>` : ""}
        <div class="libActions">
          <a class="button libCta" href="/resources/${encodeURIComponent(entry.resourceId)}">Open the Evidence Passport <span class="arrow" aria-hidden="true">→</span></a>
        </div>
      </div>
    </li>`;
}

export function renderVerifiedPageHtml(state: VerifiedPageState): string {
  const { entries } = state;

  const storedCount = entries.filter((entry) => entry.states.storedOn0g.present).length;
  const verifiedCount = entries.filter((entry) => entry.states.verified.present).length;
  const auditedCount = entries.filter((entry) => entry.states.audited.present).length;

  const list = entries.length === 0
    ? `<p class="emptyState">The catalog holds no resources on this deployment yet. This page lists what AegisOne actually has evidence for, so it stays empty rather than showing placeholder rows.</p>`
    : `<ol class="library">${entries.map(entryRow).join("")}</ol>`;

  const demoLink = state.demoResourceId
    ? `<a class="button" href="/resources/${encodeURIComponent(state.demoResourceId)}?demo=1">See a real MATCH / MISMATCH pair <span class="arrow" aria-hidden="true">→</span></a>`
    : "";

  const body = `
    <span class="edgeLabel">03 / Verified library</span>
    <span class="sectionNum" aria-hidden="true">03</span>
    <section class="hero hero--solo">
      ${HERO_ESCAPES}
      <div class="heroCopy">
        <h1 class="tight">Everything AegisOne can actually <span class="capsule">prove</span>, and everything it cannot.</h1>
        <p class="lede">Four independent facts per resource. Not a score, not a rating, not a badge that means "fine". Each one is either established by evidence or shown as missing — and the missing ones are printed, not hidden.</p>
      </div>
    </section>

    <section class="stateKey">
      ${(["INDEXED", "AUDITED", "VERIFIED", "STORED_ON_0G"] as LibraryStateId[])
        .map(
          (id) => `<div class="stateKeyItem stateKeyItem--${escapeHtml(id)}">
            <span class="stateKeyLabel">${escapeHtml(libraryStateLabel(id))}</span>
            <span class="stateKeyMeaning">${escapeHtml(libraryStateMeaning(id))}</span>
          </div>`,
        )
        .join("")}
    </section>

    <section class="tallyStrip" aria-label="What this library currently holds">
      <div class="tally"><span class="tallyNum">${entries.length}</span><span class="tallyLabel">in the library</span></div>
      <div class="tally"><span class="tallyNum">${auditedCount}</span><span class="tallyLabel">audited</span></div>
      <div class="tally"><span class="tallyNum">${verifiedCount}</span><span class="tallyLabel">byte-verified</span></div>
      <div class="tally tally--zerog"><span class="tallyNum">${storedCount}</span><span class="tallyLabel">stored on 0G</span></div>
    </section>

    ${
      storedCount === 0
        ? `<p class="passportWarning">No resource in this library has an evidence bundle on 0G Storage yet. The publication path is built and tested, but a funded live run has not been performed, so this page shows zero rather than a number it cannot back. When a publication happens, the root and its transaction appear on the resource itself and resolve on the public 0G explorer.</p>`
        : ""
    }

    ${list}

    <section class="panel" style="margin-top:26px">
      <span class="edgeLabel">What the strongest state does not mean</span>
      <h2>The limits, stated in the same place as the claims</h2>
      <ul class="findingList">
        <li><strong>MATCH does not mean safe.</strong> VERIFIED means reproduced bytes equalled distributed bytes. It is not a malware scan, a code review, or a statement about the publisher — a skill can correspond exactly to its source and still tell an agent to do something harmful.</li>
        <li><strong>MATCH requires a distinct distributed artifact.</strong> Packaging the same source twice and comparing it with itself is not correspondence evidence, so AegisOne refuses to call that a MATCH.</li>
        <li><strong>STORED ON 0G is a location, not a verdict.</strong> It says an evidence bundle is retrievable from 0G Storage. It says nothing about whether the resource is good.</li>
        <li><strong>AUDITED with zero findings is not a clean bill of health.</strong> It is the absence of the specific patterns a deterministic analyser looks for.</li>
        <li><strong>Indexed is not verified.</strong> A resource appearing in discovery, or a repository simply existing, proves nothing about authorisation or bytes.</li>
        <li><strong>Missing evidence stays missing.</strong> An absent digest, storage root or audit is shown as absent. It is never inferred to complete a row.</li>
      </ul>
    </section>

    <section class="panel" style="margin-top:22px">
      <span class="edgeLabel">Recorded live runs — M5 and M7</span>
      <h2>Anchors a judge can check without trusting this page</h2>
      <p class="passportNote">These are the recorded results of AegisOne's <strong>completed M5 and M7 live runs</strong>. They are historical evidence from those milestones — not output of a publication made by the library above — and every one resolves on a public 0G explorer.</p>
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
      <p class="passportWarning">Boundary, stated rather than glossed: the live TDX quote proves provider/runtime evidence only — the artifact digest is not cryptographically bound into the quote, so AegisOne does not claim TEE output binding or in-TEE computation. M7's mainnet commitments are deliberately PREPARED_NOT_SUBMITTED.</p>
    </section>

    <section class="panel" style="margin-top:22px">
      <span class="edgeLabel">How evidence gets onto 0G</span>
      <h2>Publication is an operator action, and that is on purpose</h2>
      <p>Writing to 0G spends real funds from a signer that lives on one internal service and nowhere else. AegisOne has no user accounts, so there is no honest way to let an anonymous visitor spend it — a per-IP limit on a funded endpoint is not a control. Publication therefore requires an operator token, and no publish control is rendered on this page for anyone.</p>
      <p class="passportNote">${escapeHtml(
        state.publicationConfigured
          ? "This deployment has an operator publication path configured."
          : "This deployment has no operator publication path configured, so no publication can be triggered here at all.",
      )}</p>
      <div class="ctaRow">
        ${demoLink}
        <a class="button" href="/proof">The full 0G evidence ledger <span class="arrow" aria-hidden="true">→</span></a>
        <a class="button" href="/agents">Read this evidence as an agent <span class="arrow" aria-hidden="true">→</span></a>
        <a class="button" href="${escapeHtml(GITHUB_URL)}/blob/main/hackathon/evidence.md" rel="noopener noreferrer" target="_blank">Structured evidence files ↗</a>
      </div>
    </section>
  `;

  return renderLayoutHtml({
    title: "Verified Library — AegisOne",
    activeNav: "verified",
    bodyHtml: body,
  });
}
