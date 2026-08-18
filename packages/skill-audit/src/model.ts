import type { ComparisonResult } from "../../core/src/model.ts";

export type SkillAuditSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SkillAnalysisKind = "DETERMINISTIC_STATIC" | "LLM_ADVISORY";

export interface SkillPackageEntry {
  path: string;
  bytes: Uint8Array;
}

export interface SkillPackageSummary {
  format: "proofrail-agent-skill-package-v1";
  fileCount: number;
  byteLength: number;
  sha256: string;
  paths: string[];
}

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string;
  metadata: Record<string, string>;
  unknownFields: Record<string, string>;
}

export interface SkillFormatIssue {
  code:
    | "missing_skill_md"
    | "invalid_utf8"
    | "missing_frontmatter"
    | "invalid_frontmatter"
    | "invalid_name"
    | "name_directory_mismatch"
    | "invalid_description"
    | "invalid_compatibility"
    | "invalid_metadata";
  message: string;
  path: string;
  line?: number;
}

export interface SkillFormatValidation {
  valid: boolean;
  metadata: SkillMetadata | null;
  body: string | null;
  issues: SkillFormatIssue[];
}

export interface SkillAuditFinding {
  ruleId:
    | "PR-SKILL-001"
    | "PR-SKILL-002"
    | "PR-SKILL-003"
    | "PR-SKILL-004"
    | "PR-SKILL-005"
    | "PR-SKILL-006"
    | "PR-SKILL-007";
  title: string;
  severity: SkillAuditSeverity;
  analysisKind: "DETERMINISTIC_STATIC";
  path: string;
  line: number;
  evidence: string;
}

export interface SkillAuditReport {
  schemaVersion: "1";
  analysisKind: "DETERMINISTIC_STATIC";
  highestSeverity: SkillAuditSeverity;
  findingCount: number;
  findings: SkillAuditFinding[];
  advisory: {
    analysisKind: "LLM_ADVISORY";
    status: "NOT_RUN";
    findings: [];
  };
}

export interface SkillVerificationResult {
  schemaVersion: "1";
  artifactKind: "agent-skill";
  correspondence: ComparisonResult;
  publisherPackage: SkillPackageSummary;
  reproducedPackage: SkillPackageSummary;
  format: SkillFormatValidation;
  audit: SkillAuditReport;
}
