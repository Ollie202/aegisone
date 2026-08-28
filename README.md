# AegisOne *(submission name / working brand)*

> A trust-aware discovery layer for agent capabilities: independently reproduce software or Agent
> Skills from publisher-declared source, and give humans or AI agents named, separate evidence —
> never a single trust score — about whether what they'd get actually corresponds to that source.

**Status:** M1–M7 live-proven; M8 backend frozen and merged; M9 Hub frontend live as a four-section
product (SKILLS / AUDIT / VERIFIED / FOR AGENTS)  
**Primary live app (Vercel):** https://aegisone-three.vercel.app  
**Parity/fallback (Railway):** https://proofrail-app-production.up.railway.app  
**Public source:** https://github.com/Ollie202/aegisone

`AegisOne` remains the submission name for this build. A separate brand-risk note is retained in `research/brand-risk.md`; the name is not being represented as a cleared production trademark.

## The product today

AegisOne is four sections, each answering a different question:

| Section | Route | What it answers |
| --- | --- | --- |
| **SKILLS** | `/` | What can I get? A real, browsable library of Agent Skills/capabilities, backed by catalog rows, never fabricated demo data. |
| **AUDIT** | `/audit` (alias `/scan`) | Check something you already have, right now. Paste-to-scan is live today; Package/Artifact Verification, Smart Contract Audit, and MCP/Agent Capability Audit are explicitly upcoming, not silently stubbed. |
| **VERIFIED** | `/verified` | What did AegisOne actually prove, and what does that mean? Four independent, never-summed states: `INDEXED`, `AUDITED`, `VERIFIED`, `STORED ON 0G`. The 0G publish path is built and tested end to end against injected transports, but **no funded live publication has run yet** — every resource shows `STORED ON 0G` as not established, and the library's tally reads `0`. |
| **FOR AGENTS** | `/agents` | Machine access to the same evidence: four read/policy-only MCP tools (`aegisone_search`, `aegisone_inspect`, `aegisone_evaluate`, `aegisone_scan`) and the frozen M8.7 REST contract, with verbatim captured payloads and an explicit list of what this surface deliberately cannot do (0G retrieval, publishing, `SIGNED_RELEASE`, per-agent credentials). |

The full decision record for this structure is `docs/decisions/016-four-section-product-ia-and-skill-library.md` through `docs/decisions/019-for-agents-and-final-reconciliation.md`. The rest of this README covers the proven M1–M7 correspondence engine those four sections are built on.

## The problem

A public source repository does **not** by itself prove that the binary, archive, package, container, or Agent Skill users receive actually corresponds to that source. A compromised release server, CI system, maintainer account, marketplace, or distribution pipeline can serve different bytes while the public source still looks clean.

AegisOne independently reproduces the artifact from an exact source claim and records evidence that can be checked without trusting mutable application state.

## What AegisOne proves

AegisOne separates claims instead of collapsing them into one vague trust score.

### Software correspondence

1. The publisher declares the repository, exact commit, build recipe, and artifact.
2. AegisOne independently rebuilds that exact source.
3. Exact artifact digests are compared as `MATCH` / `MISMATCH`.

### Agent Skill correspondence + security

Agent Skills add a second independent dimension:

1. **Correspondence** — do the distributed skill-package bytes match the deterministic package independently produced from the exact publisher-declared source commit?
2. **Security audit** — what risky instructions, scripts, resources, exfiltration paths, destructive operations, encoded execution, or persistence behavior exist?

Therefore a result can legitimately be:

- `MATCH + NO FINDINGS`
- `MATCH + CRITICAL FINDINGS`
- `MISMATCH + NO FINDINGS`
- `MISMATCH + CRITICAL FINDINGS`

A `MATCH` never means “safe.” Audit findings never rewrite the cryptographic correspondence result.

## Proven software path

```text
explicit source claim
  -> publisher artifact bytes
  -> exact immutable Git commit
  -> independent 0G Sandbox rebuild
  -> SHA-256 correspondence
  -> MATCH / MISMATCH
  -> canonical evidence
  -> proof-verified 0G Storage
  -> compact registry commitment
  -> shared CLI/web projection
```

The M5 genuine software artifact reproduced byte-for-byte at SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`; a one-byte substituted publisher artifact produced `MISMATCH` while the reproduced bytes remained unchanged.

The M5 canonical verification is anchored on 0G Aristotle mainnet in `ProofRailRegistry` (now `AegisOneRegistry` in source; the already-deployed mainnet contract's on-chain identity is historical and unchanged) at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`. See `hackathon/m5-aristotle-mainnet.json` for the durable receipts.

## Proven Agent Skill path — M7

The live M7 proof used `examples/agent-skills/clean-review` at exact source commit:

`2f193aad92d2f807c2e25f67eb28c5090fa945cf`

Inside 0G Sandbox, AegisOne verified that exact SHA through GitHub's commit API, downloaded the tarball for that exact SHA, extracted it, deterministically packaged the skill directory, and compared the package with the publisher package.

Observed result:

```text
Publisher skill package SHA-256       fb33d144...2b78e878
Independent 0G package SHA-256        fb33d144...2b78e878
                                      ----------------
                                      MATCH
```

A controlled publisher substitution produced SHA-256 `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb`, so AegisOne reported `MISMATCH` while the independently reproduced package stayed unchanged.

The clean fixture's deterministic static audit produced `0` findings. Separate malicious fixtures and tests prove that AegisOne can display `MATCH + CRITICAL_FINDINGS` without calling the skill safe. LLM advisory analysis is explicitly `NOT_RUN` in deterministic evidence.

### M7 live evidence

- Package SHA-256: `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`
- Canonical evidence: `3470` bytes / SHA-256 `16bbfe2235cdb28cf3f5019c326edc9d619f7a920bee01dc120d7dced4f5837a`
- 0G Storage root: `0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66`
- 0G Storage tx: `0x59a63ddf1d2d985b947e7829ec6a47c19760870ed066558123cf817d19fe063d`
- Storage sequence: `147101`
- Storage proof verified: `true`
- Exact downloaded bytes: `true`
- Galileo registry record: `0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a`
- Galileo registration tx: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`
- Exact registry readback: `true`
- Durable evidence: `hackathon/m7-live-evidence.json`

M7 also prepares the equivalent Aristotle commitments, but their state is deliberately `PREPARED_NOT_SUBMITTED`. **No M7 mainnet transaction has been signed or submitted.**

## Product topology

AegisOne separates ordinary product state from verification truth:

```text
Supabase         = mutable job/app memory
proofrail-app    = API/UI and job access
proofrail-worker = controlled secret-bearing worker, standby by default
0G Sandbox       = independent execution/reproduction
0G Storage       = durable canonical evidence
0G registry      = compact immutable commitments
```

Production Railway is intentionally consolidated to only `proofrail-app` and `proofrail-worker`. The old milestone-specific M2/M3/M4/M5 service boxes have been removed after their evidence was preserved. Vercel hosts the same `apps/web` frontend (via `apps/web/src/vercel-entry.ts`) as the primary production origin at `https://aegisone-three.vercel.app`; Railway's `proofrail-app` remains a parity/fallback deployment of the identical code. Neither Vercel nor `proofrail-app` ever holds the 0G signer — only `proofrail-worker` does.

The dedicated Supabase database has **no mutable MATCH/MISMATCH field**. Cached verification results are rendered only after AegisOne's integrity-checked presentation layer accepts the evidence.

The permanent `proofrail-worker` preserves the 0G signer as a Railway project-level shared secret. Its startup invariant confirms that the signer is configured while public signing is disabled; there is no public signing endpoint.

## TEE evidence: precise boundary

The live provider returned real TDX evidence. For M7 the TDX evidence SHA-256 is `791501f7610de3f7deb827a845e73f76370bf29e926d084ac833919920efffd1`.

However, the live legacy Tapp quote still uses provider-signer-padded report data. The caller artifact digest is **not** cryptographically bound into that quote, and the public toolbox flow does not prove the final artifact was computed inside the TEE.

AegisOne therefore reports provider TDX evidence honestly rather than claiming an output-digest-bound TEE build.

## What AegisOne is not

- a guarantee that matched source is benevolent;
- an LLM deciding MATCH/MISMATCH;
- a system that guesses the official repository;
- a mutable database verdict service;
- a blockchain hash database with no independent reproduction.

## Run the repository checks

Requires Node.js 22+ and pnpm 10.15.0.

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install
pnpm check
pnpm test
```

## CLI quickstart

The CLI emits machine-readable canonical JSON. It currently requires `--json` explicitly.

Verify a publisher artifact against an independently built local source checkout:

```bash
node --experimental-strip-types packages/cli/src/cli.ts verify \
  --claim /path/to/claim.json \
  --recipe /path/to/recipe.json \
  --artifact /path/to/publisher-artifact \
  --source-repository /path/to/source-checkout \
  --json
```

Inspect a canonical software verification file through the same integrity-checked presentation projection used by the web renderer:

```bash
node --experimental-strip-types packages/cli/src/cli.ts inspect \
  --evidence /path/to/verification.json \
  --json
```

`verify` exits `0` for `MATCH`, `1` for `MISMATCH`, and `2` for invalid invocation/input. CLI behavior is covered by `packages/cli/test` in the repository test suite.

## Judge/demo links

- Live app (Vercel, primary): https://aegisone-three.vercel.app
- Live app (Railway, parity/fallback): https://proofrail-app-production.up.railway.app
- Evidence ledger: `hackathon/evidence.md`
- M5 mainnet receipt: `hackathon/m5-aristotle-mainnet.json`
- M7 live Agent Skill receipt: `hackathon/m7-live-evidence.json`
- Recording script: `hackathon/demo-plan.md`
- Submission checklist: `hackathon/submission-checklist.md`

## Start here

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/03-architecture.md`
4. `docs/11-trust-model.md`
5. `planning/current-sprint.md`
6. `docs/decisions/016-four-section-product-ia-and-skill-library.md` through
   `docs/decisions/019-for-agents-and-final-reconciliation.md` (the current product structure)
7. `hackathon/m5-live-evidence.json`
8. `hackathon/m5-aristotle-mainnet.json`
9. `hackathon/m7-live-evidence.json`
10. `hackathon/evidence.md`

## License

Not selected yet. Do not add a license without an explicit ADR.
