# ProofRail *(working name)*

> Independently rebuild software from its publisher-declared source and give humans or AI agents evidence of whether the published artifact actually matches.

**Status:** M6 product runtime proven; Agent Skills are the next artifact family  
**Current target:** 0G Bridge Buildathon — Wave 3  
**Working-name warning:** `ProofRail` is not considered brand-safe yet. An unrelated active public project already uses the name in the trust/verification space. See `research/brand-risk.md`.

## The problem

A public GitHub repository does **not** by itself prove that the binary, archive, package, or container users download was actually built from that source. A compromised release server, CI system, maintainer account, or distribution pipeline can serve different bytes while the public source still looks clean.

## What ProofRail actually proves

ProofRail separates two different claims:

1. **Source claim** — the publisher declares which repository, exact commit, build recipe, and release artifact correspond to a release.
2. **Build correspondence** — an independent builder rebuilds that exact source and compares the resulting artifact digest with the published artifact.

ProofRail must never pretend it can magically discover the "official" repository. If publisher ownership has not been authenticated, the UI says **Source Declared**, not **Official Source Verified**.

A tiny source change creates a new Git commit and therefore a new release claim. Historical verification records remain pinned to the exact immutable commit used for that release.

## Proven 0G verification path

```text
explicit source claim
  -> publisher artifact bytes
  -> exact immutable Git commit
  -> independent 0G Sandbox rebuild
  -> core SHA-256 comparison
  -> MATCH / MISMATCH
  -> canonical verification evidence
  -> proof-verified 0G Storage round trip
  -> 0G Aristotle mainnet registry anchor
  -> shared CLI/web verification projection
```

Observed genuine result:

```text
Publisher artifact SHA-256       9978d500...d9aa154
Independent 0G rebuild SHA-256   9978d500...d9aa154
                                 ----------------
                                 MATCH
```

A one-byte substituted publisher artifact produces a different digest while the independently reproduced bytes remain unchanged, so ProofRail reports `MISMATCH`.

The canonical genuine verification was `3080` bytes with SHA-256 `4d5e01d343faada3649afb6d96574c3e96abaf8f189664ff787f330e9bc8c7ec`. 0G Storage returned root `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`, transaction `0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6`, and sequence `147016`; proof verification and exact-byte equality both passed.

Those commitments are anchored on 0G Aristotle mainnet in `ProofRailRegistry` at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`:

- deployment tx: `0x7a23a2564784252647505f21b714280d20d5c209785ff4a67c878e3bc684582c`;
- M5 registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`;
- record ID: `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`;
- actual combined mainnet fee: `0.001843856003226748 0G`.

## Product topology after M6

ProofRail separates ordinary product state from verification truth:

```text
Supabase         = mutable job/app memory
proofrail-app    = API/UI and job access
proofrail-worker = controlled secret-bearing worker, standby by default
0G Sandbox       = independent build/execution
0G Storage       = durable canonical evidence
0G Aristotle     = immutable compact commitment anchor
```

The dedicated Supabase database has **no mutable MATCH/MISMATCH field**. A cached verification result is rendered only after the same integrity-checked core projection used by CLI accepts the canonical evidence.

Railway does not hold a Supabase service-role secret. The app calls the authenticated `proofrail-jobs` Supabase Edge Function with a separate high-entropy app token; Supabase keeps privileged database access inside that function.

The permanent `proofrail-worker` preserves the 0G signer as a Railway project-level shared secret. Its health/startup invariant explicitly reports that a signer is configured while public signing is disabled. There is no public signing endpoint.

The old milestone-only M2/M3/M4/M5 Railway services are staged for deletion now that `proofrail-app` + `proofrail-worker` are proven replacements. Railway requires interactive dashboard 2FA to finalize those destructive deletions; historical evidence remains independently preserved in GitHub/0G.

## Agent Skills — next artifact family

Issue #12 extends ProofRail to Agent Skills while keeping two answers independent:

1. **Correspondence:** do distributed skill-package bytes match the deterministic package independently produced from the exact publisher-declared source commit?
2. **Security audit:** what risky instructions, scripts, dependencies, exfiltration paths, destructive operations, hidden payloads, or persistence behaviors exist?

A result may therefore be `MATCH + HIGH-RISK FINDINGS`. A `MATCH` never means safe.

## TEE evidence: precise boundary

The live provider returned real TDX evidence, but its v5 quote uses the legacy provider-signer-padded `report_data`. The caller artifact digest is **not** cryptographically bound into that quote, and the public toolbox build is not proven to execute inside the TEE.

ProofRail therefore displays:

`PROVIDER_EVIDENCE_ONLY`

not `OUTPUT_DIGEST_BOUND` and not "TEE-attested build".

## What ProofRail is not

- a guarantee that matched source is benevolent;
- an LLM deciding MATCH/MISMATCH;
- a system that guesses the official repository;
- a blockchain hash database with no independent rebuild.

## Run the repository checks

Requires Node.js 22+ and pnpm 10.15.0.

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install
pnpm check
pnpm test
```

## Start here

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/03-architecture.md`
4. `docs/11-trust-model.md`
5. `planning/current-sprint.md`
6. `hackathon/m5-live-evidence.json`
7. `hackathon/m5-aristotle-mainnet.json`
8. `hackathon/evidence.md`

## License

Not selected yet. Do not add a license without an explicit ADR.
