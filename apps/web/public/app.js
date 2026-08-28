// M9 Hub progressive-enhancement client script (ADR-013). Vanilla JS, no framework, no build step
// — served as-is from apps/web/public/app.js. Imports the same isomorphic render modules the
// server uses for SSR (apps/web/src/ui/*.mjs, served read-only at /static/ui/*.mjs) so the
// browser-refreshed markup is byte-identical in structure/escaping to the server-rendered markup.
//
// Non-negotiable: this script never computes or reinterprets a trust/policy verdict. Every
// ALLOW/REVIEW/DENY, MATCH/MISMATCH/DIVERGED, or source-assurance level rendered here comes
// verbatim from an AegisOne backend JSON response.

import { resultListHtml } from "/static/ui/result-card.mjs";
import { policyResultHtml, policyErrorHtml } from "/static/ui/policy-result.mjs";
import { policyFromFormValues } from "/static/ui/policy-form.mjs";
import { repositoryListHtml, claimResultHtml, claimErrorHtml } from "/static/ui/source-claim-view.mjs";
import { scanResultHtml, scanErrorHtml } from "/static/ui/scan-view.mjs";

// `document.currentScript` is always null for `type="module"` scripts per the HTML spec
// (module scripts don't set it), so it cannot be used here — query the script tag instead.
const page = document.querySelector('script[src="/static/app.js"]')?.dataset.page;

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

const FEDERATION_PROVIDERS = ["github-agent-finder", "hugging-face-discover", "mcp-official-registry"];

/**
 * SKILLS page (ADR-016). Three independent behaviours, none of which may invent a verdict:
 *   1. search — unchanged from the previous Hub, including the SSR `?q=` path;
 *   2. the catalog library — client-side category filtering only (pure show/hide of server-rendered
 *      rows; the browser never reclassifies or re-ranks anything);
 *   3. the live federated strip — a real `POST /search` against the three discovery providers,
 *      deferred until after first paint so a page load never blocks on three upstream APIs.
 */
function initSkillsPage() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  const libraryRegion = document.getElementById("library-region");
  const federationToggle = document.getElementById("federation-toggle");
  if (!form || !input || !results) return;

  // Searching replaces the library; clearing the query restores it. The library markup is the
  // server's own, reused verbatim — it is never re-fetched and never falls back to fixture rows.
  function showLibrary() {
    results.innerHTML = "";
    if (libraryRegion) libraryRegion.hidden = false;
  }
  function showResults(html) {
    if (libraryRegion) libraryRegion.hidden = true;
    results.innerHTML = html;
  }

  document.querySelectorAll(".exampleChip[data-example]").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.example ?? "";
      runSearch(input.value);
    });
  });

  async function runSearch(text) {
    const trimmed = text.trim();
    const url = new URL(window.location.href);
    if (trimmed === "") {
      url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
      showLibrary();
      return;
    }
    const body = { query: { text: trimmed } };
    if (federationToggle?.checked) body.federation = FEDERATION_PROVIDERS;
    url.searchParams.set("q", trimmed);
    window.history.replaceState(null, "", url.toString());

    const { ok, json } = await postJson("/search", body);
    if (!ok) {
      showResults(`<p class="errorText">Search failed: ${escapeForDisplay(json?.message ?? "unknown error")}</p>`);
      return;
    }
    showResults(resultListHtml(json));
  }

  const debouncedSearch = debounce(runSearch, 350);
  input.addEventListener("input", () => debouncedSearch(input.value));
  federationToggle?.addEventListener("change", () => runSearch(input.value));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(input.value);
  });

  initCategoryFilter();
  initLiveFederated();
}

/**
 * Category filtering is presentation-only: it toggles the `hidden` attribute on rows the server
 * already classified and rendered. The browser never computes a category, and a category can
 * therefore never influence anything the server said about trust.
 */
function initCategoryFilter() {
  const chips = [...document.querySelectorAll(".catChip")];
  const rows = [...document.querySelectorAll(".libRow")];
  if (chips.length === 0 || rows.length === 0) return;

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (chip.hasAttribute("disabled")) return;
      const selected = chip.dataset.category ?? "";
      chips.forEach((other) => {
        const isActive = other === chip;
        other.classList.toggle("catChip--active", isActive);
        if (isActive) other.setAttribute("aria-current", "true");
        else other.removeAttribute("aria-current");
      });
      rows.forEach((row) => {
        row.hidden = selected !== "" && row.dataset.category !== selected;
      });
    });
  });
}

/**
 * The live federated discovery strip. These results are genuinely live and genuinely
 * discovery-only: `result-card.mjs` renders provider entries with empty trust, so nothing here can
 * present an upstream `verified`/score-looking field as AegisOne evidence.
 */
function initLiveFederated() {
  const button = document.getElementById("live-federated-load");
  const container = document.getElementById("live-federated-results");
  if (!button || !container) return;

  let inFlight = false;
  async function load() {
    if (inFlight) return;
    inFlight = true;
    button.disabled = true;
    container.innerHTML = `<p class="emptyState">Querying the MCP Official Registry, GitHub Agent Finder and Hugging Face Discover…</p>`;
    try {
      const { ok, json } = await postJson("/search", {
        query: { text: "agent skill" },
        federation: FEDERATION_PROVIDERS,
        pageSize: 12,
      });
      container.innerHTML = ok
        ? resultListHtml(json)
        : `<p class="errorText">Federated discovery failed: ${escapeForDisplay(json?.message ?? "unknown error")}</p>`;
    } catch (error) {
      // A provider outage is a provider outage — never rendered as a finding about a resource.
      container.innerHTML = `<p class="errorText">Federated discovery is unreachable right now: ${escapeForDisplay(
        error instanceof Error ? error.message : String(error),
      )}</p>`;
    } finally {
      inFlight = false;
      button.disabled = false;
    }
  }

  button.addEventListener("click", load);
  // Deferred to idle so the SKILLS page paints its real catalog library immediately and never
  // waits on three upstream APIs (AGENTS.md: discovery stays cheap and read-only).
  const defer = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400));
  defer(() => load());
}

function escapeForDisplay(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function initResourcePage() {
  const dataScript = document.getElementById("resource-data");
  const form = document.getElementById("policy-form");
  const resultContainer = document.getElementById("policy-result");
  if (!dataScript || !form || !resultContainer) return;
  let resourceId;
  try {
    resourceId = JSON.parse(dataScript.textContent ?? "{}").resourceId;
  } catch {
    return;
  }

  async function evaluate() {
    const formData = new FormData(form);
    const values = {
      minimumSourceAssurance: formData.get("minimumSourceAssurance") || "",
      requireCorrespondence: formData.get("requireCorrespondence") ? "MATCH" : "",
      maximumAuditSeverity: formData.get("maximumAuditSeverity") || "",
      maximumEvidenceAgeHours: formData.get("maximumEvidenceAgeHours") || "",
      missingEvidenceDecision: formData.get("missingEvidenceDecision") || "REVIEW",
    };
    const policy = policyFromFormValues(values);
    const { ok, json } = await postJson("/api/v1/policy/evaluate", { policy, resourceId });
    resultContainer.innerHTML = ok ? policyResultHtml(json) : policyErrorHtml(json);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    evaluate();
  });
  form.addEventListener("change", () => evaluate());
}

function initSourceClaimPage() {
  const connectButton = document.getElementById("connect-github");
  const sessionStatus = document.getElementById("github-session-status");
  const repoContainer = document.getElementById("repository-list");
  const claimForm = document.getElementById("claim-form");
  const previewBox = document.getElementById("claim-preview");
  const submitButton = document.getElementById("submit-claim");
  const resultBox = document.getElementById("claim-result");
  if (!claimForm) return;

  connectButton?.addEventListener("click", () => {
    window.location.href = "/auth/github/start?returnTo=/source/claim";
  });

  function currentClaimValues() {
    const formData = new FormData(claimForm);
    return Object.fromEntries(formData.entries());
  }

  function updatePreview() {
    if (previewBox) previewBox.textContent = JSON.stringify(currentClaimValues(), null, 2);
  }
  claimForm.addEventListener("input", updatePreview);
  updatePreview();

  async function loadRepositories() {
    const { status, json } = await getJson("/api/v1/source-auth/github/repositories");
    if (status === 401) {
      if (repoContainer) repoContainer.innerHTML = `<p class="emptyState">Connect GitHub above to list accessible repositories.</p>`;
      return;
    }
    if (status === 503) {
      if (sessionStatus) sessionStatus.textContent = "GitHub App not configured on this deployment yet.";
      if (repoContainer) repoContainer.innerHTML = `<p class="emptyState">GitHub connection unavailable — enter a repository below for a DECLARED claim.</p>`;
      return;
    }
    if (repoContainer) repoContainer.innerHTML = repositoryListHtml(json.repositories);
    if (sessionStatus && json.githubLogin) sessionStatus.textContent = `Connected as ${json.githubLogin}`;
    repoContainer?.querySelectorAll('input[name="repositoryFullName"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const repoField = claimForm.querySelector('[name="repositoryFullName"]');
        if (repoField) repoField.value = radio.value;
        updatePreview();
      });
    });
  }
  loadRepositories();

  submitButton?.addEventListener("click", async () => {
    const values = currentClaimValues();
    const body = {
      resourceId: values.resourceId,
      resourceVersionId: values.resourceVersionId,
      repositoryFullName: values.repositoryFullName,
      ref: values.ref || undefined,
      subdirectory: values.subdirectory || undefined,
      distributionUrl: values.distributionUrl || undefined,
      distributionSha256: values.distributionSha256 || undefined,
    };
    const { ok, json } = await postJson("/api/v1/source-claims", body);
    if (resultBox) resultBox.innerHTML = ok ? claimResultHtml(json) : claimErrorHtml(json);
  });
}

function initScanPage() {
  const form = document.getElementById("scan-form");
  const textarea = document.getElementById("scan-content");
  const advisory = document.getElementById("scan-advisory");
  const submit = document.getElementById("scan-submit");
  const resultContainer = document.getElementById("scan-result");
  if (!form || !textarea || !resultContainer) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = textarea.value;
    if (content.trim() === "") {
      resultContainer.innerHTML = scanErrorHtml({ message: "Paste some skill content first." });
      return;
    }
    if (submit) submit.disabled = true;
    try {
      // The browser sends exactly the documented `POST /api/v1/scan` body and renders the response
      // verbatim through the same isomorphic module the server uses. It never derives, caches or
      // re-thresholds the verdict itself.
      const { ok, json } = await postJson("/api/v1/scan", {
        content,
        includeAdvisoryScan: Boolean(advisory?.checked),
      });
      resultContainer.innerHTML = ok ? scanResultHtml(json) : scanErrorHtml(json);
    } catch (error) {
      resultContainer.innerHTML = scanErrorHtml({ message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

if (page === "skills") initSkillsPage();
if (page === "resource") initResourcePage();
if (page === "source-claim") initSourceClaimPage();
if (page === "audit") initScanPage();
