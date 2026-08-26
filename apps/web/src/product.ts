import type { IncomingMessage, ServerResponse } from "node:http";
import type { VerificationJson } from "../../../packages/core/src/model.ts";
import {
  ARD_DEFAULT_PAGE_SIZE,
  ARD_MAX_PAGE_SIZE,
  ARD_MAX_QUERY_CODE_POINTS,
  ARD_MAX_REQUEST_BODY_BYTES,
  ARD_MEDIA_TYPE_TO_RESOURCE_KIND,
  ArdAdapterError,
  createLocalCatalog,
  createProofRailArdCatalogManifest,
  parseArdSearchRequest,
  searchLocalCatalog,
  type ArdResourceMediaType,
  type LocalCatalogRecord,
} from "../../../packages/discovery-ard/src/index.ts";
import {
  GITHUB_AGENT_FINDER_PROVIDER_ID,
  HUGGING_FACE_DISCOVER_PROVIDER_ID,
  createGithubAgentFinderProvider,
  createHuggingFaceDiscoverProvider,
  federatedDiscoverySearch,
  type DiscoveryProvider,
  type DiscoveryQuery,
} from "../../../packages/discovery-providers/src/index.ts";
import type { ArtifactKind, JobStore, NewVerificationJob, VerificationJob } from "../../../packages/job-store/src/index.ts";
import type { SkillVerificationResult } from "../../../packages/skill-audit/src/model.ts";
import { InMemoryCatalogStore, type CatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { createGithubSourceAuthConfigFromEnv, type GithubSourceAuthConfig } from "../../../packages/source-auth-github/src/index.ts";
import { createSourceAuthRouter } from "./source-auth.ts";
import { renderSkillVerificationHtml } from "./render-skill.ts";
import { renderVerificationHtml } from "./render.ts";

const SOFTWARE_DIGEST = "9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154";
const SOFTWARE_TAMPER_DIGEST = "d5318963f53126b4c4bd448bffca222a8e08f068764e379516fc0ad3bd1f8889";
const M5_STORAGE_ROOT = "0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181";
const M5_STORAGE_TX = "0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6";
const M5_MAINNET_REGISTRY = "0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4";
const M5_MAINNET_RECORD = "0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e";
const M5_MAINNET_TX = "0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac";
const M7_SOURCE_COMMIT = "2f193aad92d2f807c2e25f67eb28c5090fa945cf";
const M7_SKILL_DIGEST = "fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878";
const M7_SKILL_TAMPER_DIGEST = "da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb";
const M7_STORAGE_ROOT = "0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66";
const M7_STORAGE_TX = "0x59a63ddf1d2d985b947e7829ec6a47c19760870ed066558123cf817d19fe063d";
const M7_GALILEO_RECORD = "0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a";
const M7_GALILEO_TX = "0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db";
const DEFAULT_PUBLIC_BASE_URL = "https://proofrail-app-production.up.railway.app";

class ProductRequestError extends Error {
  readonly code: "invalid_request" | "request_too_large";
  readonly statusCode: number;

  constructor(code: "invalid_request" | "request_too_large", message: string, statusCode = 400) {
    super(message);
    this.name = "ProductRequestError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

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
}

function defaultDiscoveryProviders(): ReadonlyMap<string, DiscoveryProvider> {
  return new Map([
    [GITHUB_AGENT_FINDER_PROVIDER_ID, createGithubAgentFinderProvider()],
    [HUGGING_FACE_DISCOVER_PROVIDER_ID, createHuggingFaceDiscoverProvider()],
  ]);
}

/**
 * Parses the federated (non-local) `POST /search` request shape. Unlike `parseArdSearchRequest`
 * (M8.2, local catalog only, `federation` must be `"none"`), this accepts `federation` as a
 * non-empty array of registered provider ids and federates the query across them in parallel.
 * Federated results are provider-independent `CapabilityResource` objects, not the M8.2 local
 * `ArdEntry` shape: federated entries come from providers that do not follow ProofRail's own
 * `urn:air:` outbound catalog identifier convention, so they are not re-encoded as ArdEntry.
 */
function parseFederatedSearchRequest(body: unknown, providers: ReadonlyMap<string, DiscoveryProvider>): { query: DiscoveryQuery; providerIds: string[] } {
  if (!isObject(body)) throw new ProductRequestError("invalid_request", "request body must be a JSON object");
  if (!isObject(body.query) || typeof body.query.text !== "string" || body.query.text.trim() === "") {
    throw new ProductRequestError("invalid_request", "query.text is required");
  }
  const text = body.query.text.trim();
  if ([...text].length > ARD_MAX_QUERY_CODE_POINTS) {
    throw new ProductRequestError("invalid_request", `query.text must be at most ${ARD_MAX_QUERY_CODE_POINTS} Unicode characters`);
  }

  let mediaTypes: ArdResourceMediaType[] | null = null;
  const filter = body.query.filter;
  if (filter !== undefined) {
    if (!isObject(filter)) throw new ProductRequestError("invalid_request", "query.filter must be a JSON object");
    if (filter.type !== undefined) {
      const values = typeof filter.type === "string" ? [filter.type] : filter.type;
      if (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== "string" || item.trim() === "")) {
        throw new ProductRequestError("invalid_request", "query.filter.type must be a non-empty string or array of non-empty strings");
      }
      for (const mediaType of values) {
        if (!Object.hasOwn(ARD_MEDIA_TYPE_TO_RESOURCE_KIND, mediaType)) {
          throw new ProductRequestError("invalid_request", `query.filter.type does not support media type: ${mediaType}`);
        }
      }
      mediaTypes = [...new Set(values)] as ArdResourceMediaType[];
    }
  }

  const pageSize = body.pageSize ?? ARD_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > ARD_MAX_PAGE_SIZE) {
    throw new ProductRequestError("invalid_request", `pageSize must be an integer from 1 to ${ARD_MAX_PAGE_SIZE}`);
  }

  const federation = body.federation;
  if (!Array.isArray(federation) || federation.length === 0 || federation.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new ProductRequestError("invalid_request", 'federation must be "none" or a non-empty array of provider ids');
  }
  const providerIds = [...new Set(federation as string[])];
  for (const id of providerIds) {
    if (!providers.has(id)) {
      throw new ProductRequestError("invalid_request", `unsupported federation provider id: ${id}. supported: ${[...providers.keys()].sort().join(", ")}`);
    }
  }

  return { query: { text, mediaTypes, pageSize: pageSize as number }, providerIds };
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
  const githubUrl = "https://github.com/Ollie202/proofrail-0g";
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
<title>ProofRail — independently verify the bytes</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eef2f7;background:#070b12;line-height:1.5}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0%,#172554 0,transparent 30rem),#070b12;color:#eef2f7}a{color:inherit}.shell{max-width:1120px;margin:0 auto;padding:28px 22px 80px}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:72px}.brand{font-weight:900;letter-spacing:-.04em;font-size:20px}.navlinks{display:flex;gap:10px;flex-wrap:wrap}.button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:1px solid #334155;background:#0f172a;padding:10px 14px;border-radius:12px;font-weight:750;font-size:13px}.button.primary{background:#eef2ff;color:#111827;border-color:#eef2ff}.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid #1e3a5f;background:#0c1727;color:#9ed0ff;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:850;letter-spacing:.08em}.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px #22c55e20}.hero{max-width:850px}.hero h1{font-size:clamp(48px,8vw,86px);line-height:.97;letter-spacing:-.07em;margin:20px 0 22px}.hero p{font-size:clamp(18px,2.4vw,24px);line-height:1.5;color:#aab6c7;max-width:760px}.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.section{margin-top:76px}.sectionHead{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.sectionHead h2{font-size:28px;letter-spacing:-.04em;margin:0}.sectionHead p{color:#8fa0b5;margin:0;max-width:540px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{border:1px solid #1f2a3a;background:linear-gradient(180deg,#0d1420,#0a1019);border-radius:20px;padding:24px}.card h3{font-size:17px;margin:0 0 8px}.muted{color:#8fa0b5}.resultCard{position:relative;overflow:hidden}.resultCard.match{box-shadow:inset 0 1px #22c55e66}.resultCard.mismatch{box-shadow:inset 0 1px #ef444466}.badge{display:inline-flex;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;letter-spacing:.08em}.badge.match{background:#052e1b;color:#86efac;border:1px solid #166534}.badge.mismatch{background:#3f1014;color:#fca5a5;border:1px solid #7f1d1d}.badge.info{background:#12233f;color:#bfdbfe;border:1px solid #1d4ed8}.hashBlock{margin-top:18px;border-top:1px solid #1f2a3a;padding-top:14px}.hashRow{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;padding:7px 0;align-items:start}.hashRow span{color:#7f8ea3;font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:.05em}.hashRow code,code.hash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;color:#d9e2ef}.arrow{color:#64748b;padding:3px 0}.proofline{display:grid;grid-template-columns:34px minmax(0,1fr);gap:14px;padding:18px 0;border-bottom:1px solid #1f2a3a}.proofline:last-child{border-bottom:0}.step{width:34px;height:34px;border-radius:10px;background:#111c2e;border:1px solid #2b3b52;display:grid;place-items:center;font-weight:900;color:#93c5fd}.proofline strong{display:block;margin-bottom:4px}.proofline p{margin:0;color:#8fa0b5}.evidenceLinks{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.evidenceLinks a{font-size:12px;color:#bfdbfe;text-decoration:none;border-bottom:1px solid #3b82f666}.skillGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}.metric{font-size:34px;letter-spacing:-.05em;font-weight:900}.metricLabel{color:#8fa0b5;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:800}.warning{border-left:3px solid #f59e0b;padding-left:14px;color:#cbd5e1}.architecture{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#05080d;border:1px solid #1d2939;padding:18px;border-radius:14px;white-space:pre-wrap;color:#b8c3d1;font-size:13px}.foot{margin-top:74px;padding-top:24px;border-top:1px solid #1f2a3a;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;color:#718096;font-size:12px}
@media(max-width:760px){.shell{padding:20px 16px 56px}.nav{margin-bottom:48px;align-items:flex-start}.navlinks .button:not(.primary){display:none}.grid2,.skillGrid{grid-template-columns:1fr}.section{margin-top:54px}.sectionHead{display:block}.sectionHead p{margin-top:8px}.card{padding:19px}.hashRow{grid-template-columns:86px minmax(0,1fr)}.hero h1{font-size:50px}.hero p{font-size:18px}.cta .button{width:100%}.foot{display:block}}
</style>
</head>
<body>
<main class="shell">
  <nav class="nav"><div class="brand">ProofRail</div><div class="navlinks"><a class="button" href="${githubUrl}">GitHub</a><a class="button primary" href="#proof">See the proof</a></div></nav>

  <section class="hero">
    <span class="eyebrow"><span class="dot"></span> LIVE PROOF · M1–M7 COMPLETE</span>
    <h1>Don’t trust the release. Rebuild it.</h1>
    <p>ProofRail independently reproduces software and Agent Skills from an exact publisher-declared source commit, compares the resulting bytes, and preserves the evidence on 0G.</p>
    <div class="cta"><a class="button primary" href="#proof">Watch the tamper check</a><a class="button" href="${m5MainnetTxUrl}">Open real mainnet anchor</a><a class="button" href="${githubUrl}/blob/main/hackathon/evidence.md">Evidence ledger</a></div>
  </section>

  <section class="section" id="proof">
    <div class="sectionHead"><div><span class="eyebrow">THE CORE CLAIM</span><h2>Same source. Independent rebuild. Exact bytes.</h2></div><p>The verdict comes from digest equality. The database, UI and any LLM are not allowed to manufacture it.</p></div>
    <div class="grid2">
      <article class="card resultCard match"><span class="badge match">MATCH</span><h3 style="margin-top:14px">Genuine publisher artifact</h3><p class="muted">The independently reproduced 0G artifact is byte-for-byte identical to the publisher artifact.</p><div class="hashBlock"><div class="hashRow"><span>Publisher</span><code>${SOFTWARE_DIGEST}</code></div><div class="arrow">↓ independent 0G rebuild</div><div class="hashRow"><span>Reproduced</span><code>${SOFTWARE_DIGEST}</code></div></div></article>
      <article class="card resultCard mismatch"><span class="badge mismatch">MISMATCH</span><h3 style="margin-top:14px">One-byte substitution</h3><p class="muted">The public source can remain unchanged while the distributed file is replaced. ProofRail catches the changed bytes.</p><div class="hashBlock"><div class="hashRow"><span>Publisher</span><code>${SOFTWARE_TAMPER_DIGEST}</code></div><div class="arrow">↓ same independent rebuild</div><div class="hashRow"><span>Reproduced</span><code>${SOFTWARE_DIGEST}</code></div></div></article>
    </div>
  </section>

  <section class="section">
    <div class="sectionHead"><div><span class="eyebrow">AGENT SKILLS</span><h2>Provenance and safety are separate questions.</h2></div><p>A skill can correspond exactly to source and still contain dangerous instructions. MATCH never means safe.</p></div>
    <div class="skillGrid">
      <article class="card"><div class="grid2"><div><span class="badge match">MATCH</span><h3 style="margin-top:14px">Clean-review skill package</h3><div class="hashRow"><span>Package</span><code>${M7_SKILL_DIGEST}</code></div></div><div><span class="badge mismatch">MISMATCH</span><h3 style="margin-top:14px">Controlled substitution</h3><div class="hashRow"><span>Changed</span><code>${M7_SKILL_TAMPER_DIGEST}</code></div></div></div><p class="muted">Exact source commit: <code class="hash">${M7_SOURCE_COMMIT}</code></p></article>
      <article class="card"><div class="metricLabel">Deterministic static audit</div><div class="metric">0 findings</div><p class="muted">Highest severity: INFO. LLM advisory: NOT_RUN.</p><p class="warning">This audit result is independent of correspondence. ProofRail never rewrites MATCH/MISMATCH because of a security score.</p></article>
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
      <article class="card"><span class="badge info">TEE BOUNDARY</span><h3 style="margin-top:14px">Provider evidence only</h3><p class="muted">The live TDX quote proves provider/runtime evidence, but the artifact digest is not cryptographically bound into the quote and the artifact is not proven to have been computed inside the TEE. ProofRail labels that limitation instead of overstating it.</p></article>
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
    <p class="muted">A cached result is rendered only after ProofRail’s integrity-checked projection accepts the canonical verification evidence.</p>
  </section>

  <footer class="foot"><span>ProofRail · independently verify the bytes</span><span><a href="${githubUrl}">public source</a> · <a href="${githubUrl}/blob/main/hackathon/evidence.md">evidence ledger</a></span></footer>
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ProofRail job</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;background:#f7f7f5}body{margin:0}.shell{max-width:860px;margin:0 auto;padding:48px 20px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:26px}.row{padding:9px 0;border-bottom:1px solid #f0f1f2}.row:last-child{border:0}code{font-size:12px;word-break:break-all}p{color:#4b5563}</style></head><body><main class="shell"><h1>Verification job</h1><div class="card"><div class="row">Pipeline status: <strong>${escapeHtml(job.status)}</strong></div><div class="row">Artifact kind: <strong>${escapeHtml(job.artifactKind)}</strong></div><div class="row">Project: <strong>${escapeHtml(job.projectId)}</strong></div><div class="row">Repository: <code>${escapeHtml(job.sourceRepository)}</code></div><div class="row">Commit: <code>${escapeHtml(job.sourceCommitSha)}</code></div>${failure}</div><p>No correspondence verdict is shown until canonical verification evidence is available and passes ProofRail integrity checks.</p></main></body></html>`;
}

export function createProductRequestHandler(store: JobStore, options: ProductRequestHandlerOptions = {}) {
  const publicBaseUrl = options.publicBaseUrl ?? process.env.PROOFRAIL_PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL;
  const localCatalog = options.localCatalog ?? createLocalCatalog();
  const catalogManifest = createProofRailArdCatalogManifest(publicBaseUrl);
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

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const base = `http://${request.headers.host ?? "localhost"}`;
      const url = new URL(request.url ?? "/", base);

      if (await sourceAuthRouter(request, response, url)) return;

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { ok: true, service: "proofrail", mode: "product" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/.well-known/ai-catalog.json") {
        sendJson(response, 200, catalogManifest);
        return;
      }
      if (request.method === "POST" && url.pathname === "/search") {
        requireJsonContentType(request);
        const rawBody = await readJson(request, ARD_MAX_REQUEST_BODY_BYTES);
        const requestsFederation = isObject(rawBody) && rawBody.federation !== undefined && rawBody.federation !== "none";
        if (requestsFederation) {
          const { query, providerIds } = parseFederatedSearchRequest(rawBody, discoveryProviders);
          const providers = providerIds.map((id) => discoveryProviders.get(id)!);
          const federated = await federatedDiscoverySearch(providers, query);
          sendJson(response, 200, federated);
          return;
        }
        const searchRequest = parseArdSearchRequest(rawBody);
        sendJson(response, 200, searchLocalCatalog(searchRequest, localCatalog, searchSource));
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
