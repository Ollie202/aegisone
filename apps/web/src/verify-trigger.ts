import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  authorizeVerificationTrigger,
  VerificationConcurrencyLimiter,
  VerificationNotAuthorizedError,
  type VerificationAuthorization,
} from "../../../packages/skill-verification-link/src/authorization.ts";
import { runSkillVerificationEnrichment } from "../../../packages/skill-verification-link/src/enrichment.ts";
import { buildCapabilityVerificationInput } from "../../../packages/skill-verification-link/src/verification-record.ts";
import { SourceAcquisitionError } from "../../../packages/skill-verification-link/src/source-acquisition.ts";
import { DistributionFetchError } from "../../../packages/skill-verification-link/src/distribution-fetch.ts";
import type {
  DistributionArtifactRequest,
  SkillEnrichmentResult,
  SourceAcquisitionRequest,
} from "../../../packages/skill-verification-link/src/model.ts";
import type { DistributionFetchOptions } from "../../../packages/skill-verification-link/src/distribution-fetch.ts";
import {
  validateNewCapabilityVerification,
  type CatalogStore,
  type ResourceVersion,
  type SourceClaim,
} from "../../../packages/catalog-store/src/index.ts";
import { FixedWindowRateLimiter } from "./rate-limit.ts";

/**
 * ============================================================================================
 * PACKAGE / ARTIFACT VERIFICATION — THE PUBLIC TRIGGER, AND WHY IT IS SHAPED LIKE THIS
 * ============================================================================================
 * `docs/decisions/018-audit-lab-and-package-verification-deferral.md` deliberately refused to
 * expose the fully-built M8.6 engine (`packages/skill-verification-link`) behind a public route,
 * because a verification is a real bounded `git clone` plus a real bounded artifact download —
 * genuine compute — and `docs/17-m8-security-boundaries.md` Threat M8-005 ("verification spend
 * abuse") forbids letting anonymous callers trigger expensive work at will. That deferral is
 * resolved here, not overridden: see `docs/decisions/020-package-artifact-verification-public-trigger.md`.
 *
 * The single structural change that makes an unauthenticated trigger defensible is this:
 *
 *   THE CALLER NEVER SUPPLIES A REPOSITORY, A COMMIT, OR A URL.
 *
 * The request body carries one field — `resourceId` — naming a resource that must ALREADY exist
 * in the AegisOne catalog with a recorded source claim (or a recorded version source pin). Every
 * network target is read back out of that stored row. The reachable attack surface is therefore
 * the curated catalog, not the open internet: there is no code path in this module that turns
 * caller-controlled text into a clone target or a fetch target, and a `resourceId` that is not in
 * the catalog is refused outright (never "fetched anyway").
 *
 * Layered on top of that, all of which must pass:
 *
 *   1. optional operator lock — if `AEGISONE_VERIFY_OPERATOR_TOKEN_SHA256` is configured, the
 *      route additionally demands that operator token (the same constant-time digest comparison
 *      `publish-trigger.ts` uses). Unset, the route is public *and still catalog-scoped*;
 *   2. a strict, independent fixed-window rate limit, far tighter than the Tier-1 paste-to-scan
 *      limiter, and shared with no other route — real compute must not draw on a free-read budget;
 *   3. the existing `VerificationConcurrencyLimiter`, so a burst cannot fan out into parallel
 *      clones;
 *   4. the existing brand-gated `VerificationAuthorization`. It is NOT weakened or bypassed: this
 *      module mints one from a per-process random token whose digest it holds, so
 *      `authorizeVerificationTrigger` genuinely runs its constant-time comparison and the branded
 *      value handed to `runSkillVerificationEnrichment` is a real one that no caller could forge.
 *      This is exactly the "the server holds the token internally and authorizes on a caller's
 *      behalf once they select an existing catalog resource/version" design ADR-018 named;
 *   5. every M8.6 SSRF / size / timeout / redirect / archive protection, unmodified — this module
 *      calls `runSkillVerificationEnrichment` and changes none of its options in production.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 *   - it does not compute MATCH/MISMATCH/DIVERGED. That verdict comes verbatim from the existing
 *     unmodified `verifySkillPackages` comparison inside the enrichment orchestrator;
 *   - it does not mutate any prior verdict. Every run appends a NEW `capability_verifications`
 *     row (docs/16 "every verification creates a new row");
 *   - it does not spend 0G, touch the signer, or call the worker. Publication stays the separate
 *     operator-gated action in `publish-trigger.ts`.
 */

/** Deliberately strict. A verification is a real clone + a real download; the Tier-1 paste-to-scan
 * limiter (60 per 10 minutes) is a cheap-read budget and must not be the model here. */
export const VERIFY_RATE_LIMIT = 3;
export const VERIFY_RATE_WINDOW_MS = 60 * 60 * 1000;
/** docs/17 "Recommended M8 starting limits": verification concurrency 1-2 on current budget. */
export const VERIFY_MAX_CONCURRENCY = 1;

export class VerifyTriggerError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "VerifyTriggerError";
    this.code = code;
    this.status = status;
  }
}

export interface VerifyTriggerConfig {
  /**
   * SHA-256 of `AEGISONE_VERIFY_OPERATOR_TOKEN`, when a deployment wants to lock the route down.
   * `null` (the default) leaves the route public — still catalog-scoped, still rate-limited, still
   * concurrency-capped. Unlike `publish-trigger.ts` this is not required for the route to exist,
   * because a verification spends no funds; it is a hardening lever, not the gate itself.
   */
  readonly operatorTokenSha256: string | null;
}

export function verifyTriggerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): VerifyTriggerConfig {
  const digest = env.AEGISONE_VERIFY_OPERATOR_TOKEN_SHA256?.trim() ?? null;
  return { operatorTokenSha256: digest && /^[0-9a-f]{64}$/i.test(digest) ? digest.toLowerCase() : null };
}

/**
 * The internal token this process authorizes with. Generated once per process from
 * `randomBytes(32)`, never logged, never read from configuration, and never accepted from a
 * request — its only purpose is to make the existing brand gate run for real rather than being
 * short-circuited. Nothing outside this module can obtain it, so nothing outside this module can
 * mint a `VerificationAuthorization`.
 */
const INTERNAL_TOKEN = randomBytes(32).toString("hex");
const INTERNAL_TOKEN_SHA256 = createHash("sha256").update(INTERNAL_TOKEN, "utf8").digest("hex");

function mintInternalAuthorization(subject: string): VerificationAuthorization {
  return authorizeVerificationTrigger(INTERNAL_TOKEN, INTERNAL_TOKEN_SHA256, subject);
}

/* ------------------------------------------------------------------------------------------ *
 * Source-acquisition availability
 * ------------------------------------------------------------------------------------------ */

/**
 * Exact-commit source acquisition shells out to `git` (`packages/skill-verification-link/src/
 * source-acquisition.ts`, the same mechanism `packages/runner-local` has used since M1). Some
 * serverless runtimes ship no `git` binary. Rather than let that surface as an opaque
 * `git_command_failed`, this probes once per process so the route can answer
 * `source_acquisition_unavailable` (503) and the UI can say so up front. It never degrades to a
 * different acquisition mechanism and never returns a partial result.
 */
let gitProbe: Promise<boolean> | null = null;

export function isSourceAcquisitionAvailable(): Promise<boolean> {
  if (!gitProbe) {
    gitProbe = new Promise<boolean>((resolvePromise) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise(value);
      };
      const timer = setTimeout(() => finish(false), 5_000);
      try {
        const child = spawn("git", ["--version"], { shell: false, stdio: "ignore" });
        child.once("error", () => finish(false));
        child.once("close", (code) => finish(code === 0));
      } catch {
        finish(false);
      }
    });
  }
  return gitProbe;
}

/** Test-only: forget the cached probe result. */
export function resetSourceAcquisitionProbe(): void {
  gitProbe = null;
}

/* ------------------------------------------------------------------------------------------ *
 * Catalog-scoped target resolution — the only place a network target is ever produced
 * ------------------------------------------------------------------------------------------ */

const GITHUB_FULL_NAME_RE = /^[\w.-]+\/[\w.-]+$/;
const GITHUB_HTTPS_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/i;

/**
 * Normalizes whatever the catalog recorded as "the repository" into the single
 * `https://github.com/<owner>/<repo>` form `inspectSourceOnly` accepts. A source claim stores a
 * GitHub full name (`owner/repo`); a `resource_versions` row stores the URL. Anything that is
 * neither is rejected here — and then rejected AGAIN by `assertRepositoryUrl` inside the
 * acquisition module, which is the enforcement that actually matters.
 */
function repositoryUrlFromCatalog(stored: string, allowLocalFixtureRepository: boolean): string | null {
  const trimmed = stored.trim();
  if (GITHUB_HTTPS_RE.test(trimmed)) return trimmed.replace(/\.git$/, "");
  if (GITHUB_FULL_NAME_RE.test(trimmed)) return `https://github.com/${trimmed}`;
  // Test-only, and only ever reachable when the caller ALSO passes the same flag down to
  // `inspectSourceOnly`, which is where the production GitHub-only rule is actually enforced.
  if (allowLocalFixtureRepository && trimmed.length > 0) return trimmed;
  return null;
}

function pickMostRecentActiveClaim(claims: readonly SourceClaim[]): SourceClaim | null {
  if (claims.length === 0) return null;
  return [...claims].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
}

export interface VerificationTarget {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly resourceVersionId: string;
  readonly sourceClaimId: string | null;
  readonly sourceAssuranceLevel: string;
  readonly source: SourceAcquisitionRequest;
  readonly distribution: DistributionArtifactRequest | null;
}

/**
 * Resolves the ONE resource the caller named into the exact source/distribution references the
 * engine will use. Every field comes from a stored catalog row; nothing is derived from the
 * request beyond the `resourceId` lookup key itself.
 *
 * Returns `null` when the resource is not verifiable (not in the catalog, no version, no recorded
 * source pin, or a stored repository/commit that is not a usable exact GitHub reference). The
 * caller turns `null` into a refusal — there is deliberately no fallback that fetches anyway.
 */
export async function resolveVerificationTarget(
  store: CatalogStore,
  resourceId: string,
  options: { readonly allowLocalFixtureRepository?: boolean } = {},
): Promise<VerificationTarget | null> {
  const resource = await store.getResourceById(resourceId);
  if (!resource) return null;

  const versions = await store.listVersionsByResource(resource.id);
  const version: ResourceVersion | null = versions[0] ?? null;
  if (!version) return null;

  const claims = await store.listActiveSourceClaimsByResourceVersion(version.id);
  const claim = pickMostRecentActiveClaim(claims);

  const storedRepository = claim?.sourceRepository ?? version.sourceRepository ?? null;
  const storedCommit = claim?.sourceCommitSha ?? version.sourceCommitSha ?? null;
  const storedSubdirectory = claim?.sourceSubdirectory ?? version.sourceSubdirectory ?? null;
  if (storedRepository === null || storedCommit === null) return null;

  const repositoryUrl = repositoryUrlFromCatalog(storedRepository, options.allowLocalFixtureRepository ?? false);
  if (repositoryUrl === null) return null;
  // AGENTS.md: immutable source revisions use exact commit SHAs, not mutable branches. A stored
  // ref that is not a full 40-hex commit is not verifiable, and is never resolved to a branch tip.
  if (!COMMIT_SHA_RE.test(storedCommit)) return null;

  const distributionUrl = claim?.distributionUrl ?? version.distributionUrl ?? null;
  const distributionSha256 = claim?.distributionSha256 ?? version.distributionSha256 ?? null;
  const distribution: DistributionArtifactRequest | null =
    distributionUrl !== null && distributionUrl.length > 0
      ? { url: distributionUrl, expectedSha256: distributionSha256 }
      : null;

  return {
    resourceId: resource.id,
    resourceName: resource.name,
    resourceVersionId: version.id,
    sourceClaimId: claim?.id ?? null,
    sourceAssuranceLevel: claim?.assuranceLevel ?? "NONE",
    source: { repositoryUrl, commitSha: storedCommit.toLowerCase(), subdirectory: storedSubdirectory },
    distribution,
  };
}

/** Read-only summary of what a target would do, for the Audit Lab selector. Renders the *shape* of
 * the pending work (source-only vs source + distinct distributed artifact) so the UI never promises
 * a MATCH it structurally cannot produce. */
export interface VerificationTargetSummary {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly repositoryUrl: string;
  readonly commitSha: string;
  readonly subdirectory: string | null;
  readonly hasDistinctDistributedArtifact: boolean;
  readonly sourceAssuranceLevel: string;
}

export async function listVerificationTargets(
  store: CatalogStore,
  resourceIds: readonly string[],
  options: { readonly allowLocalFixtureRepository?: boolean } = {},
): Promise<VerificationTargetSummary[]> {
  const summaries: VerificationTargetSummary[] = [];
  for (const resourceId of resourceIds) {
    let target: VerificationTarget | null = null;
    try {
      target = await resolveVerificationTarget(store, resourceId, options);
    } catch {
      target = null;
    }
    if (!target) continue;
    summaries.push({
      resourceId: target.resourceId,
      resourceName: target.resourceName,
      repositoryUrl: target.source.repositoryUrl,
      commitSha: target.source.commitSha,
      subdirectory: target.source.subdirectory,
      hasDistinctDistributedArtifact: target.distribution !== null,
      sourceAssuranceLevel: target.sourceAssuranceLevel,
    });
  }
  return summaries;
}

/* ------------------------------------------------------------------------------------------ *
 * The trigger
 * ------------------------------------------------------------------------------------------ */

export interface VerifyTriggerRequest {
  readonly resourceId: string;
  readonly operatorToken: string | null;
  readonly rateLimitKey: string;
}

export interface VerifyTriggerDependencies {
  readonly config: VerifyTriggerConfig;
  readonly limiter: FixedWindowRateLimiter;
  readonly concurrency: VerificationConcurrencyLimiter;
  /**
   * Test-only escape hatches, forwarded verbatim to `runSkillVerificationEnrichment`. Never set
   * from production code and never derived from environment/configuration a caller could
   * influence: with these absent (the default) the GitHub-only repository rule and the full
   * SSRF/private-address block are in force exactly as M8.6 wrote them.
   */
  readonly allowLocalFixtureRepository?: boolean;
  readonly distributionFetchOptions?: DistributionFetchOptions;
  /** Test-only override of the engine call itself, so the route's gates are exercisable without
   * spawning `git`. Production always uses `runSkillVerificationEnrichment`. */
  readonly runEnrichment?: (input: {
    readonly authorization: VerificationAuthorization;
    readonly source: SourceAcquisitionRequest;
    readonly distribution: DistributionArtifactRequest | null;
    readonly allowLocalFixtureRepository?: boolean;
    readonly distributionFetchOptions?: DistributionFetchOptions;
  }) => Promise<SkillEnrichmentResult>;
  /** Test-only override of the `git` availability probe. */
  readonly sourceAcquisitionAvailable?: () => Promise<boolean>;
}

export interface VerifyTriggerResult {
  readonly resourceId: string;
  readonly resourceVersionId: string;
  readonly capabilityVerificationId: string;
  /** Exactly what was acquired and compared, so a reader can check the claim rather than take it. */
  readonly inspected: {
    readonly repositoryUrl: string;
    readonly exactCommitSha: string;
    readonly subdirectory: string | null;
    readonly sourceSnapshotSha256: string | null;
  };
  readonly sourceInspection: SkillEnrichmentResult["sourceInspection"];
  readonly correspondence: SkillEnrichmentResult["correspondence"];
  readonly security: {
    readonly status: SkillEnrichmentResult["security"]["status"];
    readonly analysisKind: SkillEnrichmentResult["security"]["analysisKind"];
    readonly highestSeverity: SkillEnrichmentResult["security"]["highestSeverity"];
    readonly findingCount: SkillEnrichmentResult["security"]["findingCount"];
    readonly auditTarget: SkillEnrichmentResult["security"]["auditTarget"];
  };
  /** True only when a distinct distributed artifact was genuinely fetched and compared. When
   * false, `correspondence.status` is structurally `NOT_EVALUATED`. */
  readonly comparedDistinctDistributedArtifact: boolean;
}

/**
 * Authorizes, rate-limits, resolves a catalog-scoped target, runs the unmodified M8.6 engine, and
 * appends the result as a new `capability_verifications` row.
 */
export async function runVerifyTrigger(
  store: CatalogStore,
  request: VerifyTriggerRequest,
  dependencies: VerifyTriggerDependencies,
): Promise<VerifyTriggerResult> {
  const { config, limiter, concurrency } = dependencies;

  // 1. Optional operator lock. Checked BEFORE the rate limiter (so unauthorized traffic cannot
  //    consume an operator's budget) and before any store read (so it cannot be an existence
  //    oracle), exactly as `publish-trigger.ts` orders its own gates.
  if (config.operatorTokenSha256 !== null) {
    try {
      authorizeVerificationTrigger(request.operatorToken, config.operatorTokenSha256, "verify-package");
    } catch (error) {
      if (error instanceof VerificationNotAuthorizedError) {
        throw new VerifyTriggerError("unauthorized", "package verification requires an operator token on this deployment", 401);
      }
      throw error;
    }
  }

  // 2. Strict independent rate limit.
  if (!limiter.consume(request.rateLimitKey)) {
    throw new VerifyTriggerError(
      "rate_limited",
      `package verification is limited to ${VERIFY_RATE_LIMIT} runs per hour per client`,
      429,
    );
  }

  // 3. Catalog membership. A target that is not in the catalog is refused here, before any
  //    network or filesystem work — there is no branch below that fetches it anyway.
  const target = await resolveVerificationTarget(store, request.resourceId, {
    allowLocalFixtureRepository: dependencies.allowLocalFixtureRepository,
  });
  if (target === null) {
    throw new VerifyTriggerError(
      "no_verifiable_target",
      "this resource is not in the AegisOne catalog with a recorded exact source revision, so there is nothing to independently reproduce",
      409,
    );
  }

  const probe = dependencies.sourceAcquisitionAvailable ?? isSourceAcquisitionAvailable;
  if (!(await probe())) {
    throw new VerifyTriggerError(
      "source_acquisition_unavailable",
      "this deployment cannot perform exact-commit source acquisition (no git available), so no independent reproduction is possible here",
      503,
    );
  }

  // 4. Brand-gated authorization, minted internally now that a real catalog target is in hand.
  const authorization = mintInternalAuthorization(`verify-package:${target.resourceVersionId}`);

  // 5. Concurrency cap around the expensive work only.
  const runEnrichment = dependencies.runEnrichment ?? runSkillVerificationEnrichment;
  let result: SkillEnrichmentResult;
  try {
    result = await concurrency.run(async () =>
      runEnrichment({
        authorization,
        source: target.source,
        distribution: target.distribution,
        allowLocalFixtureRepository: dependencies.allowLocalFixtureRepository,
        distributionFetchOptions: dependencies.distributionFetchOptions,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("verification_concurrency_limit_exceeded")) {
      throw new VerifyTriggerError("verification_in_progress", "another verification is already running; try again shortly", 429);
    }
    if (error instanceof SourceAcquisitionError) {
      throw new VerifyTriggerError(`source_${error.code}`, error.message, 502);
    }
    if (error instanceof DistributionFetchError) {
      throw new VerifyTriggerError(error.code, error.message, 502);
    }
    throw error;
  }

  /**
   * Defence in depth against the invariant that matters most here: a correspondence verdict may
   * only exist when a DISTINCT distributed artifact was genuinely fetched and compared. The
   * engine already guarantees this structurally (`enrichment.ts`: `verifySkillPackages` is only
   * reachable from the branch that fetched a distribution), so this can only ever fire if that
   * structure is broken in a future edit — at which point refusing is the correct behaviour.
   */
  const compared = target.distribution !== null;
  if (!compared && result.correspondence.status !== "NOT_EVALUATED") {
    throw new VerifyTriggerError(
      "correspondence_without_distribution",
      "refusing to record a correspondence verdict for a source-only verification",
      500,
    );
  }

  const row = buildCapabilityVerificationInput({
    resourceVersionId: target.resourceVersionId,
    sourceClaimId: target.sourceClaimId,
    verificationJobId: null,
    result,
    // Canonical evidence (0G Storage/registry pointers) is NOT produced here. Publishing evidence
    // is the separate, operator-gated, funded action in `publish-trigger.ts`.
    canonicalEvidence: null,
  });

  // The same structural sanity check `createCapabilityVerification` enforces, run first so a bad
  // row is a clean 500 with a named reason rather than an opaque store error.
  const issues = validateNewCapabilityVerification(row);
  if (issues.length > 0) {
    throw new VerifyTriggerError(
      "invalid_verification_row",
      `refusing to persist a verification row that fails its own invariants: ${issues.map((issue) => issue.code).join(", ")}`,
      500,
    );
  }

  const stored = await store.createCapabilityVerification(row);

  return {
    resourceId: target.resourceId,
    resourceVersionId: target.resourceVersionId,
    capabilityVerificationId: stored.id,
    inspected: {
      repositoryUrl: target.source.repositoryUrl,
      exactCommitSha: result.sourceInspection.exactCommitSha ?? target.source.commitSha,
      subdirectory: target.source.subdirectory,
      sourceSnapshotSha256: result.sourceInspection.sourceSnapshotSha256,
    },
    sourceInspection: result.sourceInspection,
    correspondence: result.correspondence,
    security: {
      status: result.security.status,
      analysisKind: result.security.analysisKind,
      highestSeverity: result.security.highestSeverity,
      findingCount: result.security.findingCount,
      auditTarget: result.security.auditTarget,
    },
    comparedDistinctDistributedArtifact: compared,
  };
}
