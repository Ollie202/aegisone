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

    return reply(400, { error: "unknown_action" });
  } catch (error) {
    return reply(500, { error: "internal_error", message: error instanceof Error ? error.message : String(error) });
  }
});
