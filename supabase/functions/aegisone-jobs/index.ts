import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (error || !data?.token_sha256) throw new Error(`AegisOne auth configuration unavailable: ${error?.message ?? "missing row"}`);
  return constantTimeEqual(await sha256Hex(token), data.token_sha256);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
    if (!(await authorized(request))) return reply(401, { error: "unauthorized" });

    const body = await request.json();
    if (!isObject(body) || typeof body.action !== "string") return reply(400, { error: "invalid_request" });

    if (body.action === "create") {
      if (!isObject(body.input)) return reply(400, { error: "invalid_input" });
      const input = body.input;
      const { data, error } = await admin.from("verification_jobs").insert({
        owner_id: input.ownerId ?? null,
        status: "queued",
        artifact_kind: input.artifactKind ?? "software",
        project_id: input.projectId,
        source_repository: input.sourceRepository,
        source_commit_sha: input.sourceCommitSha,
        source_subdirectory: input.sourceSubdirectory ?? null,
        publisher_artifact_name: input.publisherArtifactName,
        publisher_artifact_sha256: input.publisherArtifactSha256 ?? null,
      }).select("*").single();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: [data] });
    }

    if (body.action === "get") {
      if (typeof body.id !== "string") return reply(400, { error: "invalid_id" });
      const { data, error } = await admin.from("verification_jobs").select("*").eq("id", body.id).maybeSingle();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ? [data] : [] });
    }

    if (body.action === "list") {
      let query = admin.from("verification_jobs").select("*").order("created_at", { ascending: false });
      if (body.filterOwner === true) {
        if (body.ownerId === null) query = query.is("owner_id", null);
        else if (typeof body.ownerId === "string") query = query.eq("owner_id", body.ownerId);
        else return reply(400, { error: "invalid_owner" });
      }
      const { data, error } = await query;
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ?? [] });
    }

    if (body.action === "update") {
      if (typeof body.id !== "string" || !isObject(body.patch)) return reply(400, { error: "invalid_update" });
      const allowed = new Set([
        "status", "publisher_artifact_sha256", "manifest_sha256", "storage_root",
        "storage_transaction", "registry_contract", "registry_transaction",
        "registry_record_id", "verification_json", "failure_code", "failure_message",
      ]);
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body.patch)) {
        if (allowed.has(key)) patch[key] = value;
      }
      const { data, error } = await admin.from("verification_jobs").update(patch).eq("id", body.id).select("*").maybeSingle();
      if (error) return reply(400, { error: "database_error", message: error.message });
      return reply(200, { rows: data ? [data] : [] });
    }

    return reply(400, { error: "unknown_action" });
  } catch (error) {
    return reply(500, { error: "internal_error", message: error instanceof Error ? error.message : String(error) });
  }
});
