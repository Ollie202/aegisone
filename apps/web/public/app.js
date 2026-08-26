// M9 Hub progressive-enhancement client script (ADR-013). Vanilla JS, no framework, no build step
// — served as-is from apps/web/public/app.js. Imports the same isomorphic render modules the
// server uses for SSR (apps/web/src/ui/*.mjs, served read-only at /static/ui/*.mjs) so the
// browser-refreshed markup is byte-identical in structure/escaping to the server-rendered markup.
//
// Non-negotiable: this script never computes or reinterprets a trust/policy verdict. Every
// ALLOW/REVIEW/DENY, MATCH/MISMATCH/DIVERGED, or source-assurance level rendered here comes
// verbatim from a ProofRail backend JSON response.

import { resultListHtml } from "/static/ui/result-card.mjs";
import { policyResultHtml, policyErrorHtml } from "/static/ui/policy-result.mjs";
import { policyFromFormValues } from "/static/ui/policy-form.mjs";
import { repositoryListHtml, claimResultHtml, claimErrorHtml } from "/static/ui/source-claim-view.mjs";

const page = document.currentScript?.dataset.page;

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

function initHubPage() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  const federationToggle = document.getElementById("federation-toggle");
  if (!form || !input || !results) return;

  document.querySelectorAll(".exampleChip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.example ?? "";
      runSearch(input.value);
    });
  });

  async function runSearch(text) {
    const trimmed = text.trim();
    if (trimmed === "") {
      results.innerHTML = "";
      return;
    }
    const body = { query: { text: trimmed } };
    if (federationToggle?.checked) {
      body.federation = ["github-agent-finder", "hugging-face-discover", "mcp-official-registry"];
    }
    const url = new URL(window.location.href);
    url.searchParams.set("q", trimmed);
    window.history.replaceState(null, "", url.toString());

    const { ok, json } = await postJson("/search", body);
    if (!ok) {
      results.innerHTML = `<p class="errorText">Search failed: ${escapeForDisplay(json?.message ?? "unknown error")}</p>`;
      return;
    }
    results.innerHTML = resultListHtml(json);
  }

  const debouncedSearch = debounce(runSearch, 350);
  input.addEventListener("input", () => debouncedSearch(input.value));
  federationToggle?.addEventListener("change", () => runSearch(input.value));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(input.value);
  });
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

if (page === "hub") initHubPage();
if (page === "resource") initResourcePage();
if (page === "source-claim") initSourceClaimPage();
