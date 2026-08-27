export type AdvisoryConcernLevel = "none" | "low" | "medium" | "high";

/**
 * Non-authoritative LLM advisory finding (docs/17-m8-security-boundaries.md, new "0G Compute
 * advisory pass" section). This can NEVER set `correspondence`, `sourceAssurance`, or a
 * deterministic `verdict` on its own — see `packages/skill-audit`'s existing
 * `SkillAuditReport.advisory` slot (`status: "NOT_RUN"` by default), which this package is the
 * first thing in the repository to actually fill in, and only when explicitly requested
 * per-call and only when `ZEROG_COMPUTE_PRIVATE_KEY` is configured.
 */
export interface AdvisoryFinding {
  readonly summary: string;
  readonly concernLevel: AdvisoryConcernLevel;
  readonly modelProvider: string;
  readonly ranAt: string;
}

/**
 * `runAdvisoryScan` never returns an "unavailable" outcome itself — whether the advisory tier is
 * configured at all (`ZEROG_COMPUTE_PRIVATE_KEY` present) is decided by the caller
 * (`apps/web/src/scan-service.ts`) *before* this function is ever invoked, so that "not
 * configured" always produces an explicit `advisory_unavailable` API state rather than this
 * package silently deciding to skip.
 */
export type AdvisoryScanOutcome =
  | { readonly status: "completed"; readonly finding: AdvisoryFinding }
  | { readonly status: "error"; readonly message: string };

export interface ZeroGComputeConfig {
  readonly privateKey: string;
  readonly modelProvider: string;
  readonly rpcUrl: string;
}

/**
 * Injectable transport boundary so `runAdvisoryScan` (advisory-scan.ts) is fully unit-testable
 * without ever making a real network call or requiring a funded 0G Compute ledger.
 * `createLiveZeroGComputeTransport` (live-transport.ts) is the only implementation that talks to
 * the real 0G Compute Network, and it is never imported by the deterministic test suite.
 */
export interface AdvisoryScanTransport {
  requestChatCompletion(input: {
    readonly systemPrompt: string;
    readonly userContent: string;
  }): Promise<{ readonly content: string; readonly modelProvider: string }>;
}
