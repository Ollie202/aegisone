import type {
  CapabilityResource,
  SecuritySeverity,
  SourceAssuranceLevel,
  TrustDecision,
  TrustPolicy,
  TrustPolicyReason,
  TrustPolicyResult,
} from "./model.ts";

const SOURCE_ASSURANCE_RANK: Record<SourceAssuranceLevel, number> = {
  NONE: 0,
  DECLARED: 1,
  REPOSITORY_AUTHENTICATED: 2,
  SIGNED_RELEASE: 3,
};

const SEVERITY_RANK: Record<SecuritySeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function worstDecision(left: TrustDecision, right: TrustDecision): TrustDecision {
  const rank: Record<TrustDecision, number> = { ALLOW: 0, REVIEW: 1, DENY: 2 };
  return rank[right] > rank[left] ? right : left;
}

function missingReason(
  policy: TrustPolicy,
  code: TrustPolicyReason["code"],
  message: string,
): TrustPolicyReason {
  return { code, decision: policy.missingEvidenceDecision, message };
}

export function evaluateTrustPolicy(
  resource: CapabilityResource,
  policy: TrustPolicy,
  nowEpochMs: number,
): TrustPolicyResult {
  const reasons: TrustPolicyReason[] = [];

  if (policy.minimumSourceAssurance !== undefined) {
    const actual = resource.trust.sourceAssurance.level;
    const required = policy.minimumSourceAssurance;
    if (actual === "NONE") {
      reasons.push(missingReason(policy, "source_assurance_missing", `source assurance is missing; policy requires at least ${required}`));
    } else if (SOURCE_ASSURANCE_RANK[actual] < SOURCE_ASSURANCE_RANK[required]) {
      reasons.push({
        code: "source_assurance_below_requirement",
        decision: "DENY",
        message: `source assurance ${actual} is below required ${required}`,
      });
    }
  }

  if (policy.requireCorrespondence === "MATCH") {
    const status = resource.trust.correspondence.status;
    if (status === "NOT_EVALUATED" || status === "INSUFFICIENT_EVIDENCE") {
      reasons.push(missingReason(policy, "correspondence_missing", `correspondence evidence is ${status}`));
    } else if (status !== "MATCH") {
      reasons.push({
        code: "correspondence_not_match",
        decision: "DENY",
        message: `policy requires MATCH but observed ${status}`,
      });
    }
  }

  if (policy.maximumAuditSeverity !== undefined) {
    const security = resource.trust.security;
    if (security.status !== "COMPLETED" || security.highestSeverity === null) {
      reasons.push(missingReason(policy, "audit_missing", "required deterministic security assessment has not been completed"));
    } else if (SEVERITY_RANK[security.highestSeverity] > SEVERITY_RANK[policy.maximumAuditSeverity]) {
      reasons.push({
        code: "audit_severity_exceeded",
        decision: "DENY",
        message: `audit severity ${security.highestSeverity} exceeds maximum ${policy.maximumAuditSeverity}`,
      });
    }
  }

  if (policy.maximumEvidenceAgeHours !== undefined) {
    const canonical = resource.trust.canonicalEvidence;
    if (canonical.status !== "AVAILABLE" || canonical.verifiedAt === null) {
      reasons.push(missingReason(policy, "canonical_evidence_missing", "fresh canonical ProofRail evidence is required but unavailable"));
    } else {
      const verifiedAtMs = Date.parse(canonical.verifiedAt);
      if (!Number.isFinite(verifiedAtMs)) {
        reasons.push({ code: "canonical_evidence_invalid_time", decision: "DENY", message: "canonical evidence timestamp is invalid" });
      } else {
        const ageMs = nowEpochMs - verifiedAtMs;
        const maxAgeMs = policy.maximumEvidenceAgeHours * 60 * 60 * 1000;
        if (ageMs < 0 || ageMs > maxAgeMs) {
          reasons.push({
            code: "canonical_evidence_stale",
            decision: "DENY",
            message: `canonical evidence exceeds maximum age of ${policy.maximumEvidenceAgeHours} hours`,
          });
        }
      }
    }
  }

  let decision: TrustDecision = "ALLOW";
  for (const reason of reasons) {
    decision = worstDecision(decision, reason.decision);
  }

  return { schemaVersion: "1", decision, reasons };
}
