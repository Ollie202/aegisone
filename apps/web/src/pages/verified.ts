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
import { renderLayoutHtml } from "./layout.ts";

/**
 * VERIFIED — section 03 of the four-section IA.
 *
 * ONE JOB: **browse the evidence-backed state of resources.** This is an evidence *registry*, not
 * a third explanation of what verification is. The composition follows from that:
 *
 *     short header → the four-state key, compactly → filters → THE LIST (the page's hero)
 *     → the limits → recorded M5/M7 history, disclosed rather than dominant
 *
 * What changed, and why: the page used to open on a poster headline, a four-cell state key, a
 * tally strip, and then rows that each carried a paragraph of absence prose plus a full block of
 * 0G pointers — so a "registry" of three resources scrolled like an essay, and the historical
 * M5/M7 anchors (genuine, but from finished milestones) took as much room as the live library.
 * Rows are now summaries; each row's absent-evidence reasons and 0G pointers are still in the
 * document, one disclosure away; and the M5/M7 anchors sit in a clearly-labelled collapsed section
 * at the bottom. Depth belongs in the Evidence Passport, which every row links to.
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
 * FILTERING (client-side, `app.js`) is presentation-only for exactly the same reason: it toggles
 * the `hidden` attribute on rows the server already classified from real evidence. The filter
 * chips' counts are computed here, from those same server-side facts. Nothing a filter does can
 * create, upgrade or imply evidence — the strongest thing a filter can do is show fewer rows.
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
 * word "not established" as text. State is never encoded in colour alone, and an absent state is
 * never rendered as a blank — a blank would read as "fine". */
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

/** The absent-evidence reasons. Still printed in full, but as a disclosure rather than as a
 * paragraph of prose in every row: the chips above already say, in text, that each of these is not
 * established — this says *why AegisOne cannot say more*, for the reader who wants it. */
function absenceNotes(entry: SkillLibraryEntry): string {
  const absent = [entry.states.audited, entry.states.verified, entry.states.storedOn0g].filter((fact) => !fact.present);
  if (absent.length === 0) return "";
  const items = absent
    .map((fact) => `<li><strong>${escapeHtml(libraryStateLabel(fact.id))}:</strong> ${escapeHtml(fact.absentReason ?? "not established")}</li>`)
    .join("");
  return `<details class="disclose">
    <summary>Why ${absent.length} state${absent.length === 1 ? " is" : "s are"} not established</summary>
    <ul class="absenceList">${items}</ul>
  </details>`;
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
  return `<details class="disclose" open><summary>Where this evidence lives</summary><div class="pubBlock">${rows.join("")}<p class="pubNote">${escapeHtml(
    `Stored on ${publication.network} (chain ${publication.chainId}). The root commits to the exact evidence bundle; the digest above is AegisOne's canonical manifest, which the root is bound into. Check them on 0G rather than taking this page's word for it.`,
  )}</p></div></details>`;
}

/**
 * One registry row: identity → the four states → the key facts → the Passport.
 *
 * The `data-*` attributes are what the client-side filter reads. They are written from the same
 * `entry.states` booleans the chips are written from, so a filtered view can never disagree with
 * the evidence the row itself shows.
 */
function entryRow(entry: SkillLibraryEntry): string {
  const art = categoryArtSvg(entry.category.id, { className: "libArt" });
  const repositoryUrl = safeHttpUrl(entry.sourceRepositoryUrl);
  const by = entry.publisherLabel
    ? `<span class="libBy">by ${escapeHtml(entry.publisherLabel)}</span>`
    : `<span class="libBy libBy--unknown">author unknown</span>`;

  const commit = entry.sourceCommitSha
    ? `<div class="libFact"><dt>Source commit</dt><dd><code class="libFactValue libFactValue--mono">${escapeHtml(entry.sourceCommitSha)}</code></dd></div>`
    : `<div class="libFact"><dt>Source commit</dt><dd><span class="libFactValue libFactValue--unknown">no pinned commit</span></dd></div>`;

  const digest = entry.contentSha256
    ? `<div class="libFact"><dt>Content SHA-256</dt><dd><code class="libFactValue libFactValue--mono">${escapeHtml(entry.contentSha256)}</code></dd></div>`
    : `<div class="libFact"><dt>Content SHA-256</dt><dd><span class="libFactValue libFactValue--unknown">not packaged by AegisOne</span></dd></div>`;

  const severity = entry.trust.security.status === "COMPLETED"
    ? `<div class="libFact"><dt>Audit result</dt><dd><span class="libFactValue">${escapeHtml(String(entry.trust.security.highestSeverity ?? "INFO"))} · ${escapeHtml(String(entry.trust.security.findingCount ?? 0))} finding${entry.trust.security.findingCount === 1 ? "" : "s"}</span></dd></div>`
    : `<div class="libFact"><dt>Audit result</dt><dd><span class="libFactValue libFactValue--unknown">audit not run</span></dd></div>`;

  const correspondence = `<div class="libFact"><dt>Correspondence</dt><dd><span class="libFactValue">${escapeHtml(entry.trust.correspondence.status)}</span></dd></div>`;

  return `
    <li class="libRow" data-audited="${entry.states.audited.present}" data-verified="${entry.states.verified.present}" data-stored="${entry.states.storedOn0g.present}">
      ${art}
      <div class="libBody">
        <div class="libHead">
          <h3>${escapeHtml(entry.name)}</h3>
          ${by}
        </div>
        <p class="libDesc">${escapeHtml(entry.description)}</p>
        ${stateLedger(entry)}
        <dl class="libFacts">${commit}${digest}${severity}${correspondence}</dl>
        ${repositoryUrl ? `<p class="libUrl"><a href="${escapeHtml(repositoryUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(repositoryUrl)} ↗</a></p>` : ""}
        ${absenceNotes(entry)}
        ${publicationRows(entry)}
      </div>
      <div class="libActions">
        <a class="button libCta" href="/resources/${encodeURIComponent(entry.resourceId)}">Open Evidence Passport <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </li>`;
}

/** A filter chip. The count is real, computed from the same server-side facts the rows render; a
 * filter with nothing behind it is disabled rather than offering an empty view. */
function filterChip(id: string, label: string, count: number, active: boolean): string {
  const disabled = count === 0 && !active;
  return `<button type="button" class="pill filterChip${active ? " filterChip--active" : ""}" data-filter="${escapeHtml(id)}"${
    active ? ' aria-pressed="true"' : ' aria-pressed="false"'
  }${disabled ? " disabled" : ""}>${escapeHtml(label)} <span class="catCount">${count}</span></button>`;
}

export function renderVerifiedPageHtml(state: VerifiedPageState): string {
  const { entries } = state;

  const storedCount = entries.filter((entry) => entry.states.storedOn0g.present).length;
  const verifiedCount = entries.filter((entry) => entry.states.verified.present).length;
  const auditedCount = entries.filter((entry) => entry.states.audited.present).length;

  const list = entries.length === 0
    ? `<p class="emptyState">The catalog holds no resources on this deployment yet. This page lists what AegisOne actually has evidence for, so it stays empty rather than showing placeholder rows.</p>`
    : `<ol class="library" id="registry-list">${entries.map(entryRow).join("")}</ol>
       <p class="emptyState" id="registry-empty" hidden>No resource in this registry currently has that evidence. Filtering hides rows; it never creates evidence for the ones it leaves.</p>`;

  const demoLink = state.demoResourceId
    ? `<a class="button button--sm" href="/resources/${encodeURIComponent(state.demoResourceId)}?demo=1">See a real MATCH / MISMATCH pair <span class="arrow" aria-hidden="true">→</span></a>`
    : "";

  const body = `
    <div class="pageHead">
      <span class="eyebrow">03 / Verified</span>
      <h1 class="tight">Four facts per resource, <span class="mark">never merged</span>.</h1>
      <p>Each one is either established by evidence or shown as not established. There is no score, no rating and no badge that means "fine".</p>
    </div>

    <section class="stateKey" aria-label="What each state means">
      ${(["INDEXED", "AUDITED", "VERIFIED", "STORED_ON_0G"] as LibraryStateId[])
        .map(
          (id) => `<div class="stateKeyItem stateKeyItem--${escapeHtml(id)}">
            <span class="stateKeyLabel">${escapeHtml(libraryStateLabel(id))}</span>
            <span class="stateKeyMeaning">${escapeHtml(libraryStateMeaning(id))}</span>
          </div>`,
        )
        .join("")}
    </section>

    <div class="filterBar" id="registry-filters" role="group" aria-label="Filter the registry">
      <span class="eyebrow">Show</span>
      ${filterChip("all", "All", entries.length, true)}
      ${filterChip("audited", "Audited", auditedCount, false)}
      ${filterChip("verified", "Verified", verifiedCount, false)}
      ${filterChip("stored", "Stored on 0G", storedCount, false)}
    </div>

    ${list}

    ${
      storedCount === 0
        ? `<p class="passportWarning">No resource in this registry has an evidence bundle on 0G Storage yet. The publication path is built and tested, but a funded live run has not been performed, so this page shows zero rather than a number it cannot back.</p>`
        : ""
    }

    <section class="section">
      <div class="sectionHeadRow">
        <h2>What the strongest state still does not mean</h2>
        <span class="eyebrow">Limits, in the same place as the claims</span>
      </div>
      <ul class="findingList">
        <li><strong>MATCH does not mean safe.</strong> VERIFIED means reproduced bytes equalled distributed bytes. It is not a malware scan, a code review, or a statement about the publisher — a skill can correspond exactly to its source and still tell an agent to do something harmful.</li>
        <li><strong>MATCH requires a distinct distributed artifact.</strong> Packaging the same source twice and comparing it with itself is not correspondence evidence, so AegisOne refuses to call that a MATCH.</li>
        <li><strong>STORED ON 0G is a location, not a verdict.</strong> It says an evidence bundle is retrievable from 0G Storage, and nothing about whether the resource is good.</li>
        <li><strong>AUDITED with zero findings is not a clean bill of health.</strong> It is the absence of the specific patterns a deterministic analyser looks for.</li>
        <li><strong>Indexed is not verified.</strong> A resource appearing in discovery, or a repository simply existing, proves nothing about authorisation or bytes.</li>
        <li><strong>Missing evidence stays missing.</strong> An absent digest, storage root or audit is shown as absent. It is never inferred to complete a row.</li>
      </ul>
    </section>

    <section class="section">
      <div class="sectionHeadRow">
        <h2>Provenance and operations</h2>
        <span class="eyebrow">Historical, and deliberately not in the list</span>
      </div>
      <p class="sectionNote">Publication is an operator action, and that is on purpose: writing to 0G spends real funds from a signer that lives on one internal service and nowhere else. AegisOne has no user accounts, so there is no honest way to let an anonymous visitor spend it — publication requires an operator token, and no publish control is rendered on this page for anyone. ${escapeHtml(
        state.publicationConfigured
          ? "This deployment has an operator publication path configured."
          : "This deployment has no operator publication path configured, so no publication can be triggered here at all.",
      )}</p>

      <details class="disclose" id="recorded-runs">
        <summary>Recorded live runs — the completed M5 and M7 milestones</summary>
        <p class="note">These are the recorded results of AegisOne's <strong>completed M5 and M7 live runs</strong>: historical evidence from those milestones, not output of a publication made by a resource in the registry above. Every one resolves on a public 0G explorer.</p>
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
      </details>

      <div class="ctaRow" style="margin-top:16px">
        ${demoLink}
        <a class="button button--sm" href="/proof">The full 0G evidence ledger <span class="arrow" aria-hidden="true">→</span></a>
        <a class="button button--sm" href="${escapeHtml(GITHUB_URL)}/blob/main/hackathon/evidence.md" rel="noopener noreferrer" target="_blank">Structured evidence files ↗</a>
      </div>
    </section>
  `;

  return renderLayoutHtml({
    title: "Verified — AegisOne",
    activeNav: "verified",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="verified"></script>`,
  });
}
