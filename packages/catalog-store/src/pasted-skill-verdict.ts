import type { PastedSkillScanVerdict, SecuritySeverity } from "./model.ts";

/**
 * Deterministic verdict thresholds for paste-to-scan (new feature). Derived *only* from the
 * unmodified `@aegisone/skill-audit` Tier-1 `SkillAuditReport.highestSeverity` — never from an
 * LLM advisory opinion, search relevance, or any other signal:
 *
 * - `INFO` / `LOW` / no findings -> `CLEAN`
 * - `MEDIUM` / `HIGH`            -> `FLAGGED`
 * - `CRITICAL`                   -> `BLACKLISTED`
 *
 * This mirrors the existing repository convention of centralizing threshold policy in one pure,
 * independently testable function (`capability-verification-validation.ts`,
 * `source-claim-transition.ts`) rather than scattering it across call sites.
 */
export function deriveVerdictFromHighestSeverity(highestSeverity: SecuritySeverity): PastedSkillScanVerdict {
  switch (highestSeverity) {
    case "CRITICAL":
      return "BLACKLISTED";
    case "HIGH":
    case "MEDIUM":
      return "FLAGGED";
    case "LOW":
    case "INFO":
      return "CLEAN";
  }
}
