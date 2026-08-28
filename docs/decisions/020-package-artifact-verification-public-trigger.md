# ADR-020 — Resolving the Package / Artifact Verification deferral with a catalog-scoped public trigger

## Status

Accepted. Implemented by the `feature/package-verification` branch. Supersedes section 3 of
`docs/decisions/018-audit-lab-and-package-verification-deferral.md` (that ADR's other decisions —
the four-card Audit Lab, the plain-English report, the two seeded fixtures — stand unchanged).

## Context

M8.6 built the whole Package / Artifact Verification engine in
`packages/skill-verification-link`: bounded exact-commit Git source acquisition, an SSRF-hardened
bounded distribution downloader, the brand-gated `VerificationAuthorization`, a concurrency
limiter, and an orchestrator that hands the real comparison to the existing unmodified
`verifySkillPackages`. It shipped with no HTTP route of any kind, deliberately.

ADR-018 then evaluated exposing it and refused, for a reason that was correct at the time: a
verification is a real bounded `git clone` plus a real bounded artifact download. That is genuine
compute, and `docs/17-m8-security-boundaries.md` Threat M8-005 ("verification spend abuse")
forbids letting anonymous callers trigger expensive work at will. Rather than wire a rushed route
around a security-critical gate, ADR-018 marked the audit type **upcoming** and named exactly what
a future PR would owe: catalog-only scoping, an independent strict rate limit, and a real
end-to-end proof.

That is what this ADR delivers. The Audit Lab now has two live audit types instead of one.

## Decision

### 1. The trigger is public and unauthenticated — because the caller cannot name a target

`POST /api/v1/verify` accepts exactly one field:

```json
{ "resourceId": "<an id already in the AegisOne catalog>" }
```

No repository. No commit. No URL. No subdirectory. Every network target — the clone URL, the exact
commit SHA, the subdirectory, and the distribution artifact reference — is read back out of the
named resource's own recorded source claim (or, absent a claim, its recorded `resource_versions`
source pin). `apps/web/src/verify-trigger.ts` contains no code path that turns caller-controlled
text into a clone target or a fetch target.

This is the whole argument. The reachable attack surface is **the curated catalog, not the open
internet**. A `resourceId` that is not in the catalog, or one whose row carries no exact immutable
source revision, is refused with `409 no_verifiable_target` before any network or filesystem work
happens — there is deliberately no branch that fetches it anyway. Extra fields in the request body
are inert; `apps/web/test/package-verification.test.ts` submits `repositoryUrl`,
`distributionUrl: https://169.254.169.254/...` and a `file:///etc/passwd` source alongside an
unknown `resourceId` and asserts the engine is never entered.

Two further filters narrow it again: the stored repository must normalize to
`https://github.com/<owner>/<repo>` (anything else is not verifiable), and the stored revision must
be a full 40-hex commit SHA — never a branch name, which would make "the source" mutable.

**Why not the operator-token fallback ADR-018 offered?** Because the two cases are genuinely
different. `POST /api/v1/publish` spends real funds from the worker's signer, and AegisOne has no
accounts to attribute or budget a spend to; there is no honest way to make that anonymous, which is
why `publish-trigger.ts` is operator-gated and says so. A verification spends no funds. It costs
CPU, bandwidth and disk on AegisOne's own infrastructure, bounded per run, against a repository
AegisOne itself catalogued. That is a cost worth paying to make the product's central claim —
"reproduce it yourself" — something a visitor can actually press. Hiding the one audit type that
produces real MATCH/MISMATCH evidence behind a token nobody has would be a second deferral wearing
a different hat.

The operator lock is still available as a **deployment hardening lever**, not as the gate:
setting `AEGISONE_VERIFY_OPERATOR_TOKEN_SHA256` makes the route additionally demand a bearer token,
checked constant-time, before it spends any rate budget. Unset (the default) the route is public
and still catalog-scoped.

### 2. Four gates, all of which must pass

1. **Optional operator lock**, checked first — before the rate limiter, so unauthorized traffic
   cannot burn an operator's budget, and before any store read, so it cannot be an existence oracle.
2. **A strict independent rate limit**: `VERIFY_RATE_LIMIT = 3` per hour per client, using the same
   `FixedWindowRateLimiter` pattern as the other routes but its **own instance**, shared with
   nothing. For contrast, Tier-1 paste-to-scan allows 60 per 10 minutes — that is a cheap-read
   budget and was explicitly the wrong model here.
3. **A concurrency cap of one**, using the existing `VerificationConcurrencyLimiter` from M8.6
   unmodified, so a burst cannot fan out into parallel clones. A second simultaneous request gets
   `429 verification_in_progress` rather than queueing indefinitely.
4. **The existing brand-gated `VerificationAuthorization`**, neither weakened nor bypassed. The
   trigger mints one via `authorizeVerificationTrigger` from a per-process `randomBytes(32)` token
   whose digest it holds, so the constant-time comparison genuinely runs and the branded value the
   engine receives is real. Nothing outside that module can obtain the token, so nothing outside it
   can mint an authorization. This is precisely the "the server holds the token internally and
   authorizes on a caller's behalf once they select an existing catalog resource/version" design
   ADR-018 named as the only realistic safe shape.

Every M8.6 SSRF / size / timeout / redirect / archive protection stays in force, unmodified: the
trigger calls `runSkillVerificationEnrichment` and alters none of its production options.

### 3. Source-only still cannot emit MATCH or MISMATCH

This invariant is unchanged and its enforcement is unchanged. `enrichment.ts` is the structural
guarantee: `evaluateSourceOnly` has no `publisherEntries` value in scope and contains no reference
to `verifySkillPackages`, so there is nothing for it to compare and nothing that could return a
correspondence verdict. The existing structural test still passes.

The trigger adds one belt-and-braces check on top rather than replacing that: if the resolved
target had no distribution and the engine nonetheless returned anything other than `NOT_EVALUATED`,
the trigger refuses with `500 correspondence_without_distribution` and writes nothing. That can only
fire if the structure above is broken by a future edit — at which point refusing is correct.
`apps/web/test/m8-11-hostile-full-stack.test.ts` drives a deliberately compromised engine that
returns `MATCH` for a source-only target and asserts the refusal, and that no row is written.

Correspondingly, MATCH always rests on two genuinely distinct acquisitions: a `git clone` of an
exact commit, and an independent HTTP download of the publisher's artifact. The same bytes are
never packaged twice and called correspondence.

### 4. Results are appended, never revised

Each run builds its row through the existing `buildCapabilityVerificationInput`, runs
`validateNewCapabilityVerification` explicitly (refusing rather than persisting on any issue), and
inserts a **new** `capability_verifications` row. Prior verdicts are untouched — the Evidence
Passport's verification history shows a MATCH and a later MISMATCH side by side, which is exactly
the substitution story M8.9 proved. `canonicalEvidenceSha256` / `storageRoot` and every other 0G
pointer stay `null`: publishing evidence to 0G remains the separate, funded, operator-gated act in
`publish-trigger.ts`, and a verification never fabricates one.

### 5. The two repository fixtures now carry a DECLARED source claim

ADR-018 seeded `examples/agent-skills/clean-review` and `examples/agent-skills/malicious-sync` with
no source claim, correctly, because nothing could act on one. Now something can. Each fixture
records the exact immutable commit its bytes live at in this public repository —
`https://github.com/Ollie202/aegisone` at `eeac27076bbd98f99a147f51004d8ce07afad331` — so the
Audit Lab has a real, live, independently checkable target rather than a promise.

The level is `DECLARED` and deliberately not more: no authorization flow ran, no authority
observation exists, and none is invented. `sourceInspection` still starts `NOT_RUN` and
`correspondence` still `NOT_EVALUATED` — recording where source is claimed to be is a different act
from going and reproducing it, and neither fixture has a distinct *distributed* artifact, so
correspondence is structurally unevaluable for them. Verifying one produces a real `INSPECTED` row
and nothing more, which is the honest outcome.

That this works is checkable: an independent clone of that commit reproduces
`5bf754ab6273fadfb7fe358d9b41a8ef15160dbe7e7efb0df4c63cf780db0434` for `clean-review`, the exact
digest `apps/web/test/library-seed-fixtures.test.ts` has pinned since PR 2.

### 6. The UI shows what was inspected, what was compared, and what it does not mean

`apps/web/src/ui/verify-view.mjs` is isomorphic and on the static allowlist, so the server render
and the browser refresh run one renderer. It states, in the register PR 2 established: the exact
repository/commit/subdirectory read, the independently packaged source digest, the correspondence
state with both digests where a comparison genuinely happened, and the audit result labelled with
which package it ran against. Then, unconditionally — on MATCH included — a "What this does NOT
prove" block: MATCH is not safe, a clean audit is not source authentication, a declared repository
is not an authorised one, and nothing was installed or executed.

The Audit Lab's selector offers only server-resolved catalog targets. There is no repository field,
no commit field and no URL field anywhere in the UI, because the backend would refuse one — the
absence is the feature, and the page says so.

## Consequences

**Good.** The Audit Lab's second audit type is genuinely live, publicly reachable, and produces
real MATCH / MISMATCH / DIVERGED evidence from real bytes. The M8.6 engine stops being
fully-built-but-unreachable. The Evidence Passport gains a "reproduce this yourself" button on any
resource that actually has an exact source revision, and honestly says so where one does not.

**Costs and limits, stated plainly.**

- **Exact-commit source acquisition needs a `git` binary.** Some serverless runtimes do not ship
  one. The trigger probes once per process and answers `503 source_acquisition_unavailable` where
  it is absent, and the Audit Lab says so up front rather than letting a user discover it mid-run.
  It never silently substitutes a different acquisition mechanism. On the Railway `proofrail-app`
  deployment and in local runs `git` is present and the feature is fully live; whether a given
  Vercel deployment can run it is answered at runtime by that probe, not asserted here.
- **The rate limiter and the concurrency cap are per-process and in-memory.** On a single instance
  they are exactly what they claim to be. Behind multiple instances (or serverless fan-out) they
  bound each instance, not the fleet. This is the same documented limitation the paste-to-scan
  limiter already carries; a distributed limiter is the honest fix if traffic ever warrants it. The
  catalog scoping, not the limiter, is the load-bearing control.
- **A poisoned catalog row could direct a clone at a repository AegisOne did not intend.** Catalog
  writes are not a public surface, the target must still be a GitHub repository at an exact commit,
  and the run is bounded and records only what actually happened — but the scoping argument is only
  as good as the catalog, and that is worth saying out loud rather than implying the trigger is
  unconditionally safe.
- **Smart Contract Audit and MCP / Agent Capability Audit remain unimplemented.** Nothing here
  moves them closer; they stay honestly labelled upcoming.

## Alternatives considered

**Keep the deferral and ship nothing.** Rejected: ADR-018's reasoning was about the absence of a
safe design, not about the feature being undesirable, and a safe design now exists and is tested.

**Operator-gate it like publishing.** Rejected as the *primary* gate, kept as an optional lever. See
section 1: publication spends funds, verification does not, and gating the only audit type that
produces real correspondence evidence would leave the Audit Lab honest but hollow.

**Accept a caller-supplied repository URL with an allowlist.** Rejected. An allowlist of hosts is
not an allowlist of *targets*; it would still let an anonymous caller aim a clone at any repository
on GitHub, which is precisely the unbounded work Threat M8-005 names. Catalog membership is a
strictly stronger and much simpler property to reason about.

**Fall back to a GitHub tarball download where `git` is unavailable.** Rejected for now. It would
work, but it introduces a second source-acquisition path with its own archive-extraction attack
surface (Threat M8-004) that must stay byte-for-byte equivalent to the `git` path or the meaning of
"independent reproduction" quietly diverges between deployments. An explicit
`source_acquisition_unavailable` is the honest failure until that equivalence can be proven rather
than assumed.
