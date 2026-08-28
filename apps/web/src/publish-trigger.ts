import {
  authorizeVerificationTrigger,
  VerificationNotAuthorizedError,
  type VerificationAuthorization,
} from "../../../packages/skill-verification-link/src/authorization.ts";
import type { CatalogStore, CapabilityVerification } from "../../../packages/catalog-store/src/index.ts";
import { FixedWindowRateLimiter } from "./rate-limit.ts";
import { PUBLICATION_NETWORK } from "./publication-network.ts";

/**
 * ============================================================================================
 * PUBLISHING IS AN OPERATOR ACTION, NOT AN END-USER ACTION. THIS IS DELIBERATE.
 * ============================================================================================
 * A 0G publication spends real funds from the worker's signer. AGENTS.md is unambiguous — "no
 * public endpoint may expose the 0G signer or automatically spend 0G", and "public
 * discovery/read/policy routes must never implicitly trigger uncontrolled/funded 0G work" — and
 * docs/17 Threat M8-005 names anonymous verification-spend abuse directly.
 *
 * AegisOne has no user accounts and no sessions. There is therefore no way to attribute or budget
 * a spend to an end user, which means there is no honest way to make an anonymous "publish this to
 * 0G" button safe: any per-IP limit is trivially bypassed and every request would spend the
 * project's own funds. Rather than ship a rate-limited anonymous spend endpoint and call it
 * controlled, this route requires an operator token. That is a real constraint being stated, not
 * a feature being marketed around — the Verified Library says plainly that publication is an
 * operator action and shows resources that have not been published as exactly that.
 *
 * Defence in depth, all of which must pass:
 *   1. an operator token, constant-time compared, minting a branded `VerificationAuthorization`
 *      that cannot be forged by hand (the brand symbol is not exported by its module);
 *   2. an independent, strict rate limit distinct from every other route in the app;
 *   3. an in-process concurrency cap of one, so a burst cannot fan out into parallel spends;
 *   4. the worker's own separate internal token, which this app must also hold.
 *
 * The app never holds the 0G signer. It asks the worker to publish; the worker decides.
 */

/** Deliberately strict: publication is a rare, funded, operator-initiated act. */
export const PUBLISH_RATE_LIMIT = 5;
export const PUBLISH_RATE_WINDOW_MS = 60 * 60 * 1000;

export class PublishTriggerError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PublishTriggerError";
    this.code = code;
    this.status = status;
  }
}

export interface WorkerPublishResponse {
  readonly ok: true;
  readonly resourceVersionId: string;
  readonly canonicalEvidenceSha256: string;
  readonly storage: { readonly network: string; readonly chainId: number; readonly root: string; readonly transaction: string };
  readonly registry: { readonly contract: string; readonly recordId: string; readonly transaction: string } | null;
  readonly registryError: string | null;
  readonly bundleByteLength: number;
}

export interface PublishTriggerConfig {
  /** SHA-256 of `AEGISONE_PUBLISH_OPERATOR_TOKEN`. Absent disables the route entirely. */
  readonly operatorTokenSha256: string | null;
  /** Base URL of `aegisone-worker`, e.g. `https://aegisone-worker.up.railway.app`. */
  readonly workerBaseUrl: string | null;
  /** The worker's own internal token. Held by the app so it can call the worker; never the signer. */
  readonly workerInternalToken: string | null;
}

export function publishTriggerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PublishTriggerConfig {
  const digest = env.AEGISONE_PUBLISH_OPERATOR_TOKEN_SHA256?.trim() ?? null;
  return {
    operatorTokenSha256: digest && /^[0-9a-f]{64}$/i.test(digest) ? digest.toLowerCase() : null,
    workerBaseUrl: env.AEGISONE_WORKER_URL?.trim() || null,
    workerInternalToken: env.AEGISONE_WORKER_INTERNAL_TOKEN?.trim() || null,
  };
}

/** True only when every piece of configuration the route needs is present. Missing any one of them
 * leaves the route absent (404), never present-but-unauthenticated. */
export function publishTriggerEnabled(config: PublishTriggerConfig): boolean {
  return config.operatorTokenSha256 !== null && config.workerBaseUrl !== null && config.workerInternalToken !== null;
}

export interface PublishTriggerDependencies {
  readonly config: PublishTriggerConfig;
  readonly limiter: FixedWindowRateLimiter;
  /** Injected so tests drive the whole trigger without a worker or a network. */
  readonly callWorker: (body: unknown, config: PublishTriggerConfig) => Promise<WorkerPublishResponse>;
  /**
   * Resolves the exact artifact bytes a publication must carry, and the audit report that goes
   * with them. Returning `null` bytes makes `runPublishTrigger` refuse the publication rather than
   * upload a bundle whose package field does not contain the real artifact — publishing a
   * placeholder would be fabricating evidence.
   */
  readonly loadPackageBytes: (resourceId: string) => Promise<Uint8Array | null>;
  readonly loadAuditReport: (resourceId: string) => Promise<unknown>;
}

/** The real worker call. Times out rather than hanging a request indefinitely. */
export async function callWorkerOverHttp(body: unknown, config: PublishTriggerConfig): Promise<WorkerPublishResponse> {
  if (config.workerBaseUrl === null || config.workerInternalToken === null) {
    throw new PublishTriggerError("publication_unavailable", "the worker publication endpoint is not configured", 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(new URL("/internal/publish-evidence", config.workerBaseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.workerInternalToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new PublishTriggerError("worker_error", "the worker returned a non-JSON response", 502);
    }
    if (!response.ok) {
      const detail = typeof parsed === "object" && parsed !== null && "error" in parsed ? String((parsed as Record<string, unknown>).error) : "unknown";
      throw new PublishTriggerError("worker_error", `the worker rejected the publication (${detail})`, 502);
    }
    return parsed as WorkerPublishResponse;
  } catch (error) {
    if (error instanceof PublishTriggerError) throw error;
    throw new PublishTriggerError("worker_unreachable", "the worker could not be reached", 502);
  } finally {
    clearTimeout(timeout);
  }
}

/** In-process cap of one concurrent publication. A funded action must never fan out. */
let inFlight = 0;

export interface PublishTriggerRequest {
  readonly resourceId: string;
  readonly operatorToken: string | null;
  readonly rateLimitKey: string;
}

export interface PublishTriggerResult {
  readonly resourceId: string;
  readonly resourceVersionId: string;
  readonly storage: WorkerPublishResponse["storage"];
  readonly registry: WorkerPublishResponse["registry"];
  readonly registryError: string | null;
  readonly canonicalEvidenceSha256: string;
}

/**
 * Authorizes, rate-limits, asks the worker to publish, and persists the result as a NEW
 * `capability_verifications` row.
 *
 * A publication never mutates a prior row: AegisOne's verification history is append-only
 * (docs/16 "every verification creates a new row; nothing here mutates a prior canonical verdict"),
 * so a publication records the evidence that existed at that moment alongside where it now lives.
 */
export async function runPublishTrigger(
  store: CatalogStore,
  request: PublishTriggerRequest,
  dependencies: PublishTriggerDependencies,
): Promise<PublishTriggerResult> {
  const { config, limiter, callWorker, loadPackageBytes, loadAuditReport } = dependencies;

  if (!publishTriggerEnabled(config)) {
    throw new PublishTriggerError("publication_unavailable", "evidence publication is not configured on this deployment", 503);
  }

  // Authorization BEFORE the rate limiter, so unauthorized traffic cannot consume an operator's
  // budget, and before any store read, so it cannot be used as an existence oracle.
  let authorization: VerificationAuthorization;
  try {
    authorization = authorizeVerificationTrigger(request.operatorToken, config.operatorTokenSha256!, "publish-evidence");
  } catch (error) {
    if (error instanceof VerificationNotAuthorizedError) {
      throw new PublishTriggerError("unauthorized", "evidence publication requires an operator token", 401);
    }
    throw error;
  }
  void authorization; // Held to prove the gate ran; carries no privilege of its own.

  if (!limiter.consume(request.rateLimitKey)) {
    throw new PublishTriggerError("rate_limited", "publication rate limit exceeded", 429);
  }

  if (inFlight >= 1) {
    throw new PublishTriggerError("publication_in_progress", "another publication is already in progress", 429);
  }

  inFlight += 1;
  try {
    const resource = await store.getResourceById(request.resourceId);
    if (!resource) throw new PublishTriggerError("resource_not_found", "no such resource", 404);

    const versions = await store.listVersionsByResource(resource.id);
    const version = versions[0] ?? null;
    if (!version) throw new PublishTriggerError("no_version", "this resource has no version to publish evidence for", 409);

    const latest = await store.getLatestCapabilityVerification(version.id);
    if (!latest) {
      throw new PublishTriggerError("no_evidence", "this resource has no verification evidence to publish", 409);
    }

    const packageBytes = await loadPackageBytes(request.resourceId);
    if (packageBytes === null) {
      // Publishing requires the exact bytes the evidence describes. Without them there is nothing
      // honest to store, so this refuses rather than publishing a bundle with a placeholder.
      throw new PublishTriggerError("package_unavailable", "the exact artifact bytes for this resource are not available to publish", 409);
    }

    const workerResponse = await callWorker(
      {
        resourceVersionId: version.id,
        artifactKind: "agent-skill",
        facts: {
          sourceInspectionStatus: latest.sourceInspectionStatus,
          sourceSnapshotSha256: latest.sourceSnapshotSha256,
          correspondenceStatus: latest.correspondenceStatus,
          publisherSha256: latest.publisherSha256,
          reproducedSha256: latest.reproducedSha256,
          securityStatus: latest.securityStatus,
          securityHighestSeverity: latest.securityHighestSeverity,
          securityFindingCount: latest.securityFindingCount,
          verifiedAt: latest.verifiedAt ?? latest.createdAt,
        },
        packageBase64: Buffer.from(packageBytes).toString("base64"),
        auditReport: await loadAuditReport(request.resourceId),
      },
      config,
    );

    // Refuse to persist evidence that claims a different network than this app validates against.
    if (workerResponse.storage.chainId !== PUBLICATION_NETWORK.chainId) {
      throw new PublishTriggerError("network_mismatch", "the worker published to an unexpected network", 502);
    }

    const row: Omit<CapabilityVerification, "id" | "createdAt"> = {
      resourceVersionId: version.id,
      sourceClaimId: latest.sourceClaimId,
      verificationJobId: latest.verificationJobId,
      artifactKind: "agent-skill",
      sourceInspectionStatus: latest.sourceInspectionStatus,
      sourceSnapshotSha256: latest.sourceSnapshotSha256,
      correspondenceStatus: latest.correspondenceStatus,
      publisherSha256: latest.publisherSha256,
      reproducedSha256: latest.reproducedSha256,
      securityStatus: latest.securityStatus,
      securityHighestSeverity: latest.securityHighestSeverity,
      securityFindingCount: latest.securityFindingCount,
      canonicalEvidenceSha256: workerResponse.canonicalEvidenceSha256,
      storageRoot: workerResponse.storage.root,
      storageTransaction: workerResponse.storage.transaction,
      registryContract: workerResponse.registry?.contract ?? null,
      registryRecordId: workerResponse.registry?.recordId ?? null,
      registryTransaction: workerResponse.registry?.transaction ?? null,
      verifiedAt: latest.verifiedAt ?? latest.createdAt,
    };
    await store.createCapabilityVerification(row);

    return {
      resourceId: resource.id,
      resourceVersionId: version.id,
      storage: workerResponse.storage,
      registry: workerResponse.registry,
      registryError: workerResponse.registryError,
      canonicalEvidenceSha256: workerResponse.canonicalEvidenceSha256,
    };
  } finally {
    inFlight -= 1;
  }
}

/** Test-only reset of the in-process concurrency counter. */
export function resetPublishConcurrency(): void {
  inFlight = 0;
}
