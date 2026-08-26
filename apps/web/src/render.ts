import type { VerificationJson } from "../../../packages/core/src/model.ts";
import { createVerificationView } from "../../../packages/core/src/presentation.ts";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function row(label: string, value: string): string {
  return `<div class="row"><span>${escapeHtml(label)}</span><code>${escapeHtml(value)}</code></div>`;
}

export function renderVerificationHtml(verification: VerificationJson): string {
  const view = createVerificationView(verification);
  const statusClass = view.verdict === "MATCH" ? "match" : view.verdict === "MISMATCH" ? "mismatch" : "neutral";
  const commands = view.recipe.commands.map((command) => [command.executable, ...command.args].join(" ")).join("\n");
  const warnings = view.warnings.length === 0 ? "" : `<section><h2>Trust boundary</h2>${view.warnings.map((warning) => `<p class="warning">${escapeHtml(warning)}</p>`).join("")}</section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AegisOne verification</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;background:#f7f7f5}body{margin:0}.shell{max-width:980px;margin:0 auto;padding:48px 20px 80px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px}.brand{font-weight:800;letter-spacing:-.03em;font-size:24px}.badge{padding:8px 12px;border-radius:999px;font-weight:800;font-size:13px}.match{background:#dcfce7;color:#166534}.mismatch{background:#fee2e2;color:#991b1b}.neutral{background:#e5e7eb;color:#374151}.hero{background:white;border:1px solid #e5e7eb;border-radius:20px;padding:30px;box-shadow:0 10px 30px rgba(17,24,39,.05)}h1{font-size:36px;line-height:1.05;letter-spacing:-.04em;margin:0 0 12px}h2{font-size:18px;margin:0 0 14px}p{color:#4b5563;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}section{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:22px}.row{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid #f0f1f2}.row:last-child{border-bottom:0}.row span{color:#6b7280}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;text-align:right}pre{white-space:pre-wrap;background:#111827;color:#f9fafb;border-radius:12px;padding:16px;overflow:auto;font-size:12px}.warning{border-left:3px solid #f59e0b;padding-left:12px}.footer{margin-top:18px;color:#6b7280;font-size:13px}@media(max-width:720px){.grid{grid-template-columns:1fr}h1{font-size:30px}.row{display:block}.row code{display:block;text-align:left;margin-top:5px}}
</style></head><body><main class="shell"><header><div class="brand">AegisOne</div><div class="badge ${statusClass}">${escapeHtml(view.verdict)}</div></header>
<div class="hero"><h1>${escapeHtml(view.headline)}</h1><p>Independent reproduction evidence for an explicit publisher source claim. The verdict comes from AegisOne core byte checks, not from this page.</p></div>
<div class="grid"><section><h2>Source claim</h2>${row("Assurance", view.sourceClaim.assuranceLevel)}${row("Repository", view.sourceClaim.repository)}${row("Commit", view.sourceClaim.commitSha)}</section>
<section><h2>Independent build</h2>${row("Runner", view.build.runnerType === "0g" ? "0G Sandbox" : "local")}${row("Runtime", view.build.runtime)}${row("Provider", view.build.providerId ?? "not applicable")}${row("Attestation", view.build.attestation)}</section>
<section><h2>Publisher artifact</h2>${row("Name", view.artifacts.publisher.name)}${row("Bytes", String(view.artifacts.publisher.size))}${row("SHA-256", view.artifacts.publisher.sha256)}</section>
<section><h2>Reproduced artifact</h2>${row("Name", view.artifacts.reproduced.name)}${row("Bytes", String(view.artifacts.reproduced.size))}${row("SHA-256", view.artifacts.reproduced.sha256)}</section></div>
<section style="margin-top:18px"><h2>Build recipe</h2>${row("Working directory", view.recipe.workingDirectory)}${row("Artifact path", view.recipe.artifactPath)}<pre>${escapeHtml(commands)}</pre></section>
${warnings}<section style="margin-top:18px"><h2>Canonical evidence</h2>${row("Manifest SHA-256", view.manifestSha256)}${view.evidenceReferences.map((reference) => row("Evidence", reference)).join("")}</section>
<p class="footer">AegisOne reports source assurance and artifact correspondence separately. MATCH means the compared bytes agree; it is not a malware or safety verdict.</p></main></body></html>`;
}
