import type { IncomingMessage, ServerResponse } from "node:http";
import type { ArtifactKind, JobStore, NewVerificationJob, VerificationJob } from "../../../packages/job-store/src/index.ts";
import { renderVerificationHtml } from "./render.ts";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(request: IncomingMessage, limit = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${key} is required`);
  return value.trim();
}

function optionalString(body: Record<string, unknown>, key: string): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key} must be a string or null`);
  return value.trim();
}

function parseCreateJob(body: unknown): NewVerificationJob {
  if (!isObject(body)) throw new Error("Request body must be a JSON object");
  const artifactKindRaw = optionalString(body, "artifactKind") ?? "software";
  if (artifactKindRaw !== "software" && artifactKindRaw !== "agent-skill") throw new Error("artifactKind must be software or agent-skill");
  const sourceCommitSha = requiredString(body, "sourceCommitSha");
  if (!/^[0-9a-f]{40}$/i.test(sourceCommitSha)) throw new Error("sourceCommitSha must be a full 40-character Git commit SHA");
  const publisherArtifactSha256 = optionalString(body, "publisherArtifactSha256");
  if (publisherArtifactSha256 && !/^[0-9a-f]{64}$/i.test(publisherArtifactSha256)) throw new Error("publisherArtifactSha256 must be a 64-character SHA-256 digest");
  const ownerId = optionalString(body, "ownerId");
  return {
    ownerId,
    artifactKind: artifactKindRaw as ArtifactKind,
    projectId: requiredString(body, "projectId"),
    sourceRepository: requiredString(body, "sourceRepository"),
    sourceCommitSha,
    sourceSubdirectory: optionalString(body, "sourceSubdirectory"),
    publisherArtifactName: requiredString(body, "publisherArtifactName"),
    publisherArtifactSha256,
  };
}

export function renderProductHomeHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ProofRail</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;background:#f7f7f5}body{margin:0}.shell{max-width:900px;margin:0 auto;padding:64px 20px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:30px;margin:18px 0}h1{font-size:44px;letter-spacing:-.05em;margin:0 0 12px}h2{font-size:18px}p{color:#4b5563;line-height:1.65}.flow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#111827;color:#f9fafb;padding:18px;border-radius:14px;white-space:pre-wrap}.pill{display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:7px 11px;font-weight:800;font-size:12px}</style></head><body><main class="shell"><span class="pill">M6 PRODUCT RUNTIME</span><h1>ProofRail</h1><p>Independently reproduce a publisher artifact from its declared source, preserve the evidence on 0G, and make the result inspectable without trusting this app database.</p><div class="card"><h2>What each layer does</h2><div class="flow">Supabase = app/job memory\nRailway = ProofRail API + workers\n0G Sandbox = independent builder\n0G Storage = canonical evidence\n0G Chain = immutable commitment anchor</div></div><div class="card"><h2>Trust rule</h2><p>Supabase may remember that a job exists, but it cannot decide MATCH or MISMATCH. Any verification page with evidence is rendered through the same integrity-checked ProofRail core used by the CLI.</p></div></main></body></html>`;
}

export function renderJobHtml(job: VerificationJob): string {
  if (job.verificationJson) return renderVerificationHtml(job.verificationJson);
  const failure = job.failure ? `<p><strong>${escapeHtml(job.failure.code)}</strong>: ${escapeHtml(job.failure.message)}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ProofRail job</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;background:#f7f7f5}body{margin:0}.shell{max-width:860px;margin:0 auto;padding:48px 20px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:26px}.row{padding:9px 0;border-bottom:1px solid #f0f1f2}.row:last-child{border:0}code{font-size:12px;word-break:break-all}p{color:#4b5563}</style></head><body><main class="shell"><h1>Verification job</h1><div class="card"><div class="row">Pipeline status: <strong>${escapeHtml(job.status)}</strong></div><div class="row">Artifact kind: <strong>${escapeHtml(job.artifactKind)}</strong></div><div class="row">Project: <strong>${escapeHtml(job.projectId)}</strong></div><div class="row">Repository: <code>${escapeHtml(job.sourceRepository)}</code></div><div class="row">Commit: <code>${escapeHtml(job.sourceCommitSha)}</code></div>${failure}</div><p>No correspondence verdict is shown until canonical verification evidence is available and passes ProofRail core integrity checks.</p></main></body></html>`;
}

export function createProductRequestHandler(store: JobStore) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const base = `http://${request.headers.host ?? "localhost"}`;
      const url = new URL(request.url ?? "/", base);

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { ok: true, service: "proofrail", mode: "product" });
        return;
      }
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderProductHomeHtml());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/jobs") {
        const job = await store.create(parseCreateJob(await readJson(request)));
        sendJson(response, 201, job);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/jobs") {
        const ownerId = url.searchParams.has("ownerId") ? url.searchParams.get("ownerId") : undefined;
        sendJson(response, 200, await store.list(ownerId));
        return;
      }

      const apiJob = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)$/i);
      if (request.method === "GET" && apiJob) {
        const job = await store.get(apiJob[1]!);
        if (!job) return sendJson(response, 404, { error: "job_not_found" });
        sendJson(response, 200, job);
        return;
      }
      const pageJob = url.pathname.match(/^\/jobs\/([0-9a-f-]+)$/i);
      if (request.method === "GET" && pageJob) {
        const job = await store.get(pageJob[1]!);
        if (!job) {
          response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          response.end("Job not found\n");
          return;
        }
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderJobHtml(job));
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 400, { error: "invalid_request", message: error instanceof Error ? error.message : String(error) });
    }
  };
}
