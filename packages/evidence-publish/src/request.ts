import { isSha256 } from "../../core/src/hash.ts";
import type {
  EvidenceBundle,
  PublicationCorrespondenceStatus,
  PublicationEvidenceFacts,
  PublicationSecurityStatus,
  PublicationSeverity,
  PublicationSourceInspectionStatus,
} from "./model.ts";

/**
 * Strict validation for the ONE payload `POST /internal/publish-evidence` accepts.
 *
 * docs/17-m8-security-boundaries.md Threat M8-006 (signer/key exposure) and AGENTS.md ("no public
 * generic worker execution/signing route") set the shape of this module: the worker holds the only
 * 0G signer in the system, so the request it accepts must be a **bounded, fully-validated evidence
 * bundle and nothing else**. There is deliberately no field here for raw bytes-to-sign, no
 * transaction/calldata field, no destination address, no command, and no URL the worker would
 * fetch. A caller who fully controls this payload can cause exactly one class of effect: a
 * size-capped evidence upload and a fixed-shape commitment of two digests to the pinned registry
 * contract. It cannot direct a transfer, choose a contract, or have arbitrary data signed.
 *
 * Every field is required and every unexpected field is rejected outright, so a future field added
 * on one side cannot be silently ignored by the other.
 */

/** Hard cap on the artifact package the worker will accept and upload. Agent Skill packages are
 * kilobytes (M7's live-proven package was 973 bytes); this leaves generous headroom while bounding
 * both request memory and 0G storage spend per call (docs/17 Threat M8-005). */
export const MAX_PACKAGE_BYTES = 512 * 1024;
/** Cap on the encoded request body as a whole, enforced by the transport before parsing. */
export const MAX_PUBLISH_REQUEST_BYTES = 1024 * 1024;
/** Cap on the serialized audit report carried in the bundle. */
export const MAX_AUDIT_REPORT_BYTES = 256 * 1024;

const SOURCE_INSPECTION: readonly PublicationSourceInspectionStatus[] = ["NOT_RUN", "INSPECTED"];
const CORRESPONDENCE: readonly PublicationCorrespondenceStatus[] = [
  "NOT_EVALUATED",
  "INSUFFICIENT_EVIDENCE",
  "MATCH",
  "MISMATCH",
  "DIVERGED",
];
const SECURITY: readonly PublicationSecurityStatus[] = ["NOT_RUN", "COMPLETED"];
const SEVERITIES: readonly PublicationSeverity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

const ALLOWED_TOP_LEVEL = new Set(["resourceVersionId", "artifactKind", "facts", "packageBase64", "auditReport"]);
const ALLOWED_FACTS = new Set([
  "sourceInspectionStatus",
  "sourceSnapshotSha256",
  "correspondenceStatus",
  "publisherSha256",
  "reproducedSha256",
  "securityStatus",
  "securityHighestSeverity",
  "securityFindingCount",
  "verifiedAt",
]);

export class PublishRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PublishRequestError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new PublishRequestError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNoUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, where: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("unexpected_field", `${where} contains unexpected field '${key}'`);
  }
}

function optionalSha256(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !isSha256(value)) fail("invalid_field", `${field} must be a lowercase SHA-256 digest or null`);
  return value;
}

/** Parses and validates the request body into an `EvidenceBundle`. Throws `PublishRequestError`
 * (never returns a partially-valid bundle) on any problem. */
export function parsePublishEvidenceRequest(body: unknown): { bundle: EvidenceBundle; resourceVersionId: string } {
  if (!isPlainObject(body)) fail("invalid_request", "request body must be a JSON object");
  requireNoUnknownKeys(body, ALLOWED_TOP_LEVEL, "request");

  if (body.artifactKind !== "agent-skill") {
    fail("unsupported_artifact_kind", "artifactKind must be 'agent-skill'");
  }

  const resourceVersionId = body.resourceVersionId;
  if (typeof resourceVersionId !== "string" || resourceVersionId.length === 0 || resourceVersionId.length > 200) {
    fail("invalid_field", "resourceVersionId must be a non-empty string of at most 200 characters");
  }

  const rawFacts = body.facts;
  if (!isPlainObject(rawFacts)) fail("invalid_request", "facts must be a JSON object");
  requireNoUnknownKeys(rawFacts, ALLOWED_FACTS, "facts");

  if (typeof rawFacts.sourceInspectionStatus !== "string" || !SOURCE_INSPECTION.includes(rawFacts.sourceInspectionStatus as PublicationSourceInspectionStatus)) {
    fail("invalid_field", "facts.sourceInspectionStatus is not a recognised value");
  }
  if (typeof rawFacts.correspondenceStatus !== "string" || !CORRESPONDENCE.includes(rawFacts.correspondenceStatus as PublicationCorrespondenceStatus)) {
    fail("invalid_field", "facts.correspondenceStatus is not a recognised value");
  }
  if (typeof rawFacts.securityStatus !== "string" || !SECURITY.includes(rawFacts.securityStatus as PublicationSecurityStatus)) {
    fail("invalid_field", "facts.securityStatus is not a recognised value");
  }

  const severity = rawFacts.securityHighestSeverity;
  if (severity !== null && (typeof severity !== "string" || !SEVERITIES.includes(severity as PublicationSeverity))) {
    fail("invalid_field", "facts.securityHighestSeverity is not a recognised severity or null");
  }

  const findingCount = rawFacts.securityFindingCount;
  if (findingCount !== null && (!Number.isSafeInteger(findingCount) || (findingCount as number) < 0)) {
    fail("invalid_field", "facts.securityFindingCount must be a non-negative integer or null");
  }

  const verifiedAt = rawFacts.verifiedAt;
  if (typeof verifiedAt !== "string" || !Number.isFinite(Date.parse(verifiedAt))) {
    fail("invalid_field", "facts.verifiedAt must be an ISO-8601 timestamp");
  }

  const facts: PublicationEvidenceFacts = {
    artifactKind: "agent-skill",
    resourceVersionId,
    sourceInspectionStatus: rawFacts.sourceInspectionStatus as PublicationSourceInspectionStatus,
    sourceSnapshotSha256: optionalSha256(rawFacts.sourceSnapshotSha256, "facts.sourceSnapshotSha256"),
    correspondenceStatus: rawFacts.correspondenceStatus as PublicationCorrespondenceStatus,
    publisherSha256: optionalSha256(rawFacts.publisherSha256, "facts.publisherSha256"),
    reproducedSha256: optionalSha256(rawFacts.reproducedSha256, "facts.reproducedSha256"),
    securityStatus: rawFacts.securityStatus as PublicationSecurityStatus,
    securityHighestSeverity: (severity ?? null) as PublicationSeverity | null,
    securityFindingCount: (findingCount ?? null) as number | null,
    verifiedAt,
  };

  // A MATCH that the worker is asked to immortalise on 0G must at least carry the two distinct
  // digests that a real correspondence result always produces. This is not the place MATCH is
  // *decided* (that is deterministic core work done long before publication) — it is a refusal to
  // publish a structurally impossible claim (AGENTS.md: missing evidence never upgrades assurance).
  if (facts.correspondenceStatus === "MATCH" && (facts.publisherSha256 === null || facts.reproducedSha256 === null)) {
    fail("incomplete_correspondence", "a MATCH publication requires both publisher and reproduced digests");
  }

  const packageBase64 = body.packageBase64;
  if (typeof packageBase64 !== "string" || packageBase64.length === 0) {
    fail("invalid_field", "packageBase64 must be a non-empty base64 string");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(packageBase64)) {
    fail("invalid_field", "packageBase64 is not valid base64");
  }
  const packageBytes = Buffer.from(packageBase64, "base64");
  if (packageBytes.byteLength === 0) fail("invalid_field", "packageBase64 decoded to zero bytes");
  if (packageBytes.byteLength > MAX_PACKAGE_BYTES) {
    fail("package_too_large", `the artifact package exceeds the ${MAX_PACKAGE_BYTES}-byte limit`);
  }

  const auditReport = body.auditReport;
  if (auditReport === undefined) fail("invalid_field", "auditReport is required");
  let auditReportBytes: number;
  try {
    auditReportBytes = Buffer.byteLength(JSON.stringify(auditReport) ?? "", "utf8");
  } catch {
    return fail("invalid_field", "auditReport must be JSON-serialisable");
  }
  if (auditReportBytes > MAX_AUDIT_REPORT_BYTES) {
    fail("audit_report_too_large", `the audit report exceeds the ${MAX_AUDIT_REPORT_BYTES}-byte limit`);
  }

  return {
    bundle: { facts, packageBytes: new Uint8Array(packageBytes), auditReport },
    resourceVersionId,
  };
}
