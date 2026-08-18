import type { ComparisonCheck } from "../../core/src/model.ts";
import type { SkillAuditSeverity, SkillVerificationResult } from "./model.ts";

const SEVERITY_RANK: Record<SkillAuditSeverity, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface SkillVerificationView {
  artifactKind: "agent-skill";
  correspondence: {
    verdict: "MATCH" | "MISMATCH" | "DIVERGED" | "INSUFFICIENT_EVIDENCE";
    publisherSha256: string;
    reproducedSha256: string;
  };
  format: {
    publisherValid: boolean;
    reproducedValid: boolean;
    skillName: string | null;
    description: string | null;
  };
  audit: {
    analysisKind: "DETERMINISTIC_STATIC";
    highestSeverity: SkillAuditSeverity;
    findingCount: number;
    label: "NO_FINDINGS" | `${SkillAuditSeverity}_FINDINGS`;
  };
  trustStatement: "MATCH_DOES_NOT_MEAN_SAFE";
}

function expectedChecks(equal: boolean): ComparisonCheck[] {
  return [
    { id: "publisher_artifact_present", passed: true },
    { id: "reproduced_artifact_present", passed: true },
    { id: "sha256_equal", passed: equal },
  ];
}

function checksEqual(a: readonly ComparisonCheck[], b: readonly ComparisonCheck[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry.id === b[index]!.id && entry.passed === b[index]!.passed);
}

export function createSkillVerificationView(result: SkillVerificationResult): SkillVerificationView {
  if (result.schemaVersion !== "1" || result.artifactKind !== "agent-skill") throw new TypeError("Unsupported Agent Skill verification schema");
  if (result.publisherPackage.format !== "proofrail-agent-skill-package-v1" || result.reproducedPackage.format !== "proofrail-agent-skill-package-v1") {
    throw new TypeError("Unsupported Agent Skill package format");
  }
  if (!/^[0-9a-f]{64}$/.test(result.publisherPackage.sha256) || !/^[0-9a-f]{64}$/.test(result.reproducedPackage.sha256)) {
    throw new TypeError("Agent Skill package summaries require lowercase SHA-256 digests");
  }

  const equal = result.publisherPackage.sha256 === result.reproducedPackage.sha256;
  const expectedStatus = equal ? "MATCH" : "MISMATCH";
  if (result.correspondence.publisherDigest !== result.publisherPackage.sha256) throw new TypeError("Publisher correspondence digest does not match package summary");
  if (result.correspondence.reproducedDigest !== result.reproducedPackage.sha256) throw new TypeError("Reproduced correspondence digest does not match package summary");
  if (result.correspondence.status !== expectedStatus) throw new TypeError("Correspondence status does not match package digests");
  if (!checksEqual(result.correspondence.checks, expectedChecks(equal))) throw new TypeError("Correspondence checks do not match package digests");

  if (result.audit.analysisKind !== "DETERMINISTIC_STATIC" || result.auditTarget !== "publisher") {
    throw new TypeError("Agent Skill static audit provenance is invalid");
  }
  if (result.audit.findingCount !== result.audit.findings.length) throw new TypeError("Audit finding count does not match findings array");
  if (result.audit.advisory.analysisKind !== "LLM_ADVISORY" || result.audit.advisory.status !== "NOT_RUN" || result.audit.advisory.findings.length !== 0) {
    throw new TypeError("LLM advisory state is inconsistent");
  }
  let highest: SkillAuditSeverity = "INFO";
  for (const finding of result.audit.findings) {
    if (finding.analysisKind !== "DETERMINISTIC_STATIC") throw new TypeError("Static audit contains a non-deterministic finding");
    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highest]) highest = finding.severity;
  }
  if (result.audit.highestSeverity !== highest) throw new TypeError("Audit highest severity does not match findings");

  const metadata = result.publisherFormat.metadata;
  return {
    artifactKind: "agent-skill",
    correspondence: {
      verdict: result.correspondence.status,
      publisherSha256: result.publisherPackage.sha256,
      reproducedSha256: result.reproducedPackage.sha256,
    },
    format: {
      publisherValid: result.publisherFormat.valid,
      reproducedValid: result.reproducedFormat.valid,
      skillName: metadata?.name ?? null,
      description: metadata?.description ?? null,
    },
    audit: {
      analysisKind: "DETERMINISTIC_STATIC",
      highestSeverity: result.audit.highestSeverity,
      findingCount: result.audit.findingCount,
      label: result.audit.findingCount === 0 ? "NO_FINDINGS" : `${result.audit.highestSeverity}_FINDINGS`,
    },
    trustStatement: "MATCH_DOES_NOT_MEAN_SAFE",
  };
}
