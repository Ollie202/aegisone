// Isomorphic skill-library rendering (ADR-016). See escape.mjs for why these are plain `.mjs`.
//
// This renders the **human skill library**, which is a different thing from two neighbours it is
// easy to confuse it with:
//
//   - It is NOT the pinned ARD protocol fixtures (`packages/discovery-ard/src/local-catalog.ts`).
//     Those four fixtures exist to make `POST /search` and `/.well-known/ai-catalog.json`
//     protocol-conformant and are never presented to a human as a real library entry.
//   - It is NOT a search result list (`result-card.mjs`). A library entry is a resource AegisOne's
//     own catalog actually holds a row for, so it can always link to a real Evidence Passport.
//
// Every dimension below is read verbatim from the backend's assembled `CapabilityResource.trust`
// (apps/web/src/api-v1.ts `assembleTrustEvidence`). Nothing here derives, thresholds, upgrades or
// collapses a verdict, and there is deliberately no aggregate/overall score anywhere: the whole
// point of the layout is that the five independent dimensions stay five independent dimensions.
//
// Unknown is rendered as the word "unknown", never as a blank cell — a blank would read as "fine".

import { escapeHtml, safeHttpUrl, shortHash } from "./escape.mjs";
import {
  discoveryBadge,
  sourceAssuranceBadge,
  correspondenceBadge,
  securityBadge,
  canonicalEvidenceBadge,
  zeroGStorageBadge,
  skillFormatBadge,
} from "./badges.mjs";
import { categoryArtSvg } from "./category-art.mjs";
import { CATEGORY_LABELS } from "./skill-category.mjs";

/** Why this resource carries the category it carries — surfaced so the classification is auditable
 * in the UI rather than looking like an opaque tag someone typed. */
const BASIS_NOTE = {
  curated: "Category chosen editorially for a deliberately seeded library resource.",
  keyword: "Category derived by the deterministic keyword classifier (discovery metadata only).",
  kind: "Category follows definitionally from the resource kind.",
  none: "No category keyword matched. Left explicitly uncategorized rather than guessed.",
};

function factRow(label, value, { mono = false } = {}) {
  const known = typeof value === "string" && value.trim() !== "";
  const valueHtml = known
    ? `<span class="libFactValue${mono ? " libFactValue--mono" : ""}"${mono ? ` title="${escapeHtml(value)}"` : ""}>${escapeHtml(mono ? shortHash(value, 8) : value)}</span>`
    : `<span class="libFactValue libFactValue--unknown">unknown</span>`;
  return `<div class="libFact"><dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
}

/**
 * One library entry. `featured` gives the lead entry a larger, flat-colour-field treatment so the
 * list has a single dominant element instead of N identical rectangles (design skill §16 Design
 * Restraint Rules, §17 Anti-Patterns "endless three-column feature cards").
 */
export function skillEntryHtml(entry, index, options = {}) {
  const featured = options.featured === true;
  const trust = entry?.trust ?? null;
  const category = entry?.category ?? { id: "uncategorized", label: CATEGORY_LABELS.uncategorized, basis: "none" };
  const categoryLabel = CATEGORY_LABELS[category.id] ?? category.label ?? CATEGORY_LABELS.uncategorized;
  const ordinal = String(index + 1).padStart(2, "0");

  const href = entry?.resourceId ? `/resources/${encodeURIComponent(entry.resourceId)}` : null;
  const name = escapeHtml(entry?.name || "(untitled resource)");
  const title = href ? `<a href="${href}">${name}</a>` : name;

  const dimensions = trust
    ? `
      ${discoveryBadge(entry?.discoveryStatus ?? "INDEXED")}
      ${skillFormatBadge(entry?.formatValidation ?? null)}
      ${securityBadge(trust.security?.status, trust.security?.highestSeverity, trust.security?.findingCount)}
      ${correspondenceBadge(trust.correspondence?.status)}
      ${sourceAssuranceBadge(trust.sourceAssurance?.level)}
      ${canonicalEvidenceBadge(trust.canonicalEvidence?.status, trust.canonicalEvidence?.verifiedAt)}
      ${zeroGStorageBadge(trust.canonicalEvidence?.storageRoot)}`
    : `${discoveryBadge(entry?.discoveryStatus ?? "INDEXED")}<span class="cardNote">Discovery only — AegisOne holds no evidence for this resource yet.</span>`;

  const facts = `
    <dl class="libFacts">
      ${factRow("Version", entry?.versionLabel ?? "")}
      ${factRow("Content hash (SHA-256)", entry?.contentSha256 ?? "", { mono: true })}
      ${factRow("Exact source commit", entry?.sourceCommitSha ?? "", { mono: true })}
    </dl>`;

  const repoUrl = entry?.sourceRepositoryUrl ?? null;
  const repoLine = repoUrl
    ? `<div class="libUrl"><a href="${safeHttpUrl(repoUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(repoUrl)}</a></div>`
    : "";

  const passportLink = href
    ? `<a class="button libCta" href="${href}">Evidence passport <span class="arrow" aria-hidden="true">→</span></a>`
    : `<span class="libCta libCta--none">No catalog row — no passport to open.</span>`;

  const publisher = entry?.publisherLabel
    ? `<span class="libBy">by ${escapeHtml(entry.publisherLabel)}</span>`
    : `<span class="libBy libBy--unknown">author unknown</span>`;

  return `<li class="libRow${featured ? " libRow--feature" : ""}" data-category="${escapeHtml(category.id)}">
    <span class="libIndex" aria-hidden="true">${ordinal}</span>
    <span class="libArt${featured ? " libArt--lg" : ""}">${categoryArtSvg(category.id)}</span>
    <div class="libBody">
      <div class="libHead">
        <h3>${title}</h3>
        <span class="kindTag">${escapeHtml(entry?.kind ?? "resource")}</span>
      </div>
      <p class="libDesc">${escapeHtml(entry?.description || "No description provided.")}</p>
      <div class="libMeta">
        <span class="pill pill--cat" title="${escapeHtml(BASIS_NOTE[category.basis] ?? BASIS_NOTE.none)}">${escapeHtml(categoryLabel)}</span>
        ${publisher}
      </div>
      <div class="libDims">${dimensions}</div>
      ${facts}
      ${repoLine}
      <div class="libActions">${passportLink}</div>
    </div>
  </li>`;
}

/** The library itself. `entries` are already ordered by the server; index 0 is the featured lead. */
export function skillLibraryHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return `<p class="emptyState">The AegisOne catalog holds no library resources on this deployment yet. Nothing is invented to fill the space.</p>`;
  }
  const rows = entries.map((entry, index) => skillEntryHtml(entry, index, { featured: index === 0 })).join("");
  return `<ol class="library">${rows}</ol>`;
}

/**
 * The browsable category rail. Counts are real counts of real catalog rows; a category with no
 * entries is rendered disabled rather than hidden, so the taxonomy is honest about being sparse
 * instead of implying the library is fuller than it is.
 */
export function categoryFilterHtml(categories, counts, activeCategory) {
  const all = Object.values(counts ?? {}).reduce((total, value) => total + value, 0);
  const allActive = !activeCategory ? ' aria-current="true" class="pill exampleChip catChip catChip--active"' : ' class="pill exampleChip catChip"';
  const items = [`<button type="button"${allActive} data-category="">All <span class="catCount">${all}</span></button>`];
  for (const category of categories) {
    const count = counts?.[category.id] ?? 0;
    const isActive = activeCategory === category.id;
    const classes = `pill exampleChip catChip${isActive ? " catChip--active" : ""}${count === 0 ? " catChip--empty" : ""}`;
    const disabled = count === 0 ? " disabled" : "";
    const current = isActive ? ' aria-current="true"' : "";
    items.push(
      `<button type="button" class="${classes}"${disabled}${current} data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)} <span class="catCount">${count}</span></button>`,
    );
  }
  return `<div class="catRail" role="group" aria-label="Browse skills by category">${items.join("")}</div>`;
}
