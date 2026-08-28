import { loadAssembledResource } from "./api-v1.ts";
import { seedCookbookSkill, type CookbookSeedResult } from "./library-seed.ts";
import { seedCleanReviewSkill, seedMaliciousSyncSkill } from "./library-seed-fixtures.ts";
import { classifySkillCategory, browsableCategories } from "./ui/skill-category.mjs";
import type { CatalogStore } from "../../../packages/catalog-store/src/index.ts";
import type { CapabilityTrustEvidence } from "../../../packages/capability-model/src/index.ts";
import type { SkillFormatValidation } from "../../../packages/skill-audit/src/model.ts";

/**
 * Assembles the human **skill library** shown on `/` (ADR-016).
 *
 * ==========================================================================================
 * WHERE EVERY FIELD COMES FROM
 * ==========================================================================================
 * Library entries are built from real rows in the AegisOne catalog store, read back through the
 * exact same `loadAssembledResource` path that `GET /api/v1/resources/:resourceId` and the
 * `/resources/:id` Evidence Passport page use. There is no second evidence assembler, no
 * client-side reinterpretation, and no presentation-only trust field.
 *
 * The library is explicitly NOT the pinned ARD protocol fixtures in
 * `packages/discovery-ard/src/local-catalog.ts`. Those four fixtures ("Pull Request Reviewer",
 * "Weather Observer MCP Server", "Travel Planning A2A Agent", "Invoice Extraction API") exist only
 * so `POST /search` and `GET /.well-known/ai-catalog.json` are ARD-protocol-conformant; they stay
 * backing that protocol surface unchanged, and they are never presented to a human as library
 * content. `apps/web/test/skills-page.test.ts` asserts none of them can appear on `/`.
 *
 * ==========================================================================================
 * CATEGORY IS DISCOVERY METADATA — NOTE THE SHAPE
 * ==========================================================================================
 * `category` is a **sibling** of `trust` on `SkillLibraryEntry`, never a field inside it, and it is
 * computed here at read time by the zero-import classifier in `ui/skill-category.mjs`. It is never
 * persisted to a catalog row and never passed to `evaluateTrustPolicy`. It sits in the same
 * invariant class as a relevance score (AGENTS.md), and
 * `apps/web/test/category-non-escalation.test.ts` asserts a category can never reach trust or
 * policy.
 */

export interface SkillLibraryCategory {
  readonly id: string;
  readonly label: string;
  readonly basis: "curated" | "keyword" | "kind" | "none";
}

export interface SkillLibraryEntry {
  readonly resourceId: string;
  readonly name: string;
  readonly description: string;
  readonly kind: string;
  readonly discoveryStatus: string;
  /** Discovery/browse metadata only. Deliberately a sibling of `trust`, never nested inside it. */
  readonly category: SkillLibraryCategory;
  readonly publisherLabel: string | null;
  readonly versionLabel: string | null;
  readonly sourceRepositoryUrl: string | null;
  readonly sourceCommitSha: string | null;
  /** Canonical skill-package SHA-256, only where AegisOne genuinely packaged and hashed content. */
  readonly contentSha256: string | null;
  /** Real `validateSkillPackage` result, only where a package was genuinely validated. */
  readonly formatValidation: SkillFormatValidation | null;
  /** Verbatim from `assembleTrustEvidence` — the same object the Evidence Passport renders. */
  readonly trust: CapabilityTrustEvidence;
}

export interface SkillLibrary {
  readonly entries: readonly SkillLibraryEntry[];
  readonly counts: Readonly<Record<string, number>>;
  readonly categories: ReadonlyArray<{ id: string; label: string }>;
}

/** Derives a human author label from the *claimed* source repository URL. This is genuinely
 * available metadata (the GitHub owner segment of the declared repository), not an identity claim:
 * a declared repository is not proof the publisher authorised it (AGENTS.md). Returns `null` when
 * nothing real is available, so the UI can say "author unknown" rather than leaving a blank. */
function publisherFromRepositoryUrl(repositoryUrl: string | null): string | null {
  if (!repositoryUrl) return null;
  try {
    const url = new URL(repositoryUrl);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const owner = url.pathname.split("/").filter(Boolean)[0];
    return owner && owner.length > 0 ? owner : null;
  } catch {
    return null;
  }
}

/** Extra, genuinely-known facts a seed recorded that no catalog row column can hold. Only ever
 * populated for resources this repository actually packaged and validated itself. */
interface SeedFacts {
  readonly contentSha256: string;
  readonly formatValidation: SkillFormatValidation;
}

/**
 * Lazily-seeded, process-local library state. Mirrors the existing `ensureDemoSeeded` pattern in
 * `product.ts`: seeding happens on first access so a deployment that never serves `/` pays nothing,
 * and any seeding failure degrades to an empty library rather than crashing the app.
 */
export class SkillLibraryLoader {
  readonly #store: CatalogStore;
  #seedPromise: Promise<Map<string, SeedFacts>> | null = null;

  constructor(store: CatalogStore) {
    this.#store = store;
  }

  #ensureSeeded(): Promise<Map<string, SeedFacts>> {
    if (!this.#seedPromise) {
      this.#seedPromise = this.#seed().catch((error) => {
        this.#seedPromise = null;
        throw error;
      });
    }
    return this.#seedPromise;
  }

  async #seed(): Promise<Map<string, SeedFacts>> {
    const facts = new Map<string, SeedFacts>();
    const cookbook: CookbookSeedResult = await seedCookbookSkill(this.#store);
    facts.set(cookbook.resourceId, {
      contentSha256: cookbook.packageSha256,
      formatValidation: cookbook.formatValidation,
    });

    // Two real, well-formed Agent Skill fixtures (PR 2/4): a genuine CLEAN example and a genuine
    // CRITICAL detection example, both packaged/audited through the same unmodified production
    // functions and labelled as repository fixtures, never as a third-party discovery.
    const cleanReview = await seedCleanReviewSkill(this.#store);
    facts.set(cleanReview.resourceId, {
      contentSha256: cleanReview.packageSha256,
      formatValidation: cleanReview.formatValidation,
    });

    const maliciousSync = await seedMaliciousSyncSkill(this.#store);
    facts.set(maliciousSync.resourceId, {
      contentSha256: maliciousSync.packageSha256,
      formatValidation: maliciousSync.formatValidation,
    });

    return facts;
  }

  /** Loads the library. Returns an empty library (never a fabricated one) if seeding fails. */
  async load(): Promise<SkillLibrary> {
    let facts: Map<string, SeedFacts>;
    try {
      facts = await this.#ensureSeeded();
    } catch {
      facts = new Map();
    }

    const entries: SkillLibraryEntry[] = [];
    for (const [resourceId, seedFacts] of facts) {
      const assembled = await loadAssembledResource(this.#store, resourceId);
      if (!assembled) continue;

      const capability = assembled.capability;
      const sourceRepositoryUrl = capability.currentVersion?.source?.repositoryUrl ?? null;
      const category = classifySkillCategory({
        name: capability.name,
        description: capability.description,
        tags: [],
        kind: capability.kind,
        canonicalUrl: sourceRepositoryUrl,
      });

      entries.push({
        resourceId: assembled.resource.id,
        name: capability.name,
        description: capability.description,
        kind: capability.kind,
        discoveryStatus: capability.discovery.status,
        category: { id: category.id, label: category.label, basis: category.basis },
        publisherLabel: assembled.resource.publisherLabel ?? publisherFromRepositoryUrl(sourceRepositoryUrl),
        versionLabel: capability.currentVersion?.versionLabel ?? null,
        sourceRepositoryUrl,
        sourceCommitSha: capability.currentVersion?.source?.commitSha ?? null,
        contentSha256: seedFacts.contentSha256,
        formatValidation: seedFacts.formatValidation,
        // Verbatim. Never re-derived, re-thresholded or summarised into a score.
        trust: capability.trust,
      });
    }

    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.category.id] = (counts[entry.category.id] ?? 0) + 1;
    }

    return { entries, counts, categories: browsableCategories() };
  }
}
