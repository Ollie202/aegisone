# M8.9 Live Run Runbook — Repository-Authenticated Substitution Proof on Real 0G Evidence

**Status:** not executed. This document specifies exactly what a human with the missing
credentials/funds/approval must run to produce the live version of the M8.9 (Issue #28) proof.
The coding agent that authored this runbook did not, and could not, run any of the steps below —
see `PROJECT_STATE.md` M8.9 section for what was proven locally instead.

## What this runbook produces

The live counterpart of `apps/web/test/m8-9-substitution-demo.test.ts`: the same eight-step
narrative (discovery -> `REPOSITORY_AUTHENTICATED` source claim -> genuine distribution -> `MATCH`
-> policy `ALLOW` via REST and MCP -> substituted distribution -> `MISMATCH` -> policy `DENY` via
REST and MCP -> source-assurance-unchanged check), but against:

- a real public GitHub repository, with a real interactive OAuth authorization instead of a fake
  GitHub backend;
- a real 0G Sandbox independent reproduction instead of the local `runSkillVerificationEnrichment`
  in-process call;
- a real 0G Storage upload/proof-verified readback for canonical evidence instead of `null`
  canonical-evidence fields;
- (optionally) a real Galileo registry commitment, following the same pattern
  `hackathon/m7-live-evidence.json` already recorded for M7.

Nothing in this runbook introduces new verification logic. Every command below drives the exact
same M8.1-M8.8 code paths the local proof already exercises; the only difference is that the
GitHub identity, the independent reproduction, and the canonical evidence storage become real.

## Preconditions — both are repo-owner actions, neither exists in any agent context

### 1. GitHub App (M8.5 live dependency, still outstanding as of this writing)

Per `docs/14-source-authentication.md`:

1. Create/install a GitHub App named (or similar to) `ProofRail Source Verifier`, scoped to the
   repository you will use as the genuine source for this demo (a small public repository you
   control — it can be a new throwaway repo created specifically for this proof, e.g.
   `<your-org>/proofrail-m8-9-demo-skill`, containing one `SKILL.md` under a subdirectory).
2. Record the generated client ID/client secret.
3. Set the following on `proofrail-app` (Railway environment variables, or a local `.env` for a
   dry run against `pnpm --filter @proofrail/web start`):

   ```bash
   GITHUB_APP_CLIENT_ID=<generated>
   GITHUB_APP_CLIENT_SECRET=<generated>
   GITHUB_APP_SLUG=<generated>
   GITHUB_OAUTH_CALLBACK_URL=https://<your-proofrail-app-host>/auth/github/callback
   GITHUB_OAUTH_STATE_SECRET=<a fresh high-entropy random string, at least 32 characters>
   ```

4. Install the App on the demo repository, granting it at minimum read access to metadata and
   contents (the App itself does not need write access — what matters is that the *authorizing
   GitHub user* has `admin`/`maintain`/`write` on the repository, per the M8 authority ladder in
   `docs/14-source-authentication.md`).

### 2. 0G Galileo testnet funds + explicit spend approval (AGENTS.md cost discipline)

1. Use a **disposable** funded Galileo testnet wallet, the same pattern
   `packages/storage-0g/.env.example` and `packages/m7-flow/scripts/run-live.ts` already use —
   never a mainnet key.
2. Set `ZEROG_STORAGE_PRIVATE_KEY` wherever the worker-side scripts below run.
3. Obtain **explicit, separate approval** for this specific live spend before running anything in
   this section — AGENTS.md's cost discipline ("No paid API, large compute service, arbitrary live
   verification spend, or mainnet transaction without explicit approval") and this repository's
   working method both require this as a distinct step, not something a coding agent context can
   authorize on your behalf. No Aristotle mainnet transaction is required anywhere in this
   runbook.

## Step-by-step

### Step 1 — prepare the genuine and substituted demo repository state

1. Create (or reuse) a small public GitHub repository containing exactly one Agent Skill, e.g.:

   ```text
   m8-9-demo-skill/SKILL.md
   ```

2. Commit it. Record the exact commit SHA (`git rev-parse HEAD`) — this is the immutable source
   claim's `source.commitSha`. Never use a branch name.
3. Build the genuine canonical distribution package locally, the same way
   `packages/skill-verification-link/test/fixtures.ts`'s `genuineDistributionBytesFor` does, from
   the *exact same* `SKILL.md` content as the committed source, and host it somewhere reachable
   over HTTPS (a GitHub Release asset on the same repository is the simplest option and also keeps
   the distribution's provenance visibly tied to the same publisher).
4. Record its SHA-256.

### Step 2 — real repository-authenticated source claim

1. With `proofrail-app` running and the GitHub App configured (Step 1 of Preconditions), open
   `GET /auth/github/start?returnTo=<your-return-path>` in a browser, signed in as a GitHub user
   with `admin`/`maintain`/`write` on the demo repository, and complete the interactive
   authorization (this step cannot be scripted).
2. List authorized repositories: `GET /api/v1/source-auth/github/repositories` (using the session
   cookie the callback set) and confirm the demo repository shows `sufficientAuthority: true`,
   `supported: true`.
3. Submit the claim:

   ```bash
   curl -X POST https://<host>/api/v1/source-claims \
     -H 'content-type: application/json' \
     -H "cookie: pr_gh_session=<from the browser session>" \
     -d '{
       "resourceId": "<a resource id you have discovered/created>",
       "resourceVersionId": "<the matching version id>",
       "repositoryFullName": "<your-org>/proofrail-m8-9-demo-skill"
     }'
   ```

4. Confirm the response's `claim.assuranceLevel` is `REPOSITORY_AUTHENTICATED` and
   `claim.sourceCommitSha` matches Step 1's recorded commit. Record the returned `claim.id`.

### Step 3 — genuine independent reproduction via real 0G Sandbox, real 0G Storage

This step must run from `proofrail-worker` (or an equivalent trusted, secret-bearing context) —
never from a public route, per AGENTS.md ("no public generic worker execution/signing route").

1. Acquire the exact source commit and run the *unmodified* `runSkillVerificationEnrichment`
   (`packages/skill-verification-link/src/enrichment.ts`) against:
   - `source`: `{ repositoryUrl: "https://github.com/<your-org>/proofrail-m8-9-demo-skill", commitSha: "<Step 1 commit>", subdirectory: "m8-9-demo-skill" }` — no `allowLocalFixtureRepository` flag this time, since the repository is real;
   - `distribution`: `{ url: "<Step 1 genuine distribution URL>", expectedSha256: "<Step 1 SHA-256>" }`.
2. Where independent reproduction should run inside 0G Sandbox rather than the worker's own
   process, use `packages/sandbox-0g` (the same adapter `packages/m7-flow/scripts/run-live.ts`
   already drives for M7) to execute the equivalent canonical build/package step remotely, and feed
   its resulting entries/digest into the same correspondence comparison
   (`packages/skill-audit/src/verify.ts`'s `verifySkillPackages`, called unmodified by
   `evaluateWithDistribution`) — do not reimplement comparison logic for the live path.
3. Confirm `correspondence.status === "MATCH"` and `publisherSha256 === reproducedSha256`.
4. Upload the canonical evidence bundle through the existing `packages/storage-0g` round trip
   (the same pattern `packages/m7-flow/scripts/run-live.ts` / `hackathon/m7-live-evidence.json`
   already used for M7) and confirm proof-verified exact-byte readback. Record:
   - canonical evidence SHA-256;
   - 0G Storage root;
   - 0G Storage transaction hash.
5. Persist a `capability_verifications` row via `CatalogStore.createCapabilityVerification`
   (`buildCapabilityVerificationInput`, `packages/skill-verification-link/src/verification-record.ts`)
   with `sourceClaimId` set to Step 2's claim id and the real canonical-evidence fields from this
   step (never fabricated placeholders).

### Step 4 — genuine path demo clients: REST and MCP `ALLOW`

```bash
curl -X POST https://<host>/api/v1/policy/evaluate \
  -H 'content-type: application/json' \
  -d '{
    "policy": {
      "schemaVersion": "1",
      "missingEvidenceDecision": "DENY",
      "minimumSourceAssurance": "REPOSITORY_AUTHENTICATED",
      "requireCorrespondence": "MATCH",
      "maximumAuditSeverity": "MEDIUM"
    },
    "resourceId": "<your resource id>"
  }'
```

Confirm `"decision": "ALLOW"`.

Repeat the same policy/resourceId payload through `proofrail_evaluate` from a real MCP client
(Claude Desktop, Claude Code's own `/mcp` config, or the MCP TypeScript SDK's `Client` pointed at
`POST https://<host>/mcp`) and confirm the same `ALLOW` decision.

### Step 5 — controlled substitution: same identity/source, changed distribution bytes

1. Build a second distribution package from a **deliberately modified** `SKILL.md` — the same
   bounded, unambiguous-tamper pattern the local proof and M7's own controlled-mismatch fixture
   both use (a clearly malicious/altered instruction, never something that could be mistaken for
   ordinary version drift). Host it at a second URL; do not overwrite the genuine artifact.
2. Re-run Step 3 with this substituted distribution URL/SHA-256, the *exact same* source claim and
   commit SHA. Confirm `correspondence.status === "MISMATCH"` and
   `publisherSha256 !== reproducedSha256`, while `reproducedSha256` matches Step 3's value exactly
   (the independent reproduction did not change — only the distribution did).
3. Persist a **new** `capability_verifications` row (never mutate Step 3's row) with the same
   `sourceClaimId`.

### Step 6 — substitution path demo clients: REST and MCP `DENY`

Repeat Step 4's exact REST and MCP calls. Confirm `"decision": "DENY"` on both, with non-empty
`reasons`.

### Step 7 — verify source assurance is unchanged

```bash
curl https://<host>/api/v1/resources/<your resource id>/evidence
```

Confirm `trust.sourceAssurance.level` is still `REPOSITORY_AUTHENTICATED`, `sourceClaims` still
contains exactly Step 2's claim id with `integrityCheckPassed: true`, and
`trust.correspondence.status` now reads `MISMATCH` — the mismatch changed correspondence only,
never source assurance.

### Step 8 — record the evidence ledger entry

Append a `hackathon/m8-9-live-evidence.json` entry mirroring the shape of
`hackathon/m7-live-evidence.json`, containing only values actually observed in Steps 1-7:

```json
{
  "sourceRepository": "<your-org>/proofrail-m8-9-demo-skill",
  "sourceCommitSha": "<Step 1 commit>",
  "sourceClaim": { "id": "<Step 2 claim id>", "assuranceLevel": "REPOSITORY_AUTHENTICATED" },
  "genuine": {
    "publisherSha256": "<Step 3>",
    "reproducedSha256": "<Step 3>",
    "correspondence": "MATCH",
    "canonicalEvidenceSha256": "<Step 3>",
    "storageRoot": "<Step 3>",
    "storageTransaction": "<Step 3>",
    "policyDecisionRest": "ALLOW",
    "policyDecisionMcp": "ALLOW"
  },
  "substituted": {
    "publisherSha256": "<Step 5>",
    "reproducedSha256": "<Step 5, equal to genuine.reproducedSha256>",
    "correspondence": "MISMATCH",
    "policyDecisionRest": "DENY",
    "policyDecisionMcp": "DENY"
  },
  "sourceAssuranceUnchanged": true
}
```

Never fill in a field with a plausible-looking value that was not actually observed; leave it
`null`/omit it and note why in the same commit's PR description.

## Cleanup

- Stop/terminate any 0G Sandbox instance created in Step 3/Step 5 rather than leaving it running.
- Do not leave the demo GitHub repository's substituted-artifact release asset as the default
  download if the repository is meant to stay usable afterward — clearly label it
  (`m8-9-demo-substituted-DO-NOT-USE.skillpkg`) or delete it once the evidence ledger entry is
  recorded.
- Rotate/revoke the disposable Galileo wallet key if it will not be reused.

## What NOT to do

- Do not run this against Aristotle mainnet.
- Do not skip Step 7 — it is the one check this entire milestone exists to demonstrate.
- Do not substitute a second real, differently-authored repository/commit as the "substitution" —
  that would be legitimate source divergence (`DIVERGED`/insufficient evidence per AGENTS.md), not
  a controlled tamper of a single claimed release.
- Do not report M8.9's full acceptance criteria as met until every value in the Step 8 ledger entry
  was actually observed from a real run following this runbook.
