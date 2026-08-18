import type { SkillAuditFinding, SkillAuditReport, SkillAuditSeverity, SkillPackageEntry } from "./model.ts";

const SEVERITY_RANK: Record<SkillAuditSeverity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

interface LineRule {
  ruleId: SkillAuditFinding["ruleId"];
  title: string;
  severity: SkillAuditSeverity;
  matches(line: string): boolean;
}

const sensitive = String.raw`(?:password|passphrase|private[ -]?key|seed[ -]?phrase|api[ -]?key|credential|secret|access[ -]?token|auth[ -]?token|id_rsa|\.ssh|\.env)`;
const collection = String.raw`(?:collect|read|copy|extract|capture|obtain|steal|send|upload|post|forward|paste|exfiltrat)`;
const network = String.raw`(?:curl\b|wget\b|Invoke-WebRequest\b|requests\.(?:post|put)\b|axios\.(?:post|put)\b|fetch\s*\(|https?://)`;

const rules: LineRule[] = [
  {
    ruleId: "PR-SKILL-001",
    title: "Credential or secret harvesting instruction",
    severity: "CRITICAL",
    matches: (line) => new RegExp(`(?:${collection}.{0,100}${sensitive}|${sensitive}.{0,100}${collection})`, "i").test(line),
  },
  {
    ruleId: "PR-SKILL-002",
    title: "Potential network exfiltration of sensitive material",
    severity: "CRITICAL",
    matches: (line) => new RegExp(`(?:${network}.{0,140}${sensitive}|${sensitive}.{0,140}${network})`, "i").test(line),
  },
  {
    ruleId: "PR-SKILL-003",
    title: "Destructive filesystem or device command",
    severity: "CRITICAL",
    matches: (line) => /\brm\s+(?:-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*|-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*)\s+(?:\/|~|\$HOME)(?:\s|[`'";]|$)|\bmkfs(?:\.|\s)|\bdd\s+[^\n]*\bof=\/dev\/|\bformat\s+[a-z]:\s*(?:\/|$)|Remove-Item\b[^\n]*(?:-Recurse[^\n]*[A-Z]:\\|[A-Z]:\\[^\n]*-Recurse)/i.test(line),
  },
  {
    ruleId: "PR-SKILL-004",
    title: "Remote download piped directly to code execution",
    severity: "HIGH",
    matches: (line) => /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python\d*|node)\b|Invoke-WebRequest\b[^\n]*(?:Invoke-Expression|\biex\b)|DownloadString\s*\([^)]*\)[^\n]*(?:Invoke-Expression|\biex\b)/i.test(line),
  },
  {
    ruleId: "PR-SKILL-005",
    title: "Encoded payload decoded into execution",
    severity: "HIGH",
    matches: (line) => /\bbase64\b[^\n]*(?:-d|--decode)[^\n]*\|\s*(?:sh|bash|zsh|python\d*|node)\b|\beval\s*\([^\n]*(?:atob|fromBase64)|\bexec\s*\([^\n]*b64decode/i.test(line),
  },
  {
    ruleId: "PR-SKILL-006",
    title: "Persistence or startup modification",
    severity: "HIGH",
    matches: (line) => /\bcrontab\b|\bsystemctl\s+enable\b|\/etc\/systemd\/system\/|Library\/LaunchAgents|CurrentVersion\\Run\b|(?:>>|tee\s+-a)\s*(?:~\/)?\.(?:bashrc|zshrc|profile)\b/i.test(line),
  },
];

function printableLines(entry: SkillPackageEntry): string[] | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes);
    if (text.includes("\u0000")) return null;
    return text.split(/\r?\n/);
  } catch {
    return null;
  }
}

function evidence(line: string): string {
  const compact = line.trim().replace(/\s+/g, " ");
  return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}

function executableLooking(entry: SkillPackageEntry): boolean {
  if (/\.(?:sh|bash|py|js|mjs|cjs|ts|ps1|bat|cmd|exe|bin)$/i.test(entry.path)) return true;
  const prefix = new TextDecoder("utf-8").decode(entry.bytes.slice(0, 2));
  return prefix === "#!";
}

export function auditSkillPackage(entries: readonly SkillPackageEntry[]): SkillAuditReport {
  const findings: SkillAuditFinding[] = [];
  const skillText = entries.find((entry) => entry.path === "SKILL.md");
  const declaredText = skillText ? (printableLines(skillText)?.join("\n") ?? "") : "";

  for (const entry of entries) {
    const lines = printableLines(entry);
    if (lines) {
      for (let index = 0; index < lines.length; index += 1) {
        for (const rule of rules) {
          if (!rule.matches(lines[index])) continue;
          findings.push({
            ruleId: rule.ruleId,
            title: rule.title,
            severity: rule.severity,
            analysisKind: "DETERMINISTIC_STATIC",
            path: entry.path,
            line: index + 1,
            evidence: evidence(lines[index]),
          });
        }
      }
    }

    if (entry.path !== "SKILL.md" && !entry.path.startsWith("scripts/") && executableLooking(entry) && !declaredText.includes(entry.path)) {
      findings.push({
        ruleId: "PR-SKILL-007",
        title: "Executable-looking resource outside scripts/ is not declared in SKILL.md",
        severity: "MEDIUM",
        analysisKind: "DETERMINISTIC_STATIC",
        path: entry.path,
        line: 1,
        evidence: entry.path,
      });
    }
  }

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.ruleId.localeCompare(b.ruleId));
  let highestSeverity: SkillAuditSeverity = "INFO";
  for (const finding of findings) if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highestSeverity]) highestSeverity = finding.severity;

  return {
    schemaVersion: "1",
    analysisKind: "DETERMINISTIC_STATIC",
    highestSeverity,
    findingCount: findings.length,
    findings,
    advisory: { analysisKind: "LLM_ADVISORY", status: "NOT_RUN", findings: [] },
  };
}
