import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// M8.4: token-gated server-to-server Edge Function for the mutable capability
// catalog (agentic_resources / resource_discoveries / resource_versions /
// ingestion_sources). Mirrors the proofrail-jobs Edge Function pattern: this
// function holds Supabase's service-role credential internally so Railway never
// needs it, and every request is additionally gated by a high-entropy ProofRail
// app token whose SHA-256 digest is checked against public.proofrail_app_auth.
//
// This function persists discovery/version bookkeeping only. It has no code path
// that can write a MATCH/MISMATCH, REPOSITORY_AUTHENTICATED, SIGNED_RELEASE,
// security finding, or canonical evidence value.

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are unavailable");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function reply(status: number, value: unknown): Response {
  return new Response(`${JSON.stringify(value)}\n`, { status, headers: jsonHeaders });
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorized(request: Request): Promise<boolean> {
  const token = request.headers.get("x-proofrail-app-token")?.trim();
  if (!token) return false;
  const { data, error } = await admin
    .from("proofrail_app_auth")
    .select("token_sha256")
    .eq("singleton", true)
    .single();
  if (error || !data?.token_sha256) throw new Error(`ProofRail auth configuration unavailable: ${error?.message ?? "missing row"}`);
  return constantTimeEqual(await sha256Hex(token), data.token_sha256);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const DISCOVERY_STATUSES = new Set(["INDEXED", "STALE", "UNAVAILABLE"]);
const ASSURANCE_LEVELS = new Set(["NONE", "DECLARED", "REPOSITORY_AUTHENTICATED", "SIGNED_RELEASE"]);
const COMMIT_SHA_RE = /^[0-9a-fA-F]{40}$/;
const DIGEST_SHA256_RE = /^[0-9a-fA-F]{64}$/;

const ARTIFACT_KINDS = new Set(["agent-skill"]);
const SOURCE_INSPECTION_STATUSES = new Set(["NOT_RUN", "INSPECTED"]);
const CORRESPONDENCE_STATUSES = new Set(["NOT_EVALUATED", "INSUFFICIENT_EVIDENCE", "MATCH", "MISMATCH", "DIVERGED"]);
const SECURITY_STATUSES = new Set(["NOT_RUN", "COMPLETED"]);
const SECURITY_SEVERITIES = new Set(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// Mirrors packages/catalog-store/src/capability-verification-validation.ts. Deno cannot import
// that module directly; keep both in sync if this logic changes (both sides are covered by
// tests, and the Postgres CHECK constraints in the M8.6 migration are the authoritative,
// always-enforced copy of the same rules).
function validateNewCapabilityVerification(body: Record<string, unknown>): string | null {
  const publisherSha256 = body.publisherSha256 ?? null;
  const reproducedSha256 = body.reproducedSha256 ?? null;
  const bothDigests = typeof publisherSha256 === "string" && typeof reproducedSha256 === "string";

  if (publisherSha256 !== null && (typeof publisherSha256 !== "string" || !DIGEST_SHA256_RE.test(publisherSha256))) {
    return "invalid_publisher_sha256";
  }
  if (reproducedSha256 !== null && (typeof reproducedSha256 !== "string" || !DIGEST_SHA256_RE.test(reproducedSha256))) {
    return "invalid_reproduced_sha256";
  }

  switch (body.correspondenceStatus) {
    case "NOT_EVALUATED":
      if (publisherSha256 !== null || reproducedSha256 !== null) return "not_evaluated_has_digests";
      break;
    case "MATCH":
      if (!bothDigests || publisherSha256 !== reproducedSha256) return "match_requires_equal_digests";
      break;
    case "MISMATCH":
      if (!bothDigests || publisherSha256 === reproducedSha256) return "mismatch_requires_different_digests";
      break;
    case "DIVERGED":
      if (!bothDigests) return "diverged_requires_both_digests";
      break;
    case "INSUFFICIENT_EVIDENCE":
      break;
    default:
      return "invalid_correspondence_status";
  }

  if (body.securityStatus === "NOT_RUN") {
    if (body.securityHighestSeverity !== null && body.securityHighestSeverity !== undefined) return "not_run_security_has_findings";
    if (body.securityFindingCount !== null && body.securityFindingCount !== undefined) return "not_run_security_has_findings";
  } else if (body.securityStatus === "COMPLETED") {
    if (typeof body.securityHighestSeverity !== "string" || !SECURITY_SEVERITIES.has(body.securityHighestSeverity)) return "completed_security_missing_findings";
    if (typeof body.securityFindingCount !== "number" || !Number.isInteger(body.securityFindingCount) || body.securityFindingCount < 0) return "completed_security_missing_findings";
  } else {
    return "invalid_security_status";
  }

  return null;
}

// Mirrors packages/catalog-store/src/source-claim-transition.ts. Deno cannot import that module
// directly; keep both in sync if this logic changes (both sides are covered by tests).
function resolveSourceClaimTransition(
  activeClaims: { id: string; source_repository_id: number | null; source_repository: string }[],
  newRepositoryId: number | null,
  newRepositoryFullName: string,
): { kind: "new" } | { kind: "supersede"; supersedesClaimId: string } | { kind: "conflict"; conflictingClaimId: string } {
  if (activeClaims.length === 0) return { kind: "new" };
  const sameRepository = activeClaims.find((claim) =>
    newRepositoryId !== null && claim.source_repository_id !== null
      ? claim.source_repository_id === newRepositoryId
      : claim.source_repository === newRepositoryFullName,
  );
  if (sameRepository) return { kind: "supersede", supersedesClaimId: sameRepository.id };
  return { kind: "conflict", conflictingClaimId: activeClaims[0].id };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
    if (!(await authorized(request))) return reply(401, { error: "unauthorized" });

    const body = await request.json();
    if (!isObject(body) || typeof body.action !== "string") return reply(400, { error: "invalid_request" });

    // upsertDiscoveredResource: find-or-create the resource by canonical_key, then
    // upsert its provider discovery row and (optionally) one version row. All three
    // writes touch discovery/version bookkeeping only.
    if (body.action === "upsertDiscoveredResource") {
      const resource = body.resource;
      const discovery = body.discovery;
      if (!isObject(resource) || !isNonEmptyString(resource.canonicalKey) || !isNonEmptyString(resource.kind)
        || !isNonEmptyString(resource.name) || !isObject(discovery)
        || !isNonEmptyString(discovery.providerId) || !isNonEmptyString(discovery.providerResourceId)
        || !isNonEmptyString(discovery.observedAt)) {
        return reply(400, { error: "invalid_input" });
      }

      const { data: resourceRow, error: resourceError } = await admin
        .from("agentic_resources")
        .upsert({
          canonical_key: resource.canonicalKey,
          kind: resource.kind,
          name: resource.name,
          description: resource.description ?? "",
          publisher_label: resource.publisherLabel ?? null,
          canonical_url: resource.canonicalUrl ?? null,
          last_seen_at: discovery.observedAt,
        }, { onConflict: "canonical_key" })
        .select("*")
        .single();
      if (resourceError) return reply(400, { error: "database_error", message: resourceError.message });

      const discoveryStatus = typeof discovery.discoveryStatus === "string" && DISCOVERY_STATUSES.has(discovery.discoveryStatus)
        ? discovery.discoveryStatus
        : "INDEXED";
      const { data: discoveryRow, error: discoveryError } = await admin
        .from("resource_discoveries")
        .upsert({
          resource_id: resourceRow.id,
          provider_id: discovery.providerId,
          provider_resource_id: discovery.providerResourceId,
          resource_url: discovery.resourceUrl ?? null,
          media_type: discovery.mediaType ?? null,
          raw_relevance_score: discovery.rawRelevanceScore ?? null,
          discovery_status: discoveryStatus,
          observed_at: discovery.observedAt,
          expires_at: discovery.expiresAt ?? null,
          provider_metadata: discovery.providerMetadata ?? {},
        }, { onConflict: "provider_id,provider_resource_id" })
        .select("*")
        .single();
      if (discoveryError) return reply(400, { error: "database_error", message: discoveryError.message });

      let versionRow = null;
      const version = body.version;
      if (isObject(version) && isNonEmptyString(version.versionKey)) {
        const { data, error } = await admin
          .from("resource_versions")
          .upsert({
            resource_id: resourceRow.id,
            version_key: version.versionKey,
            version_label: version.versionLabel ?? null,
            source_provider: version.sourceProvider ?? null,
            source_repository: version.sourceRepository ?? null,
            source_repository_id: version.sourceRepositoryId ?? null,
            source_commit_sha: version.sourceCommitSha ?? null,
            source_subdirectory: version.sourceSubdirectory ?? null,
            distribution_url: version.distributionUrl ?? null,
            distribution_sha256: version.distributionSha256 ?? null,
            last_seen_at: discovery.observedAt,
          }, { onConflict: "resource_id,version_key" })
          .select("*")
          .single();
        if (error) return reply(400, { error: "database_error", message: error.message });
        versionRow = data;
      }

      return reply(200, { resource: resourceRow, discovery: discoveryRow, version: versionRow });
    }

    // markProviderDiscoveriesStale: incremental-refresh outage handling. Never
    // deletes resource/version identity; only marks discovery rows for a provider
    // stale/unavailable when they were not seen in the latest fetch.
    if (body.action === "markProviderDiscoveriesStale") {
      if (!isNonEmptyString(body.providerId) || !Array.isArray(body.seenProviderResourceIds)) {
        return reply(400, { error: "invalid_input" });
      }
      const status = typeof body.status === "string" && (body.status === "STALE" || body.status === "UNAVAILABLE")
        ? body.status
        : "STALE";
      const seen = body.seenProviderResourceIds.filter((value: unknown) => typeof value === "string");

      let query = admin
        .from("resource_discoveries")
        .update({ discovery_status: status })
        .eq("provider_id", body.providerId)
        .neq("discovery_status", status);
      query = seen.length > 0 ? query.not("provider_resource_id", "in", `(${seen.map((id: string) => `"${id.replace(/"/g, '\\"')}"`).join(",")})`) : query;
      const { data, error } = await query.select("*");
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ?? [] });
    }

    if (body.action === "getResourceByCanonicalKey") {
      if (!isNonEmptyString(body.canonicalKey)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("agentic_resources")
        .select("*")
        .eq("canonical_key", body.canonicalKey)
        .maybeSingle();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { resource: data ?? null });
    }

    if (body.action === "listDiscoveriesByResource") {
      if (!isNonEmptyString(body.resourceId)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("resource_discoveries")
        .select("*")
        .eq("resource_id", body.resourceId)
        .order("observed_at", { ascending: false });
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ?? [] });
    }

    if (body.action === "listVersionsByResource") {
      if (!isNonEmptyString(body.resourceId)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("resource_versions")
        .select("*")
        .eq("resource_id", body.resourceId)
        .order("last_seen_at", { ascending: false });
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ?? [] });
    }

    if (body.action === "getIngestionSource") {
      if (!isNonEmptyString(body.id)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("ingestion_sources")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { ingestionSource: data ?? null });
    }

    if (body.action === "upsertIngestionSource") {
      if (!isNonEmptyString(body.id) || !isNonEmptyString(body.providerType)) return reply(400, { error: "invalid_input" });
      const patch = isObject(body.patch) ? body.patch : {};
      const allowed = new Set([
        "enabled", "last_success_at", "last_attempt_at", "cursor",
        "updated_since", "last_error_code", "last_error_at", "config_public",
      ]);
      const row: Record<string, unknown> = { id: body.id, provider_type: body.providerType };
      for (const [key, value] of Object.entries(patch)) {
        if (allowed.has(key)) row[key] = value;
      }
      const { data, error } = await admin
        .from("ingestion_sources")
        .upsert(row, { onConflict: "id" })
        .select("*")
        .single();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { ingestionSource: data });
    }

    // M8.5: createSourceClaim inserts a new immutable source_claims row and resolves the
    // active-claim transition (new / supersede / conflict) for the same resource_version_id.
    // Only claim_status is ever updated on a prior row; every other column stays untouched.
    if (body.action === "createSourceClaim") {
      if (
        !isNonEmptyString(body.resourceVersionId) || !isNonEmptyString(body.provider)
        || typeof body.assuranceLevel !== "string" || !ASSURANCE_LEVELS.has(body.assuranceLevel)
        || !isNonEmptyString(body.sourceRepository) || !isNonEmptyString(body.sourceCommitSha)
        || !COMMIT_SHA_RE.test(body.sourceCommitSha)
        || !isNonEmptyString(body.claimDigestSha256) || !DIGEST_SHA256_RE.test(body.claimDigestSha256)
        || !isObject(body.canonicalClaimJson)
      ) {
        return reply(400, { error: "invalid_input" });
      }
      const sourceRepositoryId = typeof body.sourceRepositoryId === "number" ? body.sourceRepositoryId : null;

      const { data: activeClaims, error: activeError } = await admin
        .from("source_claims")
        .select("id, source_repository_id, source_repository")
        .eq("resource_version_id", body.resourceVersionId)
        .eq("claim_status", "active");
      if (activeError) return reply(400, { error: "database_error", message: activeError.message });

      const transition = resolveSourceClaimTransition(activeClaims ?? [], sourceRepositoryId, body.sourceRepository);
      const claimStatus = transition.kind === "conflict" ? "conflicted" : "active";

      const { data: insertedClaim, error: insertError } = await admin
        .from("source_claims")
        .insert({
          resource_version_id: body.resourceVersionId,
          provider: body.provider,
          assurance_level: body.assuranceLevel,
          claim_status: claimStatus,
          source_repository: body.sourceRepository,
          source_repository_id: sourceRepositoryId,
          source_repository_node_id: body.sourceRepositoryNodeId ?? null,
          source_owner_login: body.sourceOwnerLogin ?? null,
          source_owner_id: typeof body.sourceOwnerId === "number" ? body.sourceOwnerId : null,
          source_commit_sha: body.sourceCommitSha,
          source_subdirectory: body.sourceSubdirectory ?? null,
          distribution_url: body.distributionUrl ?? null,
          distribution_sha256: body.distributionSha256 ?? null,
          claim_digest_sha256: body.claimDigestSha256,
          canonical_claim_json: body.canonicalClaimJson,
          authenticated_at: body.authenticatedAt ?? null,
          supersedes_claim_id: transition.kind === "supersede" ? transition.supersedesClaimId : null,
        })
        .select("*")
        .single();
      if (insertError) return reply(400, { error: "database_error", message: insertError.message });

      let supersededClaimId: string | null = null;
      let conflict: { type: string; conflictingClaimId: string } | null = null;
      if (transition.kind === "supersede") {
        const { error } = await admin.from("source_claims").update({ claim_status: "superseded" }).eq("id", transition.supersedesClaimId);
        if (error) return reply(400, { error: "database_error", message: error.message });
        supersededClaimId = transition.supersedesClaimId;
      } else if (transition.kind === "conflict") {
        const { error } = await admin.from("source_claims").update({ claim_status: "conflicted" }).eq("id", transition.conflictingClaimId);
        if (error) return reply(400, { error: "database_error", message: error.message });
        conflict = { type: "SOURCE_CLAIM_CONFLICT", conflictingClaimId: transition.conflictingClaimId };
      }

      let authorityObservations: unknown[] = [];
      const observationsInput = Array.isArray(body.authorityObservations) ? body.authorityObservations : [];
      if (observationsInput.length > 0) {
        const rows = observationsInput.filter(isObject).map((observation) => ({
          source_claim_id: insertedClaim.id,
          provider: observation.provider ?? body.provider,
          subject_type: observation.subjectType,
          subject_id: observation.subjectId,
          subject_login: observation.subjectLogin ?? null,
          repository_id: observation.repositoryId ?? null,
          observed_permission: observation.observedPermission ?? null,
          observed_role_name: observation.observedRoleName ?? null,
          observation_json: observation.observationJson ?? {},
          observed_at: observation.observedAt,
        }));
        const { data, error } = await admin.from("source_claim_authority_observations").insert(rows).select("*");
        if (error) return reply(400, { error: "database_error", message: error.message });
        authorityObservations = data ?? [];
      }

      return reply(200, { sourceClaim: insertedClaim, authorityObservations, supersededClaimId, conflict });
    }

    if (body.action === "getSourceClaim") {
      if (!isNonEmptyString(body.id)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin.from("source_claims").select("*").eq("id", body.id).maybeSingle();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { sourceClaim: data ?? null });
    }

    if (body.action === "listActiveSourceClaimsByResourceVersion") {
      if (!isNonEmptyString(body.resourceVersionId)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("source_claims")
        .select("*")
        .eq("resource_version_id", body.resourceVersionId)
        .eq("claim_status", "active")
        .order("created_at", { ascending: false });
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ?? [] });
    }

    // M8.6: createCapabilityVerification always inserts a new immutable
    // capability_verifications row linking a resource version (and optional source claim /
    // verification job) to canonical ProofRail evidence already produced elsewhere. This
    // function never computes MATCH/MISMATCH itself; it only persists an already-validated
    // result and rejects one that fails the same sanity checks the Postgres CHECK constraints
    // enforce (docs/16 "Database-level sanity checks").
    if (body.action === "createCapabilityVerification") {
      if (
        !isNonEmptyString(body.resourceVersionId)
        || typeof body.artifactKind !== "string" || !ARTIFACT_KINDS.has(body.artifactKind)
        || typeof body.sourceInspectionStatus !== "string" || !SOURCE_INSPECTION_STATUSES.has(body.sourceInspectionStatus)
        || typeof body.correspondenceStatus !== "string" || !CORRESPONDENCE_STATUSES.has(body.correspondenceStatus)
        || typeof body.securityStatus !== "string" || !SECURITY_STATUSES.has(body.securityStatus)
      ) {
        return reply(400, { error: "invalid_input" });
      }
      const sanityError = validateNewCapabilityVerification(body);
      if (sanityError) return reply(400, { error: "invalid_input", message: sanityError });

      const { data, error } = await admin
        .from("capability_verifications")
        .insert({
          resource_version_id: body.resourceVersionId,
          source_claim_id: body.sourceClaimId ?? null,
          verification_job_id: body.verificationJobId ?? null,
          artifact_kind: body.artifactKind,
          source_inspection_status: body.sourceInspectionStatus,
          correspondence_status: body.correspondenceStatus,
          publisher_sha256: body.publisherSha256 ?? null,
          reproduced_sha256: body.reproducedSha256 ?? null,
          security_status: body.securityStatus,
          security_highest_severity: body.securityHighestSeverity ?? null,
          security_finding_count: body.securityFindingCount ?? null,
          canonical_evidence_sha256: body.canonicalEvidenceSha256 ?? null,
          storage_root: body.storageRoot ?? null,
          storage_transaction: body.storageTransaction ?? null,
          registry_contract: body.registryContract ?? null,
          registry_record_id: body.registryRecordId ?? null,
          registry_transaction: body.registryTransaction ?? null,
          verified_at: body.verifiedAt ?? null,
        })
        .select("*")
        .single();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { capabilityVerification: data });
    }

    if (body.action === "getLatestCapabilityVerification") {
      if (!isNonEmptyString(body.resourceVersionId)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("capability_verifications")
        .select("*")
        .eq("resource_version_id", body.resourceVersionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { capabilityVerification: data ?? null });
    }

    if (body.action === "listCapabilityVerificationsByResourceVersion") {
      if (!isNonEmptyString(body.resourceVersionId)) return reply(400, { error: "invalid_input" });
      const { data, error } = await admin
        .from("capability_verifications")
        .select("*")
        .eq("resource_version_id", body.resourceVersionId)
        .order("created_at", { ascending: false });
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ?? [] });
    }

    return reply(400, { error: "unknown_action" });
  } catch (error) {
    return reply(500, { error: "internal_error", message: error instanceof Error ? error.message : String(error) });
  }
});
