import type { IncomingMessage, ServerResponse } from "node:http";
import type { VerificationJson } from "../../../packages/core/src/model.ts";
import {
  ARD_MAX_REQUEST_BODY_BYTES,
  ArdAdapterError,
  createLocalCatalog,
  createAegisOneArdCatalogManifest,
  type LocalCatalogRecord,
} from "../../../packages/discovery-ard/src/index.ts";
import {
  GITHUB_AGENT_FINDER_PROVIDER_ID,
  HUGGING_FACE_DISCOVER_PROVIDER_ID,
  MCP_OFFICIAL_REGISTRY_PROVIDER_ID,
  createGithubAgentFinderProvider,
  createHuggingFaceDiscoverProvider,
  createMcpOfficialRegistryProvider,
  type DiscoveryProvider,
} from "../../../packages/discovery-providers/src/index.ts";
import type { ArtifactKind, JobStore, NewVerificationJob, VerificationJob } from "../../../packages/job-store/src/index.ts";
import type { SkillVerificationResult } from "../../../packages/skill-audit/src/model.ts";
import { InMemoryCatalogStore, type CatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { createGithubSourceAuthConfigFromEnv, type GithubSourceAuthConfig } from "../../../packages/source-auth-github/src/index.ts";
import { createZeroGComputeConfigFromEnv, type ZeroGComputeConfig } from "../../../packages/compute-0g/src/index.ts";
import { createApiV1Router, buildEvidenceResponse, loadAssembledResource, readJsonBody, toResourceApiResponse } from "./api-v1.ts";
import { createSourceAuthRouter } from "./source-auth.ts";
import { createMcpRequestHandler } from "./mcp.ts";
import { ProductRequestError } from "./errors.ts";
import { FixedWindowRateLimiter } from "./rate-limit.ts";
import { performCapabilitySearch } from "./search-service.ts";
import type { AdvisoryScanTransport } from "../../../packages/compute-0g/src/index.ts";
import { renderSkillVerificationHtml } from "./render-skill.ts";
import { renderVerificationHtml } from "./render.ts";
import { isStaticAssetPath, serveStaticAsset } from "./static-assets.ts";
import { renderSkillsPageHtml } from "./pages/skills.ts";
import { renderVerifiedPageHtml } from "./pages/verified.ts";
import { renderAgentsPageHtml } from "./pages/agents.ts";
import { renderResourcePageHtml, renderResourceNotFoundHtml } from "./pages/resource.ts";
import { renderSourceClaimPageHtml } from "./pages/source-claim.ts";
import { renderScanPageHtml } from "./pages/scan.ts";
import { seedDemoCatalog, type DemoSeedResult } from "./demo-seed.ts";
import { SkillLibraryLoader, type SkillLibrary } from "./library.ts";
import {
  callWorkerOverHttp,
  publishTriggerConfigFromEnv,
  publishTriggerEnabled,
  runPublishTrigger,
  PublishTriggerError,
  PUBLISH_RATE_LIMIT,
  PUBLISH_RATE_WINDOW_MS,
  type PublishTriggerConfig,
  type WorkerPublishResponse,
} from "./publish-trigger.ts";
import {
  M5_MAINNET_RECORD,
  M5_MAINNET_REGISTRY,
  M5_MAINNET_TX,
  M5_STORAGE_ROOT,
  M5_STORAGE_TX,
  M7_GALILEO_RECORD,
  M7_GALILEO_TX,
  M7_SKILL_DIGEST,
  M7_SKILL_TAMPER_DIGEST,
  M7_SOURCE_COMMIT,
  M7_STORAGE_ROOT,
  M7_STORAGE_TX,
  SOFTWARE_DIGEST,
  SOFTWARE_TAMPER_DIGEST,
} from "./live-evidence.ts";

const DEFAULT_PUBLIC_BASE_URL = "https://proofrail-app-production.up.railway.app";

export interface ProductRequestHandlerOptions {
  publicBaseUrl?: string;
  localCatalog?: readonly LocalCatalogRecord[];
  /** Overridable for tests; defaults to the two M8.3 real discovery providers. */
  discoveryProviders?: ReadonlyMap<string, DiscoveryProvider>;
  /** M8.5: source-claim persistence. Defaults to an in-memory store for local/test use;
   * production must pass a `SupabaseCatalogStore` (see `createCatalogStoreFromEnv`). */
  catalogStore?: CatalogStore;
  /** M8.5: GitHub App OAuth config. `null`/omitted means the GitHub App has not been created
   * yet — `/auth/github/*` and the repository-listing endpoint respond `503`, while DECLARED
   * source claims (`POST /api/v1/source-claims` without an authenticated session) still work. */
  githubSourceAuthConfig?: GithubSourceAuthConfig | null;
  /** Set false only for local http development/tests; production must keep cookies Secure. */
  secureSourceAuthCookies?: boolean;
  /** Overridable for tests; forwarded to the source-auth router's GitHub REST calls. */
  githubFetcher?: typeof fetch;
  /** New paste-to-scan feature. `null`/omitted means no `ZEROG_COMPUTE_PRIVATE_KEY` is
   * configured — `includeAdvisoryScan: true` then always returns an explicit
   * `advisory_unavailable` state rather than silently skipping. */
  zeroGComputeConfig?: ZeroGComputeConfig | null;
  /** Test-only override for the real (untested-live) 0G Compute transport. */
  advisoryTransport?: AdvisoryScanTransport;
  /** Paste-to-scan Tier-1 (deterministic) rate limit: requests per IP per window
   * (docs/17-m8-security-boundaries.md, new "Paste-to-scan limits" section). Overridable for
   * tests only. */
  scanRateLimiter?: FixedWindowRateLimiter;
  /** Paste-to-scan Tier-2 (0G Compute advisory) rate limit — deliberately much stricter than the
   * Tier-1 limiter since it can trigger real (if bounded) compute work. Overridable for tests
   * only. */
  advisoryRateLimiter?: FixedWindowRateLimiter;
  /** Operator evidence-publication configuration. Omitted reads the environment; every field must
   * be present for `POST /api/v1/publish` to exist at all. */
  publishConfig?: PublishTriggerConfig;
  /** Independent limiter for the funded publication route. Overridable for tests only. */
  publishRateLimiter?: FixedWindowRateLimiter;
  /** Test-only override for the real worker call, so the whole trigger is exercisable without a
   * worker, a network, or any 0G spend. */
  callPublishWorker?: (body: unknown, config: PublishTriggerConfig) => Promise<WorkerPublishResponse>;
}

/** Rate-limit key for the funded publication route. Uses the socket peer address for the same
 * reason `api-v1.ts` does: `x-forwarded-for` is caller-spoofable unless a trusted proxy is
 * guaranteed to rewrite it. */
function clientRateLimitKey(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown";
}

function defaultDiscoveryProviders(): ReadonlyMap<string, DiscoveryProvider> {
  return new Map([
    [GITHUB_AGENT_FINDER_PROVIDER_ID, createGithubAgentFinderProvider()],
    [HUGGING_FACE_DISCOVER_PROVIDER_ID, createHuggingFaceDiscoverProvider()],
    [MCP_OFFICIAL_REGISTRY_PROVIDER_ID, createMcpOfficialRegistryProvider()],
  ]);
}

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
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    const declaredSize = Number(contentLength);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
      throw new ProductRequestError("invalid_request", "Invalid Content-Length header");
    }
    if (declaredSize > limit) {
      throw new ProductRequestError("request_too_large", `Request body exceeds the ${limit}-byte limit`, 413);
    }
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new ProductRequestError("request_too_large", `Request body exceeds the ${limit}-byte limit`, 413);
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireJsonContentType(request: IncomingMessage): void {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ProductRequestError("invalid_request", "Content-Type must be application/json", 415);
  }
}

function requiredPathSegmentForPage(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ProductRequestError("invalid_request", "path segment was not valid percent-encoding");
  }
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
  const githubUrl = "https://github.com/Ollie202/aegisone";
  const m5MainnetTxUrl = `https://chainscan.0g.ai/tx/${M5_MAINNET_TX}`;
  const m5RegistryUrl = `https://chainscan.0g.ai/address/${M5_MAINNET_REGISTRY}`;
  const m5StorageTxUrl = `https://chainscan-galileo.0g.ai/tx/${M5_STORAGE_TX}`;
  const m7StorageTxUrl = `https://chainscan-galileo.0g.ai/tx/${M7_STORAGE_TX}`;
  const m7RegistryTxUrl = `https://chainscan-galileo.0g.ai/tx/${M7_GALILEO_TX}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#070b12">
<title>AegisOne — independently verify the bytes</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eef2f7;background:#070b12;line-height:1.5}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0%,#172554 0,transparent 30rem),#070b12;color:#eef2f7}a{color:inherit}.shell{max-width:1120px;margin:0 auto;padding:28px 22px 80px}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:72px}.brand{font-weight:900;letter-spacing:-.04em;font-size:20px}.navlinks{display:flex;gap:10px;flex-wrap:wrap}.button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:1px solid #334155;background:#0f172a;padding:10px 14px;border-radius:12px;font-weight:750;font-size:13px}.button.primary{background:#eef2ff;color:#111827;border-color:#eef2ff}.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid #1e3a5f;background:#0c1727;color:#9ed0ff;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:850;letter-spacing:.08em}.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px #22c55e20}.hero{max-width:850px}.hero h1{font-size:clamp(48px,8vw,86px);line-height:.97;letter-spacing:-.07em;margin:20px 0 22px}.hero p{font-size:clamp(18px,2.4vw,24px);line-height:1.5;color:#aab6c7;max-width:760px}.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.section{margin-top:76px}.sectionHead{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.sectionHead h2{font-size:28px;letter-spacing:-.04em;margin:0}.sectionHead p{color:#8fa0b5;margin:0;max-width:540px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{border:1px solid #1f2a3a;background:linear-gradient(180deg,#0d1420,#0a1019);border-radius:20px;padding:24px}.card h3{font-size:17px;margin:0 0 8px}.muted{color:#8fa0b5}.resultCard{position:relative;overflow:hidden}.resultCard.match{box-shadow:inset 0 1px #22c55e66}.resultCard.mismatch{box-shadow:inset 0 1px #ef444466}.badge{display:inline-flex;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;letter-spacing:.08em}.badge.match{background:#052e1b;color:#86efac;border:1px solid #166534}.badge.mismatch{background:#3f1014;color:#fca5a5;border:1px solid #7f1d1d}.badge.info{background:#12233f;color:#bfdbfe;border:1px solid #1d4ed8}.hashBlock{margin-top:18px;border-top:1px solid #1f2a3a;padding-top:14px}.hashRow{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;padding:7px 0;align-items:start}.hashRow span{color:#7f8ea3;font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:.05em}.hashRow code,code.hash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;color:#d9e2ef}.arrow{color:#64748b;padding:3px 0}.proofline{display:grid;grid-template-columns:34px minmax(0,1fr);gap:14px;padding:18px 0;border-bottom:1px solid #1f2a3a}.proofline:last-child{border-bottom:0}.step{width:34px;height:34px;border-radius:10px;background:#111c2e;border:1px solid #2b3b52;display:grid;place-items:center;font-weight:900;color:#93c5fd}.proofline strong{display:block;margin-bottom:4px}.proofline p{margin:0;color:#8fa0b5}.evidenceLinks{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.evidenceLinks a{font-size:12px;color:#bfdbfe;text-decoration:none;border-bottom:1px solid #3b82f666}.skillGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}.metric{font-size:34px;letter-spacing:-.05em;font-weight:900}.metricLabel{color:#8fa0b5;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:800}.warning{border-left:3px solid #f59e0b;padding-left:14px;color:#cbd5e1}.architecture{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#05080d;border:1px solid #1d2939;padding:18px;border-radius:14px;white-space:pre-wrap;color:#b8c3d1;font-size:13px}.foot{margin-top:74px;padding-top:24px;border-top:1px solid #1f2a3a;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;color:#718096;font-size:12px}
@media(max-width:760px){.shell{padding:20px 16px 56px}.nav{margin-bottom:48px;align-items:flex-start}.navlinks .button:not(.primary){display:none}.grid2,.skillGrid{grid-template-columns:1fr}.section{margin-top:54px}.sectionHead{display:block}.sectionHead p{margin-top:8px}.card{padding:19px}.hashRow{grid-template-columns:86px minmax(0,1fr)}.hero h1{font-size:50px}.hero p{font-size:18px}.cta .button{width:100%}.foot{display:block}}
</style>
</head>
<body>
<main class="shell">
  <nav class="nav"><div class="brand">AegisOne</div><div class="navlinks"><a class="button" href="${githubUrl}">GitHub</a><a class="button primary" href="#proof">See the proof</a></div></nav>

  <section class="hero">
    <span class="eyebrow"><span class="dot"></span> LIVE PROOF · M1–M7 COMPLETE</span>
    <h1>Don’t trust the release. Rebuild it.</h1>
    <p>AegisOne independently reproduces software and Agent Skills from an exact publisher-declared source commit, compares the resulting bytes, and preserves the evidence on 0G.</p>
    <div class="cta"><a class="button primary" href="#proof">Watch the tamper check</a><a class="button" href="${m5MainnetTxUrl}">Open real mainnet anchor</a><a class="button" href="${githubUrl}/blob/main/hackathon/evidence.md">Evidence ledger</a></div>
  </section>

  <section class="section" id="proof">
    <div class="sectionHead"><div><span class="eyebrow">THE CORE CLAIM</span><h2>Same source. Independent rebuild. Exact bytes.</h2></div><p>The verdict comes from digest equality. The database, UI and any LLM are not allowed to manufacture it.</p></div>
    <div class="grid2">
      <article class="card resultCard match"><span class="badge match">MATCH</span><h3 style="margin-top:14px">Genuine publisher artifact</h3><p class="muted">The independently reproduced 0G artifact is byte-for-byte identical to the publisher artifact.</p><div class="hashBlock"><div class="hashRow"><span>Publisher</span><code>${SOFTWARE_DIGEST}</code></div><div class="arrow">↓ independent 0G rebuild</div><div class="hashRow"><span>Reproduced</span><code>${SOFTWARE_DIGEST}</code></div></div></article>
      <article class="card resultCard mismatch"><span class="badge mismatch">MISMATCH</span><h3 style="margin-top:14px">One-byte substitution</h3><p class="muted">The public source can remain unchanged while the distributed file is replaced. AegisOne catches the changed bytes.</p><div class="hashBlock"><div class="hashRow"><span>Publisher</span><code>${SOFTWARE_TAMPER_DIGEST}</code></div><div class="arrow">↓ same independent rebuild</div><div class="hashRow"><span>Reproduced</span><code>${SOFTWARE_DIGEST}</code></div></div></article>
    </div>
  </section>

  <section class="section">
    <div class="sectionHead"><div><span class="eyebrow">AGENT SKILLS</span><h2>Provenance and safety are separate questions.</h2></div><p>A skill can correspond exactly to source and still contain dangerous instructions. MATCH never means safe.</p></div>
    <div class="skillGrid">
      <article class="card"><div class="grid2"><div><span class="badge match">MATCH</span><h3 style="margin-top:14px">Clean-review skill package</h3><div class="hashRow"><span>Package</span><code>${M7_SKILL_DIGEST}</code></div></div><div><span class="badge mismatch">MISMATCH</span><h3 style="margin-top:14px">Controlled substitution</h3><div class="hashRow"><span>Changed</span><code>${M7_SKILL_TAMPER_DIGEST}</code></div></div></div><p class="muted">Exact source commit: <code class="hash">${M7_SOURCE_COMMIT}</code></p></article>
      <article class="card"><div class="metricLabel">Deterministic static audit</div><div class="metric">0 findings</div><p class="muted">Highest severity: INFO. LLM advisory: NOT_RUN.</p><p class="warning">This audit result is independent of correspondence. AegisOne never rewrites MATCH/MISMATCH because of a security score.</p></article>
    </div>
  </section>

  <section class="section">
    <div class="sectionHead"><div><span class="eyebrow">REAL 0G EVIDENCE</span><h2>A judge can follow the proof off this page.</h2></div><p>These are the recorded roots, records and transactions from the successful live runs—not demo placeholders.</p></div>
    <article class="card">
      <div class="proofline"><div class="step">1</div><div><strong>Independent execution</strong><p>Exact immutable source is reproduced through 0G Sandbox. The Agent Skill run resolved commit <code class="hash">${M7_SOURCE_COMMIT}</code>.</p></div></div>
      <div class="proofline"><div class="step">2</div><div><strong>Canonical evidence → 0G Storage</strong><p>Software root: <code class="hash">${M5_STORAGE_ROOT}</code><br>Agent Skill root: <code class="hash">${M7_STORAGE_ROOT}</code></p><div class="evidenceLinks"><a href="${m5StorageTxUrl}">Software Storage tx ↗</a><a href="${m7StorageTxUrl}">Agent Skill Storage tx ↗</a></div></div></div>
      <div class="proofline"><div class="step">3</div><div><strong>Agent Skill commitments → Galileo registry</strong><p>Record: <code class="hash">${M7_GALILEO_RECORD}</code></p><div class="evidenceLinks"><a href="${m7RegistryTxUrl}">Galileo registration tx ↗</a><a href="${githubUrl}/blob/main/hackathon/m7-live-evidence.json">Structured M7 evidence ↗</a></div></div></div>
      <div class="proofline"><div class="step">4</div><div><strong>Software vertical slice → 0G Aristotle mainnet</strong><p>Registry: <code class="hash">${M5_MAINNET_REGISTRY}</code><br>Record: <code class="hash">${M5_MAINNET_RECORD}</code></p><div class="evidenceLinks"><a href="${m5RegistryUrl}">Mainnet registry ↗</a><a href="${m5MainnetTxUrl}">Mainnet registration tx ↗</a><a href="${githubUrl}/blob/main/hackathon/m5-aristotle-mainnet.json">Structured mainnet evidence ↗</a></div></div></div>
    </article>
  </section>

  <section class="section">
    <div class="grid2">
      <article class="card"><span class="badge info">TEE BOUNDARY</span><h3 style="margin-top:14px">Provider evidence only</h3><p class="muted">The live TDX quote proves provider/runtime evidence, but the artifact digest is not cryptographically bound into the quote and the artifact is not proven to have been computed inside the TEE. AegisOne labels that limitation instead of overstating it.</p></article>
      <article class="card"><span class="badge info">MAINNET BOUNDARY</span><h3 style="margin-top:14px">M7 is PREPARED_NOT_SUBMITTED</h3><p class="muted">M5 proves the Aristotle mainnet registry path. M7 derives the Agent Skill commitments but deliberately does not claim a second mainnet registration.</p></article>
    </div>
  </section>

  <section class="section">
    <div class="sectionHead"><div><span class="eyebrow">TRUST ARCHITECTURE</span><h2>Mutable product state never becomes proof authority.</h2></div></div>
    <div class="architecture">Supabase         = mutable job/app memory
proofrail-app    = API/UI and evidence presentation
proofrail-worker = controlled secret-bearing worker
0G Sandbox       = independent reproduction
0G Storage       = durable canonical evidence
0G Chain         = immutable compact commitments</div>
    <p class="muted">A cached result is rendered only after AegisOne’s integrity-checked projection accepts the canonical verification evidence.</p>
  </section>

  <footer class="foot"><span>AegisOne · independently verify the bytes</span><span><a href="${githubUrl}">public source</a> · <a href="${githubUrl}/blob/main/hackathon/evidence.md">evidence ledger</a></span></footer>
</main>
</body>
</html>`;
}

export function renderJobHtml(job: VerificationJob): string {
  if (job.verificationJson) {
    if (job.artifactKind === "agent-skill") return renderSkillVerificationHtml(job.verificationJson as SkillVerificationResult);
    return renderVerificationHtml(job.verificationJson as VerificationJson);
  }
  const failure = job.failure ? `<p><strong>${escapeHtml(job.failure.code)}</strong>: ${escapeHtml(job.failure.message)}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AegisOne job</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;background:#f7f7f5}body{margin:0}.shell{max-width:860px;margin:0 auto;padding:48px 20px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:26px}.row{padding:9px 0;border-bottom:1px solid #f0f1f2}.row:last-child{border:0}code{font-size:12px;word-break:break-all}p{color:#4b5563}</style></head><body><main class="shell"><h1>Verification job</h1><div class="card"><div class="row">Pipeline status: <strong>${escapeHtml(job.status)}</strong></div><div class="row">Artifact kind: <strong>${escapeHtml(job.artifactKind)}</strong></div><div class="row">Project: <strong>${escapeHtml(job.projectId)}</strong></div><div class="row">Repository: <code>${escapeHtml(job.sourceRepository)}</code></div><div class="row">Commit: <code>${escapeHtml(job.sourceCommitSha)}</code></div>${failure}</div><p>No correspondence verdict is shown until canonical verification evidence is available and passes AegisOne integrity checks.</p></main></body></html>`;
}

export function createProductRequestHandler(store: JobStore, options: ProductRequestHandlerOptions = {}) {
  const publicBaseUrl = options.publicBaseUrl ?? process.env.PROOFRAIL_PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL;
  const localCatalog = options.localCatalog ?? createLocalCatalog();
  const catalogManifest = createAegisOneArdCatalogManifest(publicBaseUrl);
  const searchSource = `${publicBaseUrl.replace(/\/+$/, "")}/search`;
  const discoveryProviders = options.discoveryProviders ?? defaultDiscoveryProviders();
  const catalogStore = options.catalogStore ?? new InMemoryCatalogStore();
  const githubSourceAuthConfig = options.githubSourceAuthConfig !== undefined
    ? options.githubSourceAuthConfig
    : createGithubSourceAuthConfigFromEnv();
  const sourceAuthRouter = createSourceAuthRouter({
    githubConfig: githubSourceAuthConfig,
    catalogStore,
    secureCookies: options.secureSourceAuthCookies,
    fetcher: options.githubFetcher,
  });
  // Paste-to-scan (new feature): Tier-1 (deterministic) is far more permissive than Tier-2 (0G
  // Compute advisory), which can trigger real (if bounded/opt-in) compute work — see
  // docs/17-m8-security-boundaries.md's new "Paste-to-scan limits" section for the documented
  // bounds and rationale. Single shared limiter instances per server process (docs/17 Threat
  // M8-005 "verification spend abuse").
  const zeroGComputeConfig = options.zeroGComputeConfig !== undefined ? options.zeroGComputeConfig : createZeroGComputeConfigFromEnv();
  const scanDeps = {
    zeroGComputeConfig,
    advisoryTransport: options.advisoryTransport,
    scanRateLimiter: options.scanRateLimiter ?? new FixedWindowRateLimiter(60, 10 * 60 * 1000),
    advisoryRateLimiter: options.advisoryRateLimiter ?? new FixedWindowRateLimiter(5, 60 * 60 * 1000),
  };
  const apiV1Router = createApiV1Router(catalogStore, scanDeps);
  // M8.8/paste-to-scan: the MCP transport adapter is constructed with the exact same catalog
  // store, local catalog, search source, discovery providers, and scan dependencies this handler
  // wires into `apiV1Router`/`POST /search`/`POST /api/v1/scan` above — every MCP tool calls the
  // same application services, never a second search engine, policy evaluator, scan pipeline, or
  // evidence interpretation (docs/17-m8-security-boundaries.md Threat M8-018).
  const mcpRequestHandler = createMcpRequestHandler({ catalogStore, localCatalog, searchSource, discoveryProviders, scanDeps });

  // M9: a lazily-seeded, in-process demo-fixture resource (docs/18 "Judge demo mode",
  // apps/web/src/demo-seed.ts). Seeded on first access to `/?demo=1` or `/resources/:id?demo=1`
  // so a demoless deployment/test never pays this cost, and any seeding failure degrades to
  // "demo unavailable" rather than crashing the app.
  let demoSeedPromise: Promise<DemoSeedResult> | null = null;
  function ensureDemoSeeded(): Promise<DemoSeedResult> {
    if (!demoSeedPromise) {
      demoSeedPromise = seedDemoCatalog(catalogStore).catch((error) => {
        demoSeedPromise = null;
        throw error;
      });
    }
    return demoSeedPromise;
  }

  // ADR-016 SKILLS section: the human skill library, lazily seeded on first access exactly like
  // the demo fixture above, and reading its evidence back through the same `loadAssembledResource`
  // path `/api/v1/resources/:id` uses. A seeding/loading failure degrades to an empty library —
  // never to fabricated rows.
  const libraryLoader = new SkillLibraryLoader(catalogStore);
  // Operator publication configuration and its own strict, independent limiter (docs/17 Threat
  // M8-005). Separate from every other limiter in this handler on purpose: a funded action must
  // not share a budget with free read traffic.
  const publishConfig = options.publishConfig ?? publishTriggerConfigFromEnv();
  const publishLimiter = options.publishRateLimiter ?? new FixedWindowRateLimiter(PUBLISH_RATE_LIMIT, PUBLISH_RATE_WINDOW_MS);
  async function loadLibrarySafely(): Promise<SkillLibrary> {
    try {
      return await libraryLoader.load();
    } catch {
      return { entries: [], counts: {}, categories: [] };
    }
  }

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const base = `http://${request.headers.host ?? "localhost"}`;
      const url = new URL(request.url ?? "/", base);

      if (request.method === "GET" && isStaticAssetPath(url.pathname)) {
        await serveStaticAsset(url.pathname, response);
        return;
      }

      if (await sourceAuthRouter(request, response, url)) return;
      if (await apiV1Router(request, response, url)) return;

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { ok: true, service: "aegisone", mode: "product" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/.well-known/ai-catalog.json") {
        sendJson(response, 200, catalogManifest);
        return;
      }
      if (request.method === "POST" && url.pathname === "/search") {
        requireJsonContentType(request);
        const rawBody = await readJson(request, ARD_MAX_REQUEST_BODY_BYTES);
        sendJson(response, 200, await performCapabilitySearch(rawBody, { localCatalog, searchSource, discoveryProviders }));
        return;
      }
      if (url.pathname === "/mcp") {
        if (request.method === "POST") {
          await mcpRequestHandler(request, response);
          return;
        }
        // Stateless Streamable HTTP (no server-initiated notifications needed by these
        // read/policy-only tools): only POST JSON-RPC request/response is supported, matching the
        // MCP SDK's documented stateless server pattern.
        sendJson(response, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
        return;
      }
      // M9: `/proof` preserves the pre-existing M1-M7 dark "proof-first" landing page (real M5
      // mainnet + M7 live-evidence content) unchanged (ADR-013). `/` now serves the new M9 Hub
      // search page, per docs/18-m9-frontend-plan.md "Primary pages" #1.
      if (request.method === "GET" && (url.pathname === "/proof" || url.pathname === "/index.html")) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderProductHomeHtml());
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        const query = url.searchParams.get("q") ?? "";
        const wantsDemo = url.searchParams.get("demo") === "1";
        let searchResponse: unknown | null = null;
        let searchError: string | null = null;
        if (query.trim() !== "") {
          try {
            searchResponse = await performCapabilitySearch({ query: { text: query } }, { localCatalog, searchSource, discoveryProviders });
          } catch (error) {
            searchError = error instanceof Error ? error.message : String(error);
          }
        }
        let demoResourceId: string | null = null;
        if (wantsDemo) {
          try {
            demoResourceId = (await ensureDemoSeeded()).resourceId;
          } catch {
            demoResourceId = null;
          }
        }
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderSkillsPageHtml({
          query,
          searchResponse,
          searchError,
          library: await loadLibrarySafely(),
          demoAvailable: wantsDemo && demoResourceId !== null,
          demoResourceId,
        }));
        return;
      }

      // ADR-016 sections 3 and 4. Both are real, working pages today — see their module headers
      // for exactly which parts are live and which are explicitly still to come.
      if (request.method === "GET" && url.pathname === "/verified") {
        let demoResourceId: string | null = null;
        try {
          demoResourceId = (await ensureDemoSeeded()).resourceId;
        } catch {
          demoResourceId = null;
        }
        // Same loader, same integrity-checked assembly as `/`. The Verified Library never reads a
        // catalog row directly, so it cannot present a state the API would not also present.
        const library = await loadLibrarySafely();
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderVerifiedPageHtml({
          entries: library.entries,
          demoResourceId,
          publicationConfigured: publishTriggerEnabled(publishConfig),
        }));
        return;
      }

      /**
       * Operator-only evidence publication (see `publish-trigger.ts` for why this is not an
       * end-user action). Absent entirely unless the operator token, worker URL and worker
       * internal token are all configured — an unconfigured deployment 404s here exactly like an
       * unknown path, so there is never a present-but-unauthenticated funded endpoint.
       */
      if (request.method === "POST" && url.pathname === "/api/v1/publish" && publishTriggerEnabled(publishConfig)) {
        try {
          requireJsonContentType(request);
          const body = await readJsonBody(request, 4 * 1024);
          const resourceId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).resourceId : undefined;
          if (typeof resourceId !== "string" || resourceId.length === 0) {
            response.writeHead(400, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
            response.end(JSON.stringify({ error: "invalid_request", message: "resourceId is required" }));
            return;
          }
          const header = request.headers.authorization;
          const operatorToken = typeof header === "string" ? /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? null : null;
          const result = await runPublishTrigger(catalogStore, {
            resourceId,
            operatorToken,
            rateLimitKey: clientRateLimitKey(request),
          }, {
            config: publishConfig,
            limiter: publishLimiter,
            callWorker: options.callPublishWorker ?? callWorkerOverHttp,
            loadPackageBytes: (id) => libraryLoader.packageBytesFor(id),
            loadAuditReport: (id) => libraryLoader.auditReportFor(id),
          });
          response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          response.end(JSON.stringify({ ok: true, ...result }));
        } catch (error) {
          if (error instanceof PublishTriggerError) {
            response.writeHead(error.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
            response.end(JSON.stringify({ error: error.code, message: error.message }));
            return;
          }
          throw error;
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/agents") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderAgentsPageHtml({ publicBaseUrl, advisoryConfigured: zeroGComputeConfig !== null }));
        return;
      }

      const resourcePageMatch = url.pathname.match(/^\/resources\/([^/]+)$/);
      if (request.method === "GET" && resourcePageMatch) {
        let resourceId = requiredPathSegmentForPage(resourcePageMatch[1]!);
        let isDemo = url.searchParams.get("demo") === "1";
        if (isDemo) {
          try {
            resourceId = (await ensureDemoSeeded()).resourceId;
          } catch {
            isDemo = false;
          }
        }
        const assembled = await loadAssembledResource(catalogStore, resourceId);
        if (!assembled) {
          response.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
          response.end(renderResourceNotFoundHtml(resourceId));
          return;
        }
        const evidenceApi = await buildEvidenceResponse(catalogStore, resourceId);
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderResourcePageHtml({
          resourceApi: toResourceApiResponse(assembled),
          evidenceApi: evidenceApi!,
          isDemo,
        }));
        return;
      }

      // Paste-to-scan page: the human-facing surface for the same `POST /api/v1/scan` service the
      // `aegisone_scan` MCP tool calls. Read-only SSR shell; the submit itself is a browser
      // `fetch` to that route (see `apps/web/public/app.js`).
      // ADR-016 section 2 (AUDIT). `/audit` is its nav home; `/scan` is the original URL and keeps
      // working byte-identically so nothing that already links to it breaks.
      if (request.method === "GET" && (url.pathname === "/audit" || url.pathname === "/scan")) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderScanPageHtml({ advisoryConfigured: zeroGComputeConfig !== null }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/source/claim") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderSourceClaimPageHtml({ githubConfigured: githubSourceAuthConfig !== null }));
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
      if (error instanceof ArdAdapterError || error instanceof ProductRequestError) {
        sendJson(response, error.statusCode, {
          error: error.code,
          errorCode: error.code.toUpperCase(),
          message: error.message,
        });
        return;
      }
      sendJson(response, 400, {
        error: "invalid_request",
        errorCode: "INVALID_REQUEST",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
