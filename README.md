# ProofRail *(working name)*

> Independently reproduce software or Agent Skills from publisher-declared source and give humans or AI agents evidence of whether the distributed artifact actually corresponds to that source.

**Status:** M7 Agent Skill verification/auditing live-proven on 0G Galileo  
**Current target:** 0G Bridge Buildathon — Wave 3  
**Working-name warning:** `ProofRail` is not considered brand-safe yet. An unrelated active public project already uses the name in the trust/verification space. See `research/brand-risk.md`.

## The problem

A public source repository does **not** by itself prove that the binary, archive, package, container, or Agent Skill users receive actually corresponds to that source. A compromised release server, CI system, maintainer account, marketplace, or distribution pipeline can serve different bytes while the public source still looks clean.

ProofRail independently reproduces the artifact from an exact source claim and records evidence that can be checked without trusting mutable application state.

## What ProofRail proves

ProofRail separates claims instead of collapsing them into one vague trust score.

### Software correspondence

1. The publisher declares the repository, exact commit, build recipe, and artifact.
2. ProofRail independently rebuilds that exact source.
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

The M5 canonical verification is anchored on 0G Aristotle mainnet in `ProofRailRegistry` at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`. See `hackathon/m5-aristotle-mainnet.json` for the durable receipts.

## Proven Agent Skill path — M7

The live M7 proof used `examples/agent-skills/clean-review` at exact source commit:

`2f193aad92d2f807c2e25f67eb28c5090fa945cf`

Inside 0G Sandbox, ProofRail verified that exact SHA through GitHub's commit API, downloaded the tarball for that exact SHA, extracted it, deterministically packaged the skill directory, and compared the package with the publisher package.

Observed result:

```text
Publisher skill package SHA-256       fb33d144...2b78e878
Independent 0G package SHA-256        fb33d144...2b78e878
                                      ----------------
                                      MATCH
```

A controlled publisher substitution produced SHA-256 `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb`, so ProofRail reported `MISMATCH` while the independently reproduced package stayed unchanged.

The clean fixture's deterministic static audit produced `0` findings. Separate malicious fixtures and tests prove that ProofRail can display `MATCH + CRITICAL_FINDINGS` without calling the skill safe. LLM advisory analysis is explicitly `NOT_RUN` in deterministic evidence.

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

ProofRail separates ordinary product state from verification truth:

```text
Supabase         = mutable job/app memory
proofrail-app    = API/UI and job access
proofrail-worker = controlled secret-bearing worker, standby by default
0G Sandbox       = independent execution/reproduction
0G Storage       = durable canonical evidence
0G registry      = compact immutable commitments
```

Production Railway is intentionally consolidated to only `proofrail-app` and `proofrail-worker`. The old milestone-specific M2/M3/M4/M5 service boxes have been removed after their evidence was preserved.

The dedicated Supabase database has **no mutable MATCH/MISMATCH field**. Cached verification results are rendered only after ProofRail's integrity-checked presentation layer accepts the evidence.

The permanent `proofrail-worker` preserves the 0G signer as a Railway project-level shared secret. Its startup invariant confirms that the signer is configured while public signing is disabled; there is no public signing endpoint.

## TEE evidence: precise boundary

The live provider returned real TDX evidence. For M7 the TDX evidence SHA-256 is `791501f7610de3f7deb827a845e73f76370bf29e926d084ac833919920efffd1`.

However, the live legacy Tapp quote still uses provider-signer-padded report data. The caller artifact digest is **not** cryptographically bound into that quote, and the public toolbox flow does not prove the final artifact was computed inside the TEE.

ProofRail therefore reports provider TDX evidence honestly rather than claiming an output-digest-bound TEE build.

## What ProofRail is not

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

## Start here

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/03-architecture.md`
4. `docs/11-trust-model.md`
5. `planning/current-sprint.md`
6. `hackathon/m5-live-evidence.json`
7. `hackathon/m5-aristotle-mainnet.json`
8. `hackathon/m7-live-evidence.json`
9. `hackathon/evidence.md`

## License

Not selected yet. Do not add a license without an explicit ADR.
