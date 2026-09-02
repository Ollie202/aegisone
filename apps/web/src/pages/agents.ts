import { escapeHtml } from "../ui/escape.mjs";
import { renderLayoutHtml } from "./layout.ts";

/**
 * FOR AGENTS — section 04 of the four-section IA.
 *
 * ONE JOB: **help an agent or a developer connect.** This is integration documentation written in
 * AegisOne's voice, not a fifth landing page. The order is the order a reader needs:
 *
 *     short header → the two paths (MCP first) → MCP → REST → policy evaluation
 *     → the safety boundary → the endpoint reference
 *
 * What changed: the page used to open with a hero and two decorative CTAs, then walk a four-step
 * illustrated "flow spine" with four full payload dumps before saying how to connect at all. The
 * connection details now come first, the long narrative is gone, and the payloads that remain are
 * the two that a reader genuinely needs to see the shape of — the assembled evidence block and the
 * refusal. Everything deeper is linked to the frozen contracts rather than reprinted.
 *
 * ==========================================================================================
 * EVERYTHING ON THIS PAGE IS REAL, AND EVERY PAYLOAD IS VERBATIM
 * ==========================================================================================
 * The four MCP tool names below are not a hand-maintained list that could drift from the server:
 * `ADVERTISED_MCP_TOOLS` is exported from this module and
 * `apps/web/test/agents-page.test.ts` connects a real `@modelcontextprotocol/sdk` client to a real
 * `POST /mcp` and asserts the two sets are exactly equal. If a tool is ever added, removed or
 * renamed in `apps/web/src/mcp.ts`, that test fails until this page is corrected — the page cannot
 * advertise a tool the server does not register, and cannot hide one it does. The same test issues
 * every endpoint printed here as a real request, and asserts the trust field names in the pasted
 * evidence payload are the field names the live API actually returns.
 *
 * Every request/response body rendered on this page was captured from a running server by issuing
 * the exact request shown, and pasted unchanged. Where a long response is shown in part, the
 * omission is labelled in the block's own header rather than silently trimmed.
 *
 * ==========================================================================================
 * WHAT IS DELIBERATELY MARKED UNAVAILABLE
 * ==========================================================================================
 * `NOT_AVAILABLE_TODAY` below is rendered as its own visible block. It exists because the honest
 * answer to "can an agent retrieve a stored evidence bundle from 0G?" is *not yet*: the publication
 * path is built and tested (ADR-017) but no funded live publication has been run, so
 * `trust.canonicalEvidence.storageRoot` is `null` on every resource this deployment serves.
 *
 * ==========================================================================================
 * SAFETY BOUNDARY (docs/17-m8-security-boundaries.md Threat M8-018, AGENTS.md)
 * ==========================================================================================
 * The MCP surface is read/policy only. There is deliberately no install, execute, sign,
 * arbitrary-build or upload-secret tool, none of these routes can spend 0G or reach the worker's
 * signer, and no copy on this page may imply otherwise. It reads as a technical callout because an
 * agent operator needs the fact, not a reassurance panel.
 */

/**
 * The exact tool names this page advertises. Held to equality with the server's registered tool
 * set by `apps/web/test/agents-page.test.ts` — see this module's header.
 */
export const ADVERTISED_MCP_TOOLS = ["aegisone_search", "aegisone_inspect", "aegisone_evaluate", "aegisone_scan"] as const;

/** One line each, so the tool list is a reference rather than four bare identifiers. */
const TOOL_SUMMARY: Record<(typeof ADVERTISED_MCP_TOOLS)[number], string> = {
  aegisone_search: "Find candidate capabilities. Discovery only — a hit is not evidence.",
  aegisone_inspect: "Read the independent trust dimensions AegisOne holds for one resource.",
  aegisone_evaluate: "Apply your policy to that evidence. ALLOW / REVIEW / DENY plus reason codes.",
  aegisone_scan: "Deterministically screen skill content you supply inline. No publisher required.",
};

/**
 * Threat M8-018's explicit denylist. These names have no code path anywhere in this repository;
 * `apps/web/test/mcp.test.ts` asserts the connected tool list never contains one of them, and this
 * page prints them so an agent operator can see the boundary rather than infer it.
 */
const DENIED_MCP_TOOLS = [
  "aegisone_install",
  "aegisone_execute",
  "aegisone_sign",
  "aegisone_run_arbitrary_build",
  "aegisone_upload_secret",
] as const;

/** The public production deployment. Stated as a fact about where AegisOne is hosted; the
 * copy-paste blocks on the page always use the origin that actually served the page, so a local,
 * preview or Railway deployment renders itself and never sends an agent to the wrong host. */
export const PRODUCTION_ORIGIN = "https://aegisone-three.vercel.app";

export interface AgentsPageState {
  /** The origin the copy-paste connection blocks address. Resolved per request by
   * `resolveConnectOrigin` so what is rendered is the server that served it. */
  connectOrigin: string;
  /** Whether paste-to-scan's optional 0G Compute advisory tier is configured here. Rendered as an
   * explicit availability state — never silently omitted. */
  advisoryConfigured: boolean;
}

/**
 * Resolves the origin the connection instructions should address.
 *
 * The `Host` header is caller-controlled, so it is accepted only when it is a structurally valid
 * host[:port] — otherwise this falls back to the deployment's configured public base URL. A
 * rejected host can therefore never place attacker-chosen text inside a config block a reader is
 * being invited to copy. (Escaping alone would stop script injection but not a misleading URL.)
 */
export function resolveConnectOrigin(host: string | undefined, forwardedProto: string | undefined, fallbackBaseUrl: string): string {
  const trimmedFallback = fallbackBaseUrl.replace(/\/+$/, "");
  if (typeof host !== "string" || !/^[a-z0-9.-]{1,253}(:\d{1,5})?$/i.test(host)) return trimmedFallback;
  const proto = typeof forwardedProto === "string" ? forwardedProto.split(",", 1)[0]!.trim().toLowerCase() : "";
  if (proto === "http" || proto === "https") return `${proto}://${host}`;
  const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  return `${isLoopback ? "http" : "https"}://${host}`;
}

interface Endpoint {
  readonly method: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
}

/**
 * Every entry here was exercised with a real HTTP request against a running server before it was
 * written down, and `agents-page.test.ts` re-issues each one on every run. Nothing aspirational
 * appears in this list.
 */
const ENDPOINTS: readonly Endpoint[] = [
  {
    method: "POST",
    path: "/mcp",
    title: "MCP, Streamable HTTP",
    description: "Stateless JSON-RPC. The four read/policy tools. GET and DELETE answer 405 by design — there is no session to resume.",
  },
  {
    method: "POST",
    path: "/search",
    title: "Capability discovery",
    description: "Pinned ARD catalog, or federated across the MCP Official Registry, GitHub Agent Finder and Hugging Face Discover. Relevance is ranking, never trust.",
  },
  {
    method: "GET",
    path: "/api/v1/resources/:resourceId",
    title: "Resource + assembled evidence",
    description: "The independent trust dimensions for one catalog resource, each returned separately, plus per-dimension integrity flags.",
  },
  {
    method: "GET",
    path: "/api/v1/resources/:resourceId/evidence",
    title: "Itemised evidence history",
    description: "Every source claim and capability-verification row behind a resource. A row failing its own digest recheck is reported unavailable, not downgraded.",
  },
  {
    method: "GET",
    path: "/api/v1/resources/:resourceId/versions/:versionId",
    title: "One immutable version",
    description: "Trust evidence scoped to a single version. A version belonging to another resource 404s rather than leaking.",
  },
  {
    method: "POST",
    path: "/api/v1/policy/evaluate",
    title: "Deterministic policy evaluation",
    description: "Your policy, AegisOne's evidence, an ALLOW / REVIEW / DENY plus machine-readable reason codes. No LLM, no relevance score.",
  },
  {
    method: "POST",
    path: "/api/v1/scan",
    title: "Screen pasted content",
    description: "Deterministic static audit of skill content you supply inline. No publisher, no source claim, and the response says exactly that.",
  },
  {
    method: "POST",
    path: "/api/v1/verify",
    title: "Reproduce a catalog resource",
    description: "Independently rebuild a catalog resource from its recorded exact commit and, where a distinct distributed artifact exists, compare the bytes. Takes a catalog resourceId and nothing else: you cannot hand it a repository, a commit or a URL. Strictly rate-limited, one at a time (ADR-020).",
  },
  {
    method: "GET",
    path: "/.well-known/ai-catalog.json",
    title: "ARD catalog manifest",
    description: "Agent Resource Discovery manifest describing this catalog and its search endpoint.",
  },
];

/** Things this surface genuinely cannot do today. Printed, not omitted. */
const NOT_AVAILABLE_TODAY: readonly { readonly title: string; readonly detail: string }[] = [
  {
    title: "Retrieving a stored evidence bundle from 0G",
    detail:
      "No resource this deployment serves has an evidence bundle on 0G Storage yet, so trust.canonicalEvidence.storageRoot is null everywhere. The publication path is built and tested against injected transports, but no funded live run has happened. AegisOne also proxies no retrieval: when a root does exist it is a pointer you resolve against 0G yourself, not bytes this API re-serves.",
  },
  {
    title: "Publishing evidence",
    detail:
      "POST /api/v1/publish spends real funds from a signer that lives only on the internal worker. It requires an operator token, is absent entirely unless configured, and is deliberately not part of the agent surface. There is no agent-callable path to it, and there is not going to be one.",
  },
  {
    title: "A SIGNED_RELEASE source assurance level",
    detail:
      "The level exists in the model and no code path emits it yet, because cryptographic provenance verification is not implemented. You will only ever read NONE, DECLARED or REPOSITORY_AUTHENTICATED from this API today.",
  },
  {
    title: "Per-agent credentials or rate-limit budgets",
    detail:
      "There is no authentication on any tool or read endpoint — everything here is public read/policy work over public evidence. Limits are per-connection and coarse. If you need a guaranteed budget, this deployment cannot give you one.",
  },
];

/**
 * The page's ONE illustration, and it sits inside the safety-boundary callout because that is the
 * only place on the page it is *about* something: an agent reaching for a capability, and a gate
 * that can close. It is built from the product's existing shape family (outlined geometry + the
 * byte grid) and deliberately NOT from the `#ic-stamp` verdict seal — pressing a stamp here would
 * read as AegisOne approving something, the exact confusion this product exists to prevent.
 */
const AGENT_GATE_ART = `
<svg viewBox="0 0 400 210" role="img" aria-label="An agent on the left reaches through a gate toward a package of bytes on the right; the gate carries an evidence question and can close.">
  <g fill="none" stroke="#0a0a0a" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round">
    <!-- the agent: a plain outlined machine, no face, no personality -->
    <rect x="8" y="66" width="86" height="76" rx="14" fill="#b79cff"/>
    <circle cx="34" cy="96" r="7" fill="#0a0a0a" stroke="none"/>
    <circle cx="68" cy="96" r="7" fill="#0a0a0a" stroke="none"/>
    <path d="M30 120h42"/>
    <path d="M51 66V44"/>
    <circle cx="51" cy="38" r="7" fill="#ffd91a"/>

    <!-- the ask -->
    <path d="M100 104h58"/>
    <path d="M148 96l10 8-10 8"/>

    <!-- the gate: two posts and a bar that is drawn part-way down, i.e. it can close -->
    <rect x="164" y="26" width="72" height="158" rx="16" fill="#f7f5ef"/>
    <path d="M164 78h72"/>
    <rect x="180" y="42" width="40" height="24" rx="6" fill="#22dceb"/>
    <path d="M188 54h24"/>
    <path d="M200 96v66" stroke-dasharray="9 8"/>
    <path d="M178 130h44" stroke-width="5"/>

    <!-- what is on the other side: the bytes, as the shared byte-grid motif -->
    <g transform="translate(272 62) rotate(-6)">
      <rect x="0" y="0" width="34" height="34" rx="7" fill="#ffd91a"/>
      <rect x="42" y="0" width="34" height="34" rx="7"/>
      <rect x="0" y="42" width="34" height="34" rx="7"/>
      <rect x="42" y="42" width="34" height="34" rx="7" fill="#0a0a0a"/>
    </g>

    <!-- the returned answer, off-axis: a reason, never a score -->
    <g transform="translate(246 152) rotate(5)">
      <rect x="0" y="0" width="140" height="38" rx="10" fill="#fffdf8"/>
      <path d="M16 19h24M16 27h48"/>
      <path d="M16 11h72"/>
    </g>
  </g>
</svg>`;

/** A copy-friendly code block. The button is rendered `hidden` and revealed only by the page's own
 * script, so a JavaScript-less reader is never shown a control that cannot work — the block itself
 * is plain selectable text either way. */
function codeBlock(label: string, tone: "in" | "out" | "refuse", body: string, id: string): string {
  return `<figure class="codeCard">
    <figcaption class="codeHead codeHead--${tone}"><span>${escapeHtml(label)}</span><button class="copyButton" type="button" data-copy="${escapeHtml(id)}" hidden>Copy</button></figcaption>
    <pre id="${escapeHtml(id)}"><code>${escapeHtml(body)}</code></pre>
  </figure>`;
}

/**
 * Progressive enhancement only: reveals the copy buttons and wires them to the Clipboard API.
 * Nothing on this page depends on it — with JavaScript off, every block is still readable and
 * selectable, and no control is shown that would not work.
 */
const COPY_SCRIPT = `<script>
(function () {
  if (!navigator.clipboard) return;
  for (const button of document.querySelectorAll(".copyButton")) {
    const target = document.getElementById(button.getAttribute("data-copy"));
    if (!target) continue;
    button.hidden = false;
    button.addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(target.textContent || "");
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = "Copy"; }, 1600);
      } catch {
        button.textContent = "Press Ctrl+C";
      }
    });
  }
})();
</script>`;

export function renderAgentsPageHtml(state: AgentsPageState): string {
  const origin = state.connectOrigin.replace(/\/+$/, "");

  const mcpConfig = `{
  "mcpServers": {
    "aegisone": {
      "url": "${origin}/mcp",
      "transport": "streamable-http"
    }
  }
}`;

  const listToolsCurl = `curl -sS -X POST ${origin}/mcp \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;

  const evaluateCurl = `curl -sS -X POST ${origin}/api/v1/policy/evaluate \\
  -H 'content-type: application/json' \\
  -d '{"policy":{"schemaVersion":"1",
                 "missingEvidenceDecision":"DENY",
                 "minimumSourceAssurance":"REPOSITORY_AUTHENTICATED",
                 "requireCorrespondence":"MATCH"},
       "resourceId":"f19833ca-1749-4674-8bac-fe43a204076b"}'`;

  // Captured verbatim from `tools/call aegisone_inspect` on a running server: the trust and
  // integrity blocks of that response. `agents-page.test.ts` asserts every dimension and field
  // named here is a field the live API really returns.
  const inspectResponse = `"trust": {
  "sourceAssurance": {
    "level": "DECLARED",
    "evidenceRefs": ["47f08307-ab47-4d53-9a99-8289af57e068"]
  },
  "sourceInspection": {
    "status": "INSPECTED",
    "exactCommitSha": "1471116222dfe959f091f3d5818993edd968d57c",
    "sourceSnapshotSha256": "00bebc7df532b47ba9e70319c4058e7725241ed7749c81b3f88ab93265b7c398"
  },
  "correspondence": {
    "status": "NOT_EVALUATED",
    "publisherSha256": null,
    "reproducedSha256": null
  },
  "security": {
    "status": "COMPLETED",
    "analysisKind": "DETERMINISTIC_STATIC",
    "highestSeverity": "INFO",
    "findingCount": 0
  },
  "canonicalEvidence": {
    "status": "NONE",
    "sha256": null,
    "verifiedAt": null,
    "storageRoot": null,
    "registryRecordId": null
  }
},
"integrity": {
  "sourceAssurance": { "present": true, "integrityCheckPassed": true },
  "canonicalVerification": { "present": true, "integrityCheckPassed": true },
  "storagePublication": { "ok": false, "reason": "NO_PUBLICATION_RECORDED" }
}`;

  const denyResponse = `{
  "schemaVersion": "1",
  "decision": "DENY",
  "reasons": [
    {
      "code": "source_assurance_below_requirement",
      "decision": "DENY",
      "message": "source assurance DECLARED is below required REPOSITORY_AUTHENTICATED"
    },
    {
      "code": "correspondence_missing",
      "decision": "DENY",
      "message": "correspondence evidence is NOT_EVALUATED"
    }
  ]
}`;

  const tools = ADVERTISED_MCP_TOOLS.map(
    (tool) => `<li><code>${escapeHtml(tool)}</code><span>${escapeHtml(TOOL_SUMMARY[tool])}</span></li>`,
  ).join("");
  const denied = DENIED_MCP_TOOLS.map((tool) => `<li>${escapeHtml(tool)}</li>`).join("");

  const endpoints = ENDPOINTS.map(
    (endpoint) => `<li class="endpoint">
      <h3>${escapeHtml(endpoint.title)}</h3>
      <p>${escapeHtml(endpoint.description)}</p>
      <code class="endpointUrl">${escapeHtml(endpoint.method)} ${escapeHtml(origin + endpoint.path)}</code>
    </li>`,
  ).join("");

  const unavailable = NOT_AVAILABLE_TODAY.map(
    (item) => `<li><strong>${escapeHtml(item.title)}.</strong> ${escapeHtml(item.detail)}</li>`,
  ).join("");

  const advisory = state.advisoryConfigured
    ? `The optional 0G Compute advisory tier is configured here. It is opt-in per call, separately and far more strictly rate limited, and always labelled advisory — it can never set or override the deterministic verdict.`
    : `The optional 0G Compute advisory tier is not configured on this deployment. Asking for it returns an explicit advisory_unavailable state rather than silently skipping it, and the deterministic verdict is unaffected either way.`;

  const body = `
    <div class="pageHead">
      <span class="eyebrow">04 / For agents</span>
      <h1 class="tight">Connect an agent in <span class="mark">one POST</span>.</h1>
      <p>Four read-only MCP tools, or the same evidence over plain HTTP. No key, no signup. It answers with named dimensions and reason codes — and when the evidence a policy needs is not there, it says no.</p>
    </div>

    <nav class="miniNav" aria-label="On this page">
      <a href="#mcp">MCP</a>
      <a href="#rest">REST</a>
      <a href="#policy">Policy evaluation</a>
      <a href="#boundary">Safety boundary</a>
      <a href="#endpoints">Endpoint reference</a>
    </nav>

    <div class="pathGrid">
      <div class="pathCard pathCard--primary">
        <span class="eyebrow">Path A — recommended</span>
        <h2>MCP</h2>
        <p>One stateless Streamable-HTTP endpoint, four tools, nothing to keep alive. This is the shortest path from an agent to AegisOne's evidence.</p>
        <div class="ctaRow"><a class="button button--primary" href="#mcp">Connect over MCP <span class="arrow" aria-hidden="true">→</span></a></div>
      </div>
      <div class="pathCard">
        <span class="eyebrow">Path B</span>
        <h2>REST</h2>
        <p>The same evidence and the same policy evaluator over ordinary JSON over HTTP, for anything that is not an MCP client.</p>
        <div class="ctaRow"><a class="button" href="#rest">Use the HTTP API <span class="arrow" aria-hidden="true">→</span></a></div>
      </div>
    </div>

    <section class="section" id="mcp">
      <div class="sectionHeadRow">
        <h2>MCP</h2>
        <span class="eyebrow">Stateless streamable-http</span>
      </div>
      <p class="sectionNote">These blocks address <strong>${escapeHtml(origin)}</strong> — the origin that served this page — so they work exactly as shown. The public deployment lives at <code>${escapeHtml(PRODUCTION_ORIGIN)}</code>.</p>
      ${codeBlock("MCP client config", "in", mcpConfig, "code-mcp-config")}
      <p class="note">Clients that spell the transport <code>"type": "http"</code> instead of <code>"transport": "streamable-http"</code> take the same URL. Every call is one POST; there is no session to resume.</p>
      ${codeBlock("Verify the connection — list the tools", "in", listToolsCurl, "code-tools-list")}
      <ul class="toolList toolList--described">${tools}</ul>
      <p class="note">That list is held equal to the server's own registered tool set by a test, so this page cannot advertise a tool that is not there or hide one that is.</p>
    </section>

    <section class="section" id="rest">
      <div class="sectionHeadRow">
        <h2>REST</h2>
        <span class="eyebrow">Same evidence, plain JSON</span>
      </div>
      <p class="sectionNote">Discovery is <code>POST /search</code>; evidence for one resource is <code>GET /api/v1/resources/:id</code> and <code>/evidence</code>; screening pasted content is <code>POST /api/v1/scan</code>; reproducing a catalog package from its recorded commit is <code>POST /api/v1/verify</code>. Full shapes are in the <a href="#endpoints">endpoint reference</a> below.</p>
      ${codeBlock("What AegisOne holds — the trust and integrity blocks of an inspect response", "out", inspectResponse, "code-inspect")}
      <p class="note">There is no <code>verified</code> field to read, because there is no single answer to give. This resource has a declared source and a clean deterministic audit, and has never had its distributed bytes compared with anything. Three separate facts; the API will not merge them for you. Pasted content, meanwhile, structurally has no source claim, so anything from <code>/api/v1/scan</code> always reports <code>sourceAssurance: NONE</code> and <code>correspondence: NOT_EVALUATED</code>. ${escapeHtml(advisory)}</p>
    </section>

    <section class="section" id="policy">
      <div class="sectionHeadRow">
        <h2>Policy evaluation</h2>
        <span class="eyebrow">Your thresholds, not ours</span>
      </div>
      <p class="sectionNote">You send the policy; AegisOne applies it to the evidence it actually holds and answers ALLOW, REVIEW or DENY with machine-readable reason codes. <code>missingEvidenceDecision</code> is required, and that is the whole design: you must state up front what absent evidence means to you, because there is no defensible default.</p>
      ${codeBlock("policy evaluate — request", "in", evaluateCurl, "code-rest-curl")}
      ${codeBlock("policy evaluate — response", "refuse", denyResponse, "code-deny")}
      <p class="note">The resource above is real, indexed, audited clean and pinned to an immutable commit — and against a policy demanding proven repository authority and byte correspondence it is still a <strong>DENY</strong>, naming both missing things. Absent evidence never becomes approval: not by inference, not by a default, not because the rest of the record looked fine. No model is consulted, and search relevance is structurally incapable of reaching this decision.</p>
    </section>

    <section class="section boundary" id="boundary">
      <div>
        <span class="edgeLabel">Safety boundary</span>
        <h2>Read and policy only</h2>
        <p class="note">These tool names have no code path on this server, and a connected client never sees them:</p>
        <ul class="toolList toolList--denied">${denied}</ul>
        <p class="note">No public route installs, executes or signs anything, and none can spend 0G or reach the worker's signer. Finding a resource through AegisOne is never an instruction to run it — that decision is yours, made on the evidence, and AegisOne's job ends at handing you the evidence.</p>
      </div>
      <div class="boundaryArt">${AGENT_GATE_ART}</div>
    </section>

    <section class="upcoming">
      <h2>Not available today</h2>
      <ul class="notProvenList">${unavailable}</ul>
    </section>

    <section class="section" id="endpoints">
      <div class="sectionHeadRow">
        <h2>Endpoint reference</h2>
        <span class="eyebrow">Every one exercised by a test</span>
      </div>
      <ul class="endpointList">${endpoints}</ul>
      <p class="note">Full schemas, the cross-endpoint error-code table and the transport rationale are documented rather than reprinted here.</p>
      <div class="ctaRow">
        <a class="button button--sm" href="https://github.com/Ollie202/aegisone/blob/main/docs/21-m8-mcp-interface.md" rel="noopener noreferrer" target="_blank">MCP interface contract ↗</a>
        <a class="button button--sm" href="https://github.com/Ollie202/aegisone/blob/main/docs/20-m8-api-contract.md" rel="noopener noreferrer" target="_blank">REST API contract ↗</a>
        <a class="button button--sm" href="https://github.com/Ollie202/aegisone/blob/main/docs/24-m8-11-contract-freeze.md" rel="noopener noreferrer" target="_blank">Contract freeze index ↗</a>
        <a class="button button--sm" href="/verified">What each state means <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </section>
  `;

  return renderLayoutHtml({
    title: "For agents — AegisOne",
    activeNav: "agents",
    bodyHtml: body,
    scriptTag: COPY_SCRIPT,
  });
}
