import type { SkillVerificationResult } from "../../../packages/skill-audit/src/model.ts";
import { createSkillVerificationView } from "../../../packages/skill-audit/src/presentation.ts";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function badgeClass(value: string): string {
  if (value === "MATCH" || value === "NO_FINDINGS") return "good";
  if (value === "MISMATCH" || value === "CRITICAL_FINDINGS" || value === "HIGH_FINDINGS") return "danger";
  return "warn";
}

export function renderSkillVerificationHtml(result: SkillVerificationResult): string {
  const view = createSkillVerificationView(result);
  const findings = result.audit.findings.length === 0
    ? "<p>No deterministic static findings were produced by the current rule set. This is not a guarantee of safety.</p>"
    : `<ul>${result.audit.findings.map((finding) => `<li><strong>${escapeHtml(finding.severity)} · ${escapeHtml(finding.ruleId)}</strong> — ${escapeHtml(finding.title)}<br><code>${escapeHtml(finding.path)}:${finding.line}</code><br><span>${escapeHtml(finding.evidence)}</span></li>`).join("")}</ul>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ProofRail Agent Skill verification</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;background:#f7f7f5}body{margin:0}.shell{max-width:980px;margin:0 auto;padding:48px 20px 80px}h1{font-size:38px;letter-spacing:-.04em;margin:0 0 10px}.lead{color:#4b5563;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px}.badge{display:inline-block;border-radius:999px;padding:8px 12px;font-weight:800;font-size:13px}.good{background:#dcfce7;color:#166534}.danger{background:#fee2e2;color:#991b1b}.warn{background:#fef3c7;color:#92400e}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}li{margin:14px 0;line-height:1.5}.warning{border-left:4px solid #f59e0b;padding:14px 16px;background:#fffbeb;border-radius:10px;font-weight:650}@media(max-width:720px){.grid{grid-template-columns:1fr}}</style></head><body><main class="shell"><h1>${escapeHtml(view.format.skillName ?? "Agent Skill")}</h1><p class="lead">${escapeHtml(view.format.description ?? "ProofRail Agent Skill verification")}</p><div class="grid"><section class="card"><h2>Source correspondence</h2><span class="badge ${badgeClass(view.correspondence.verdict)}">${escapeHtml(view.correspondence.verdict)}</span><p>Publisher package SHA-256</p><code>${escapeHtml(view.correspondence.publisherSha256)}</code><p>Independent package SHA-256</p><code>${escapeHtml(view.correspondence.reproducedSha256)}</code></section><section class="card"><h2>Deterministic static audit</h2><span class="badge ${badgeClass(view.audit.label)}">${escapeHtml(view.audit.label)}</span><p>${view.audit.findingCount} finding(s); highest severity ${escapeHtml(view.audit.highestSeverity)}.</p><p>LLM advisory analysis: <strong>NOT RUN</strong>.</p></section></div><p class="warning">MATCH means the distributed skill corresponds to the independently packaged source. It does not mean the skill is safe or benevolent.</p><section class="card"><h2>Static findings</h2>${findings}</section></main></body></html>`;
}
