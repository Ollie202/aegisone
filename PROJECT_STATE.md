# Project State

**Last updated:** 2026-08-20  
**Phase:** Technical submission package complete; demo recording + authenticated AKINDO submission pending  
**Product name:** ProofRail *(submission name / working brand)*

## Current product thesis

ProofRail independently reproduces an artifact from an explicit publisher source claim, compares exact bytes, and records canonical evidence without allowing mutable application state to invent a verdict.

The core trust boundary remains:

> **publisher artifact vs independent reproduction — verified from canonical evidence, not from mutable application state**

For Agent Skills, ProofRail deliberately exposes two independent answers:

1. **Correspondence:** do the distributed skill-package bytes match the deterministic package independently produced from the exact declared source commit? → `MATCH` / `MISMATCH`.
2. **Security audit:** what risky instructions, scripts, resources, exfiltration paths, destructive operations, hidden execution, or persistence behaviors are present? → separate findings + severity.

A `MATCH` never means “safe,” and an audit finding never rewrites the cryptographic correspondence result.

## Proven foundation

- M1–M7 are complete and merged.
- Agent Skill verification/auditing is live-proven on 0G Galileo with durable evidence in `hackathon/m7-live-evidence.json`.
- Real 0G Sandbox independent execution, proof-verified 0G Storage, Galileo registry readback, and the M5 Aristotle mainnet anchor are proven.
- M4/M7 TDX evidence remains honestly classified as provider/runtime evidence only: the live legacy Tapp quote does not bind the artifact digest and does not prove the final artifact was computed inside the TEE.

## Stable production topology

```text
Supabase         = mutable app/job memory
proofrail-app    = proof-first API/UI and job access
proofrail-worker = controlled secret-bearing worker, standby by default
0G Sandbox       = independent execution/reproduction
0G Storage       = durable canonical evidence
0G registry      = compact immutable commitments
```

Railway cleanup is complete. Production intentionally contains only `proofrail-app` and `proofrail-worker`, and both permanent services track `main`. The proof-first app deployment `25b2e0e3-de8f-46d6-b0ac-b6900375ce39` is successful. The worker deployment `106a08b2-a8ff-4074-8c2e-b40d35a5c2da` is successful; its startup boundary remains signer configured, public signing disabled.

Supabase is **not** a proof authority. It stores product/job state and evidence pointers, not a mutable verdict. Cached verification data must pass ProofRail's integrity-checked presentation layer before MATCH/MISMATCH or skill-audit results are shown.

## M7 — Agent Skills proven

Live evidence is recorded in `hackathon/m7-live-evidence.json`.

### Exact source + independent package

- Source repository: `https://github.com/Ollie202/proofrail-0g.git`
- Exact source commit: `2f193aad92d2f807c2e25f67eb28c5090fa945cf`
- Skill directory: `examples/agent-skills/clean-review`
- Source acquisition: GitHub API exact-SHA lookup + tarball for that exact SHA inside 0G Sandbox.
- Publisher package: `973` bytes, 2 files, SHA-256 `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`.
- Independent 0G package: same SHA-256.
- Genuine correspondence: `MATCH`.
- Substitution probe: `MISMATCH` with publisher digest `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb` while reproduced bytes stayed unchanged.
- Deterministic clean-fixture audit: `0` findings, highest severity `INFO`.
- LLM advisory analysis: `NOT_RUN`.

### 0G evidence

- Successful Sandbox: `d3d81adc-d7ba-4557-93e3-ae02fd1bf4ff`; cleanup/deletion confirmed.
- Provider: `0xa19C4E672576E186AF81548E950Bf74A736220C3`.
- TDX evidence SHA-256: `791501f7610de3f7deb827a845e73f76370bf29e926d084ac833919920efffd1`.
- Canonical evidence: `3470` bytes, SHA-256 `16bbfe2235cdb28cf3f5019c326edc9d619f7a920bee01dc120d7dced4f5837a`.
- 0G Storage root: `0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66`.
- Storage transaction: `0x59a63ddf1d2d985b947e7829ec6a47c19760870ed066558123cf817d19fe063d`.
- Storage sequence: `147101`.
- Storage proof verification: `true`; exact byte equality: `true`.
- Galileo registry record: `0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a`.
- Galileo registration transaction: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`.
- Exact registry readback: `true`.

## Submission-readiness pass — complete

Issue #15 / PR #16 turned the proven system into a judge-facing submission surface without adding new trust claims or unnecessary backend scope.

Completed:

- proof-first homepage with real M5/M7 evidence and explicit `MATCH` / `MISMATCH` demonstration;
- Agent Skill correspondence visibly separate from deterministic security findings;
- direct evidence links for 0G Storage, Galileo registry, and the M5 Aristotle mainnet anchor;
- mobile-first layout suitable for a short screen recording;
- tests pinning proof values and honesty labels;
- final PR #16 CI with complete tests + full-history Gitleaks scan;
- public app deployed successfully from merged `main`;
- `hackathon/demo-plan.md` finalized as a 90-second recording script;
- `hackathon/submission-checklist.md` reconciled against real completion state;
- `hackathon/requirements-matrix.md` reconciled against the current build;
- `hackathon/submission-copy.md` prepared as paste-ready AKINDO/project/media copy.

## Mainnet safety state

M7 derives Aristotle registry commitments but leaves them `PREPARED_NOT_SUBMITTED`.

No M7 Aristotle mainnet transaction has been signed or submitted. The existing M5 mainnet registry remains at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`. No new blockchain transaction is required for submission closure. Any future mainnet write requires a separate fresh read-only preflight and explicit approval.

## Repository completion

- PR #14 / Issue #12: M7 complete and merged.
- PR #16 / Issue #15: submission-readiness pass complete and merged.
- Production Railway topology: exactly `proofrail-app` + `proofrail-worker`.
- Technical submission packet: complete.

## Current blockers / next actions

There is **no M8 defined** and no open engineering issue.

The remaining work is intentionally user-authenticated / media work:

1. Rehearse and record the final 90-second demo using `hackathon/demo-plan.md`.
2. Sign in to the current 0G Bridge Buildathon page and confirm the exact live deadline + required fields shown by AKINDO.
3. Fill the form from `hackathon/submission-copy.md`, add the final demo/social URL, submit, and confirm the ProofRail entry appears on AKINDO.

Do not start another product milestone merely because these platform actions remain.
