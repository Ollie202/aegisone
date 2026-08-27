import type { IncomingMessage, ServerResponse } from "node:http";
import {
  evaluateTrustPolicy,
  validateCapabilityResource,
  type CanonicalEvidencePointer,
  type CapabilityResource,
  type CapabilityTrustEvidence,
  type CapabilityVersion,
  type DistributionCorrespondenceEvidence,
  type SecurityAssessmentEvidence,
  type SecuritySeverity,
  type SourceAssuranceEvidence,
  type SourceAssuranceLevel,
  type SourceInspectionEvidence,
  type TrustPolicy,
} from "../../../packages/capability-model/src/index.ts";
import {
  catalogRecordToCapabilityResource,
  validateNewCapabilityVerification,
  type AgenticResource,
  type CapabilityVerification,
  type CatalogStore,
  type ResourceVersion,
  type SourceClaim,
} from "../../../packages/catalog-store/src/index.ts";
import { computeSourceClaimDigest } from "../../../packages/source-auth-github/src/index.ts";
import { performPastedSkillScan, ScanServiceError, type ScanApiResponse, type ScanServiceDependencies } from "./scan-service.ts";

/**
 * M8.7: `GET /api/v1/resources/:resourceId`, `GET /api/v1/resources/:resourceId/versions/:versionId`,
 * `GET /api/v1/resources/:resourceId/evidence`, `POST /api/v1/policy/evaluate`
 * (docs/15-m8-api-inventory.md section 13 "Stable read API", docs/20-m8-api-contract.md).
 *
 * This module is a *read/serialization* layer only. It does not compute MATCH/MISMATCH, does not
 * authenticate a source claim, and does not call an LLM, a discovery provider, GitHub OAuth,
 * Supabase to invent missing evidence, a blockchain, or the worker/build system — it only reads
 * already-persisted M8.1-M8.6 evidence out of `CatalogStore` and serializes it through an explicit
 * shape, never a raw DB row (docs/17-m8-security-boundaries.md Threat M8-020).
 *
 * `assembleTrustEvidence` is the single place strong verdicts (`REPOSITORY_AUTHENTICATED`,
 * `SIGNED_RELEASE`, `MATCH`) are allowed to reach an HTTP response: it re-runs the same
 * digest-recompute / structural sanity checks M8.5 (`computeSourceClaimDigest`) and M8.6
 * (`validateNewCapabilityVerification`) already established, and fails closed — to `NONE`
 * assurance / empty verification evidence, never to a downgraded-but-still-trusted verdict — the
 * moment a stored row no longer matches its own canonical/structural invariants (Supabase is
 * mutable application memory, not proof authority; docs/17 Threat M8-012).
 */

const SCHEMA_VERSION = "1" as const;
const MAX_POLICY_REQUEST_BODY_BYTES = 32 * 1024;

const SOURCE_ASSURANCE_LEVELS = new Set<SourceAssuranceLevel>(["NONE", "DECLARED", "REPOSITORY_AUTHENTICATED", "SIGNED_RELEASE"]);
const SECURITY_SEVERITIES = new Set<SecuritySeverity>(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export class ApiV1Error extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiV1Error";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

export function requireJsonContentType(request: IncomingMessage): void {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ApiV1Error("unsupported_media_type", "Content-Type must be application/json", 415);
  }
}

export async function readJsonBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0) throw new ApiV1Error("invalid_request", "Invalid Content-Length header");
    if (declared > limit) throw new ApiV1Error("request_too_large", `Request body exceeds the ${limit}-byte limit`, 413);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new ApiV1Error("request_too_large", `Request body exceeds the ${limit}-byte limit`, 413);
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiV1Error("invalid_request", "Request body was not valid JSON");
  }
}

function emptyTrust(): CapabilityTrustEvidence {
  return {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  };
}

export interface EvidenceIntegrityFlags {
  readonly present: boolean;
  readonly integrityCheckPassed: boolean;
}

export interface AssembledIntegrity {
  readonly sourceAssurance: EvidenceIntegrityFlags;
  readonly canonicalVerification: EvidenceIntegrityFlags;
}

function pickMostRecentActiveClaim(claims: readonly SourceClaim[]): SourceClaim | null {
  if (claims.length === 0) return null;
  return [...claims].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
}

/** Recomputes the source-claim digest (the same check `GET /api/v1/source-claims/:claimId`
 * already performs) before an active claim's assurance level is allowed to appear in a public
 * response. A claim whose stored row no longer matches its own canonical JSON is treated as
 * unavailable evidence (`NONE`), never as a downgraded-but-trusted level. */
function assembleSourceAssurance(claims: readonly SourceClaim[]): { evidence: SourceAssuranceEvidence; integrity: EvidenceIntegrityFlags } {
  const claim = pickMostRecentActiveClaim(claims);
  if (!claim) return { evidence: { level: "NONE", evidenceRefs: [] }, integrity: { present: false, integrityCheckPassed: false } };

  const recomputedDigest = computeSourceClaimDigest(claim.canonicalClaimJson);
  const digestMatches = recomputedDigest === claim.claimDigestSha256;
  if (!digestMatches) return { evidence: { level: "NONE", evidenceRefs: [] }, integrity: { present: true, integrityCheckPassed: false } };
  return { evidence: { level: claim.assuranceLevel, evidenceRefs: [claim.id] }, integrity: { present: true, integrityCheckPassed: true } };
}

/** Re-runs `validateNewCapabilityVerification` (the same structural sanity check
 * `createCapabilityVerification` already enforced at write time) before a stored
 * `capability_verifications` row is allowed to produce source inspection / correspondence /
 * security / canonical-evidence dimensions over HTTP. A row that fails it is treated as
 * unavailable evidence, never as a partially-trusted verdict. */
function assembleVerificationEvidence(
  version: ResourceVersion | null,
  verification: CapabilityVerification | null,
): {
  sourceInspection: SourceInspectionEvidence;
  correspondence: DistributionCorrespondenceEvidence;
  security: SecurityAssessmentEvidence;
  canonicalEvidence: CanonicalEvidencePointer;
  integrity: EvidenceIntegrityFlags;
} {
  const empty = emptyTrust();
  if (!verification) {
    return { ...empty, integrity: { present: false, integrityCheckPassed: false } };
  }

  const issues = validateNewCapabilityVerification(verification);
  if (issues.length > 0) {
    return { ...empty, integrity: { present: true, integrityCheckPassed: false } };
  }

  // The exact commit is the resource version's own recorded claim, never invented here; the
  // snapshot digest only came from a real M8.6 INSPECTED result (packages/skill-verification-link
  // `capability-evidence.ts`). Both are required together for `sourceInspection.status` to
  // present as `INSPECTED` (capability-model validate.ts): a row from before the M8.7
  // `source_snapshot_sha256` column existed, or one missing an exact commit, presents as
  // `NOT_RUN` rather than a partially-populated `INSPECTED` — missing evidence stays missing.
  const canPresentInspection =
    verification.sourceInspectionStatus === "INSPECTED" &&
    verification.sourceSnapshotSha256 !== null &&
    version?.sourceCommitSha != null;

  const sourceInspection: SourceInspectionEvidence = canPresentInspection
    ? { status: "INSPECTED", exactCommitSha: version!.sourceCommitSha, sourceSnapshotSha256: verification.sourceSnapshotSha256 }
    : empty.sourceInspection;

  const correspondence: DistributionCorrespondenceEvidence = {
    status: verification.correspondenceStatus,
    publisherSha256: verification.publisherSha256,
    reproducedSha256: verification.reproducedSha256,
  };

  const security: SecurityAssessmentEvidence = {
    status: verification.securityStatus,
    analysisKind: verification.securityStatus === "COMPLETED" ? "DETERMINISTIC_STATIC" : null,
    highestSeverity: verification.securityHighestSeverity,
    findingCount: verification.securityFindingCount,
  };

  const canonicalEvidence: CanonicalEvidencePointer =
    verification.canonicalEvidenceSha256 !== null && verification.verifiedAt !== null
      ? {
          status: "AVAILABLE",
          sha256: verification.canonicalEvidenceSha256,
          verifiedAt: verification.verifiedAt,
          storageRoot: verification.storageRoot,
          registryRecordId: verification.registryRecordId,
        }
      : empty.canonicalEvidence;

  return { sourceInspection, correspondence, security, canonicalEvidence, integrity: { present: true, integrityCheckPassed: true } };
}

export function assembleTrustEvidence(
  version: ResourceVersion | null,
  activeSourceClaims: readonly SourceClaim[],
  latestVerification: CapabilityVerification | null,
): { trust: CapabilityTrustEvidence; integrity: AssembledIntegrity } {
  const { evidence: sourceAssurance, integrity: sourceAssuranceIntegrity } = assembleSourceAssurance(activeSourceClaims);
  const { sourceInspection, correspondence, security, canonicalEvidence, integrity: canonicalVerification } =
    assembleVerificationEvidence(version, latestVerification);

  return {
    trust: { sourceAssurance, sourceInspection, correspondence, security, canonicalEvidence },
    integrity: { sourceAssurance: sourceAssuranceIntegrity, canonicalVerification },
  };
}

function versionToApiVersion(version: ResourceVersion): CapabilityVersion {
  return {
    id: version.id,
    versionLabel: version.versionLabel,
    source: version.sourceRepository === null || version.sourceRepository.length === 0
      ? null
      : { repositoryUrl: version.sourceRepository, commitSha: version.sourceCommitSha, subdirectory: version.sourceSubdirectory },
    distribution: version.distributionUrl === null || version.distributionUrl.length === 0
      ? null
      : { url: version.distributionUrl, sha256: version.distributionSha256 },
  };
}

interface AssembledResource {
  readonly resource: AgenticResource;
  readonly version: ResourceVersion | null;
  readonly capability: CapabilityResource;
  readonly integrity: AssembledIntegrity;
}

export async function loadAssembledResource(store: CatalogStore, resourceId: string): Promise<AssembledResource | null> {
  const resource = await store.getResourceById(resourceId);
  if (!resource) return null;

  const discoveries = await store.listDiscoveriesByResource(resource.id);
  const discovery = discoveries[0] ?? null;
  if (!discovery) return null;

  const versions = await store.listVersionsByResource(resource.id);
  const version = versions[0] ?? null;

  const activeClaims = version ? await store.listActiveSourceClaimsByResourceVersion(version.id) : [];
  const latestVerification = version ? await store.getLatestCapabilityVerification(version.id) : null;

  const base = catalogRecordToCapabilityResource(resource, discovery, version);
  const { trust, integrity } = assembleTrustEvidence(version, activeClaims, latestVerification);
  const capability: CapabilityResource = { ...base, trust };
  // Defensive: the assembly rules above are constructed to always satisfy the M8.1 model
  // invariants; this re-validates rather than trusting that by construction.
  validateCapabilityResource(capability);

  return { resource, version, capability, integrity };
}

function requiredPathSegment(raw: string | undefined): string {
  if (!raw) throw new ApiV1Error("invalid_request", "missing path segment");
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ApiV1Error("invalid_request", "path segment was not valid percent-encoding");
  }
}

export interface ResourceApiResponse {
  readonly schemaVersion: "1";
  readonly resourceId: string;
  readonly currentVersionId: string | null;
  readonly resource: CapabilityResource;
  readonly integrity: AssembledIntegrity;
}

/** Pure serializer shared by `GET /api/v1/resources/:resourceId` and the `aegisone_inspect` MCP
 * tool (M8.8) so both surfaces present byte-identical evidence for the same stored resource. */
export function toResourceApiResponse(assembled: AssembledResource): ResourceApiResponse {
  return {
    schemaVersion: SCHEMA_VERSION,
    resourceId: assembled.resource.id,
    currentVersionId: assembled.version?.id ?? null,
    resource: assembled.capability,
    integrity: assembled.integrity,
  };
}

async function handleGetResource(store: CatalogStore, response: ServerResponse, resourceId: string): Promise<void> {
  const assembled = await loadAssembledResource(store, resourceId);
  if (!assembled) {
    sendJson(response, 404, { error: "resource_not_found", errorCode: "RESOURCE_NOT_FOUND", message: `No resource with id ${resourceId}` });
    return;
  }
  sendJson(response, 200, toResourceApiResponse(assembled));
}

async function handleGetVersion(store: CatalogStore, response: ServerResponse, resourceId: string, versionId: string): Promise<void> {
  const resource = await store.getResourceById(resourceId);
  if (!resource) {
    sendJson(response, 404, { error: "resource_not_found", errorCode: "RESOURCE_NOT_FOUND", message: `No resource with id ${resourceId}` });
    return;
  }
  const version = await store.getResourceVersionById(versionId);
  if (!version || version.resourceId !== resource.id) {
    sendJson(response, 404, { error: "version_not_found", errorCode: "VERSION_NOT_FOUND", message: `No version with id ${versionId} on resource ${resourceId}` });
    return;
  }

  const activeClaims = await store.listActiveSourceClaimsByResourceVersion(version.id);
  const latestVerification = await store.getLatestCapabilityVerification(version.id);
  const { trust, integrity } = assembleTrustEvidence(version, activeClaims, latestVerification);

  sendJson(response, 200, {
    schemaVersion: SCHEMA_VERSION,
    resourceId: resource.id,
    version: versionToApiVersion(version),
    trust,
    integrity,
  });
}

export interface SourceClaimEvidenceItem {
  readonly id: string;
  readonly assuranceLevel: SourceAssuranceLevel;
  readonly claimStatus: SourceClaim["claimStatus"];
  readonly sourceRepository: string;
  readonly sourceCommitSha: string;
  readonly sourceSubdirectory: string | null;
  readonly distributionUrl: string | null;
  readonly distributionSha256: string | null;
  readonly authenticatedAt: string | null;
  readonly createdAt: string;
  readonly supersedesClaimId: string | null;
  readonly integrityCheckPassed: boolean;
}

export interface CapabilityVerificationEvidenceItem {
  readonly id: string;
  readonly artifactKind: CapabilityVerification["artifactKind"];
  readonly sourceInspectionStatus: CapabilityVerification["sourceInspectionStatus"];
  readonly sourceSnapshotSha256: string | null;
  readonly correspondenceStatus: CapabilityVerification["correspondenceStatus"];
  readonly publisherSha256: string | null;
  readonly reproducedSha256: string | null;
  readonly securityStatus: CapabilityVerification["securityStatus"];
  readonly securityHighestSeverity: SecuritySeverity | null;
  readonly securityFindingCount: number | null;
  readonly canonicalEvidenceSha256: string | null;
  readonly storageRoot: string | null;
  readonly storageTransaction: string | null;
  readonly registryContract: string | null;
  readonly registryRecordId: string | null;
  readonly registryTransaction: string | null;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
  readonly integrityCheckPassed: boolean;
}

export interface EvidenceApiResponse {
  readonly schemaVersion: "1";
  readonly resourceId: string;
  readonly currentVersionId: string | null;
  readonly trust: CapabilityTrustEvidence;
  readonly integrity: AssembledIntegrity;
  readonly sourceClaims: SourceClaimEvidenceItem[];
  readonly capabilityVerifications: CapabilityVerificationEvidenceItem[];
}

/** Pure assembler shared by `GET /api/v1/resources/:resourceId/evidence` and the
 * `aegisone_inspect` MCP tool (M8.8): the exact same integrity-rechecked evidence, itemized
 * history, and independent trust dimensions reach both surfaces byte-identically. Returns `null`
 * when no resource exists with the given id. */
export async function buildEvidenceResponse(store: CatalogStore, resourceId: string): Promise<EvidenceApiResponse | null> {
  const resource = await store.getResourceById(resourceId);
  if (!resource) return null;

  const versions = await store.listVersionsByResource(resource.id);
  const version = versions[0] ?? null;
  const activeClaims = version ? await store.listActiveSourceClaimsByResourceVersion(version.id) : [];
  const verifications = version ? await store.listCapabilityVerificationsByResourceVersion(version.id) : [];
  const latestVerification = verifications[0] ?? null;
  const { trust, integrity } = assembleTrustEvidence(version, activeClaims, latestVerification);

  const sourceClaims = activeClaims.map((claim) => {
    const recomputedDigest = computeSourceClaimDigest(claim.canonicalClaimJson);
    const integrityCheckPassed = recomputedDigest === claim.claimDigestSha256;
    return {
      id: claim.id,
      // A tampered/unverifiable stored row never presents an upgraded assurance level here
      // either, matching the rolled-up `trust.sourceAssurance` fail-closed behavior above.
      assuranceLevel: integrityCheckPassed ? claim.assuranceLevel : "NONE",
      claimStatus: claim.claimStatus,
      sourceRepository: claim.sourceRepository,
      sourceCommitSha: claim.sourceCommitSha,
      sourceSubdirectory: claim.sourceSubdirectory,
      distributionUrl: claim.distributionUrl,
      distributionSha256: claim.distributionSha256,
      authenticatedAt: integrityCheckPassed ? claim.authenticatedAt : null,
      createdAt: claim.createdAt,
      supersedesClaimId: claim.supersedesClaimId,
      integrityCheckPassed,
    };
  });

  const capabilityVerifications = verifications.map((verification) => {
    const issues = validateNewCapabilityVerification(verification);
    const integrityCheckPassed = issues.length === 0;
    return {
      id: verification.id,
      artifactKind: verification.artifactKind,
      sourceInspectionStatus: integrityCheckPassed ? verification.sourceInspectionStatus : "NOT_RUN",
      sourceSnapshotSha256: integrityCheckPassed ? verification.sourceSnapshotSha256 : null,
      correspondenceStatus: integrityCheckPassed ? verification.correspondenceStatus : "NOT_EVALUATED",
      publisherSha256: integrityCheckPassed ? verification.publisherSha256 : null,
      reproducedSha256: integrityCheckPassed ? verification.reproducedSha256 : null,
      securityStatus: integrityCheckPassed ? verification.securityStatus : "NOT_RUN",
      securityHighestSeverity: integrityCheckPassed ? verification.securityHighestSeverity : null,
      securityFindingCount: integrityCheckPassed ? verification.securityFindingCount : null,
      canonicalEvidenceSha256: integrityCheckPassed ? verification.canonicalEvidenceSha256 : null,
      storageRoot: integrityCheckPassed ? verification.storageRoot : null,
      storageTransaction: integrityCheckPassed ? verification.storageTransaction : null,
      registryContract: integrityCheckPassed ? verification.registryContract : null,
      registryRecordId: integrityCheckPassed ? verification.registryRecordId : null,
      registryTransaction: integrityCheckPassed ? verification.registryTransaction : null,
      verifiedAt: integrityCheckPassed ? verification.verifiedAt : null,
      createdAt: verification.createdAt,
      integrityCheckPassed,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    resourceId: resource.id,
    currentVersionId: version?.id ?? null,
    trust,
    integrity,
    sourceClaims,
    capabilityVerifications,
  };
}

async function handleGetEvidence(store: CatalogStore, response: ServerResponse, resourceId: string): Promise<void> {
  const payload = await buildEvidenceResponse(store, resourceId);
  if (!payload) {
    sendJson(response, 404, { error: "resource_not_found", errorCode: "RESOURCE_NOT_FOUND", message: `No resource with id ${resourceId}` });
    return;
  }
  sendJson(response, 200, payload);
}

function parsePolicy(raw: unknown): TrustPolicy {
  if (!isObject(raw)) throw new ApiV1Error("invalid_policy", "policy must be a JSON object");
  if (raw.schemaVersion !== "1") throw new ApiV1Error("invalid_policy", 'policy.schemaVersion must be "1"');
  if (raw.missingEvidenceDecision !== "REVIEW" && raw.missingEvidenceDecision !== "DENY") {
    throw new ApiV1Error("invalid_policy", "policy.missingEvidenceDecision must be REVIEW or DENY");
  }

  const policy: TrustPolicy = { schemaVersion: "1", missingEvidenceDecision: raw.missingEvidenceDecision };

  if (raw.minimumSourceAssurance !== undefined) {
    if (typeof raw.minimumSourceAssurance !== "string" || !SOURCE_ASSURANCE_LEVELS.has(raw.minimumSourceAssurance as SourceAssuranceLevel)) {
      throw new ApiV1Error("invalid_policy", `policy.minimumSourceAssurance must be one of: ${[...SOURCE_ASSURANCE_LEVELS].join(", ")}`);
    }
    policy.minimumSourceAssurance = raw.minimumSourceAssurance as SourceAssuranceLevel;
  }

  if (raw.requireCorrespondence !== undefined) {
    if (raw.requireCorrespondence !== "MATCH") throw new ApiV1Error("invalid_policy", 'policy.requireCorrespondence, when present, must be "MATCH"');
    policy.requireCorrespondence = "MATCH";
  }

  if (raw.maximumAuditSeverity !== undefined) {
    if (typeof raw.maximumAuditSeverity !== "string" || !SECURITY_SEVERITIES.has(raw.maximumAuditSeverity as SecuritySeverity)) {
      throw new ApiV1Error("invalid_policy", `policy.maximumAuditSeverity must be one of: ${[...SECURITY_SEVERITIES].join(", ")}`);
    }
    policy.maximumAuditSeverity = raw.maximumAuditSeverity as SecuritySeverity;
  }

  if (raw.maximumEvidenceAgeHours !== undefined) {
    if (typeof raw.maximumEvidenceAgeHours !== "number" || !Number.isFinite(raw.maximumEvidenceAgeHours) || raw.maximumEvidenceAgeHours <= 0) {
      throw new ApiV1Error("invalid_policy", "policy.maximumEvidenceAgeHours must be a positive number");
    }
    policy.maximumEvidenceAgeHours = raw.maximumEvidenceAgeHours;
  }

  return policy;
}

async function resolvePolicySubjectResource(store: CatalogStore, raw: Record<string, unknown>): Promise<CapabilityResource> {
  const hasResource = raw.resource !== undefined;
  const hasResourceId = raw.resourceId !== undefined;
  if (hasResource === hasResourceId) {
    throw new ApiV1Error("invalid_request", "exactly one of resource or resourceId must be supplied");
  }

  if (hasResource) {
    if (!isObject(raw.resource)) throw new ApiV1Error("invalid_resource", "resource must be a JSON object");
    const candidate = raw.resource as CapabilityResource;
    const issues = validateCapabilityResource(candidate);
    if (issues.length > 0) {
      throw new ApiV1Error("invalid_resource", "resource failed capability-model validation", 400, issues);
    }
    return candidate;
  }

  if (typeof raw.resourceId !== "string" || raw.resourceId.trim() === "") {
    throw new ApiV1Error("invalid_request", "resourceId must be a non-empty string");
  }
  const assembled = await loadAssembledResource(store, raw.resourceId.trim());
  if (!assembled) throw new ApiV1Error("resource_not_found", `No resource with id ${raw.resourceId}`, 404);
  return assembled.capability;
}

export interface TrustPolicyResult {
  readonly schemaVersion: "1";
  readonly decision: "ALLOW" | "REVIEW" | "DENY";
  readonly reasons: readonly { readonly code: string; readonly decision: string; readonly message: string }[];
}

/** Pure evaluator shared by `POST /api/v1/policy/evaluate` and the `aegisone_evaluate` MCP tool
 * (M8.8): both surfaces parse the same `raw.policy`/`raw.resource`/`raw.resourceId` shape through
 * the same `parsePolicy`/`resolvePolicySubjectResource` validation and call the same unmodified
 * M8.1 `evaluateTrustPolicy` — no LLM, discovery provider, GitHub OAuth, Supabase evidence
 * invention, blockchain, or worker/build call on either path. */
export async function runPolicyEvaluation(store: CatalogStore, raw: Record<string, unknown>): Promise<TrustPolicyResult> {
  const policy = parsePolicy(raw.policy);
  const resource = await resolvePolicySubjectResource(store, raw);
  return evaluateTrustPolicy(resource, policy, Date.now()) as TrustPolicyResult;
}

async function handlePolicyEvaluate(store: CatalogStore, request: IncomingMessage, response: ServerResponse): Promise<void> {
  requireJsonContentType(request);
  const raw = await readJsonBody(request, MAX_POLICY_REQUEST_BODY_BYTES);
  if (!isObject(raw)) throw new ApiV1Error("invalid_request", "request body must be a JSON object");

  const result = await runPolicyEvaluation(store, raw);
  sendJson(response, 200, result);
}

const RESOURCE_PATH_RE = /^\/api\/v1\/resources\/([^/]+)$/;
const VERSION_PATH_RE = /^\/api\/v1\/resources\/([^/]+)\/versions\/([^/]+)$/;
const EVIDENCE_PATH_RE = /^\/api\/v1\/resources\/([^/]+)\/evidence$/;
const MAX_SCAN_REQUEST_BODY_BYTES = 384 * 1024;

/** Best-effort caller identity for the paste-to-scan rate limiters (docs/17-m8-security-
 * boundaries.md Threat M8-005). `proofrail-app` is not behind a trusted reverse-proxy contract
 * that guarantees `x-forwarded-for` is not caller-spoofable, so this intentionally prefers the
 * raw socket address over any header — good enough for a coarse abuse bound on a single-process
 * deployment, not a strong per-user identity. */
function scanRateLimitKey(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown";
}

async function handlePostScan(deps: ScanServiceDependencies, request: IncomingMessage, response: ServerResponse): Promise<void> {
  requireJsonContentType(request);
  const raw = await readJsonBody(request, MAX_SCAN_REQUEST_BODY_BYTES);
  const result: ScanApiResponse = await performPastedSkillScan(raw, deps, scanRateLimitKey(request));
  sendJson(response, 200, result);
}

export function createApiV1Router(store: CatalogStore, scanDeps?: Omit<ScanServiceDependencies, "catalogStore">) {
  return async function handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    try {
      if (request.method === "POST" && url.pathname === "/api/v1/scan") {
        if (!scanDeps) throw new ApiV1Error("scan_unavailable", "Paste-to-scan is not configured on this server", 503);
        await handlePostScan({ catalogStore: store, ...scanDeps }, request, response);
        return true;
      }

      const versionMatch = url.pathname.match(VERSION_PATH_RE);
      if (request.method === "GET" && versionMatch) {
        await handleGetVersion(store, response, requiredPathSegment(versionMatch[1]), requiredPathSegment(versionMatch[2]));
        return true;
      }

      const evidenceMatch = url.pathname.match(EVIDENCE_PATH_RE);
      if (request.method === "GET" && evidenceMatch) {
        await handleGetEvidence(store, response, requiredPathSegment(evidenceMatch[1]));
        return true;
      }

      const resourceMatch = url.pathname.match(RESOURCE_PATH_RE);
      if (request.method === "GET" && resourceMatch) {
        await handleGetResource(store, response, requiredPathSegment(resourceMatch[1]));
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/policy/evaluate") {
        await handlePolicyEvaluate(store, request, response);
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof ApiV1Error || error instanceof ScanServiceError) {
        sendJson(response, error.status, {
          error: error.code,
          errorCode: error.code.toUpperCase(),
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        });
        return true;
      }
      throw error;
    }
  };
}
