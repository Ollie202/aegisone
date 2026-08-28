import { escapeHtml } from "../ui/escape.mjs";
import { renderLayoutHtml } from "./layout.ts";

/**
 * FOR AGENTS — section 4 of the four-section IA (ADR-016).
 *
 * ==========================================================================================
 * WHAT IS REAL ON THIS PAGE TODAY, AND WHAT IS EXPLICITLY NOT BUILT YET
 * ==========================================================================================
 * REAL: every endpoint and tool name listed here is live on this deployment right now. `/mcp` is
 * the M8.8 Streamable-HTTP MCP transport, `/api/v1/*` is the M8.7 frozen read/policy API
 * (`docs/24-m8-11-contract-freeze.md`), `POST /search` and `/.well-known/ai-catalog.json` are the
 * M8.2/M8.3 ARD discovery surface. The URLs below are built from this deployment's own public base
 * URL, so they are copy-pasteable against the server that served the page.
 *
 * NOT BUILT YET: guided onboarding, per-agent credentials and worked client examples. Said plainly
 * at the bottom rather than mocked up.
 *
 * SAFETY BOUNDARY (docs/17 Threat M8-018, AGENTS.md): the MCP surface is read/policy only. There
 * is deliberately no install, execute, sign, arbitrary-build or upload-secret tool, and none of
 * these routes can spend 0G or reach the worker's signer. That boundary is stated on the page
 * because an agent operator needs to know it, not just a human reader.
 */

export interface AgentsPageState {
  /** This deployment's own public base URL, so the rendered endpoints address the live server. */
  publicBaseUrl: string;
  /** Whether paste-to-scan's optional 0G Compute advisory tier is configured here. Rendered as an
   * explicit availability state — never silently omitted. */
  advisoryConfigured: boolean;
}

interface Endpoint {
  method: string;
  path: string;
  title: string;
  description: string;
}

const ENDPOINTS: readonly Endpoint[] = [
  {
    method: "POST",
    path: "/mcp",
    title: "MCP endpoint (Streamable HTTP)",
    description:
      "Stateless JSON-RPC. Four read/policy tools, no install/execute/sign tool of any kind. Every tool calls the same application services this site's own pages call — never a second search engine or a second evidence interpretation.",
  },
  {
    method: "GET",
    path: "/api/v1/resources/:resourceId",
    title: "Resource with assembled evidence",
    description:
      "The full independent trust dimensions for one catalog resource: discovery, source assurance, source inspection, correspondence, security and canonical evidence — each returned separately, never collapsed into a score.",
  },
  {
    method: "GET",
    path: "/api/v1/resources/:resourceId/evidence",
    title: "Evidence detail",
    description:
      "Source claims and the full historical capability-verification rows behind a resource, with integrity flags. A row that fails its own digest recheck is reported as unavailable evidence, not as a downgraded verdict.",
  },
  {
    method: "GET",
    path: "/api/v1/resources/:resourceId/versions/:versionId",
    title: "One specific version",
    description: "Trust evidence scoped to a single immutable resource version.",
  },
  {
    method: "POST",
    path: "/api/v1/policy/evaluate",
    title: "Deterministic policy evaluation",
    description:
      "You supply the policy; AegisOne returns ALLOW / REVIEW / DENY plus the exact reason codes. Discovery relevance and category are structurally incapable of entering this decision, and missing evidence resolves to your declared missingEvidenceDecision rather than being assumed benign.",
  },
  {
    method: "POST",
    path: "/api/v1/scan",
    title: "Paste-to-scan a skill package",
    description:
      "Deterministic static audit of pasted skill content, keyed and cached by content hash. A pasted skill structurally has no source claim and no correspondence, and the response says so explicitly.",
  },
  {
    method: "POST",
    path: "/search",
    title: "Capability discovery (ARD)",
    description:
      "Local pinned-ARD catalog search, or federated search across the MCP Official Registry, GitHub Agent Finder and Hugging Face Discover. Results are discovery-only: relevance is a ranking signal and never a trust or safety score.",
  },
  {
    method: "GET",
    path: "/.well-known/ai-catalog.json",
    title: "ARD catalog manifest",
    description: "Agent Resource Discovery manifest describing this catalog and its search endpoint.",
  },
];

const MCP_TOOLS = ["aegisone_search", "aegisone_inspect", "aegisone_evaluate", "aegisone_scan"];

const DENIED_TOOLS = [
  "aegisone_install",
  "aegisone_execute",
  "aegisone_sign",
  "aegisone_run_arbitrary_build",
  "aegisone_upload_secret",
];

export function renderAgentsPageHtml(state: AgentsPageState): string {
  const base = state.publicBaseUrl.replace(/\/+$/, "");

  const endpoints = ENDPOINTS.map(
    (endpoint) => `<li class="endpoint">
      <h3>${escapeHtml(endpoint.title)}</h3>
      <p>${escapeHtml(endpoint.description)}</p>
      <code class="endpointUrl">${escapeHtml(endpoint.method)} ${escapeHtml(base + endpoint.path)}</code>
    </li>`,
  ).join("");

  const tools = MCP_TOOLS.map((tool) => `<li>${escapeHtml(tool)}</li>`).join("");
  const denied = DENIED_TOOLS.map((tool) => `<li>${escapeHtml(tool)}</li>`).join("");

  const advisory = state.advisoryConfigured
    ? `<p class="passportNote">The optional 0G Compute LLM advisory tier <strong>is configured</strong> on this deployment. It is opt-in per request, strictly rate limited, and its output is always labelled advisory — it can never change a deterministic verdict.</p>`
    : `<p class="passportNote">The optional 0G Compute LLM advisory tier is <strong>not configured</strong> on this deployment. Requesting it returns an explicit <code>advisory_unavailable</code> state rather than silently skipping it.</p>`;

  const body = `
    <span class="edgeLabel">04 / For agents</span>
    <span class="sectionNum" aria-hidden="true">04</span>
    <h1 class="tight">Machine access to the <span class="mark">same evidence</span>.</h1>
    <p class="lede">Everything a human reads on this site, an agent can read over MCP or the stable REST API — the identical serializers, the identical dimensions, the identical refusals. No endpoint returns a summary an agent would have to trust.</p>

    <section class="panel" style="margin-top:26px">
      <span class="edgeLabel">Read / policy only</span>
      <h2>What this surface deliberately cannot do</h2>
      <p class="passportNote">MCP tools available here:</p>
      <ul class="toolList">${tools}</ul>
      <p class="passportNote" style="margin-top:14px">Tools that deliberately do not exist, and have no code path on this server:</p>
      <ul class="toolList">${denied}</ul>
      <p class="passportWarning">No public route installs, executes or signs anything, and none can spend 0G or reach the worker's signer. Discovering a resource through AegisOne is never an instruction to run it.</p>
    </section>

    <section style="margin-top:26px">
      <div class="sectionHeadRow">
        <h2>Live endpoints</h2>
        <span class="eyebrow">All working now</span>
      </div>
      <p class="sectionNote">Addressed against this deployment's own base URL, so they are copy-pasteable as shown.</p>
      <ul class="endpointList">${endpoints}</ul>
      ${advisory}
    </section>

    <section class="upcoming">
      <span class="edgeLabel">Not built yet</span>
      <h2>Guided onboarding and worked client examples are still to come</h2>
      <p>Per-agent credentials, copy-paste MCP client configuration and end-to-end example transcripts are a later change in this restructure. The endpoints above are complete and stable today — the contract is frozen in <code>docs/24-m8-11-contract-freeze.md</code>.</p>
      <div class="ctaRow">
        <a class="button button--primary" href="/">Browse the skill library <span class="arrow" aria-hidden="true">→</span></a>
        <a class="button" href="/verified">What verified means <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </section>
  `;

  return renderLayoutHtml({
    title: "For agents — AegisOne",
    activeNav: "agents",
    bodyHtml: body,
  });
}
