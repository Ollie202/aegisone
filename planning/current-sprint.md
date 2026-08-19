# Current Sprint — M7 Agent Skills

## Primary objective

Make Agent Skills a first-class ProofRail artifact family while keeping **source correspondence** and **security risk** as independent claims.

## M7 — Issue #12 — COMPLETE / MERGED

- [x] Define deterministic canonical Agent Skill packaging over exact sorted relative paths + bytes.
- [x] Validate the current `SKILL.md` structure/frontmatter, including YAML block-scalar metadata.
- [x] Add safe package decoding with traversal, duplicate-path, truncation, and trailing-byte guards.
- [x] Reuse normal ProofRail correspondence semantics: exact package bytes produce `MATCH`; substituted publisher bytes produce `MISMATCH`.
- [x] Keep audit findings separate from correspondence.
- [x] Add deterministic static audit findings with rule ID, severity, path, line, and evidence excerpt.
- [x] Cover credential harvesting, secret exfiltration, destructive commands, download→execute, encoded execution, persistence, and undeclared executable resources.
- [x] Keep LLM analysis explicitly advisory and `NOT_RUN` in deterministic evidence.
- [x] Add clean/malicious fixtures proving combinations such as `MATCH + CRITICAL_FINDINGS` and `MISMATCH + NO_FINDINGS`.
- [x] Add integrity-checked Agent Skill presentation and persisted job rendering.
- [x] Keep Supabase as mutable job memory only; it cannot override either correspondence or audit evidence.
- [x] Add provider-neutral canonical M7 evidence and derive Storage/registry commitments from those exact bytes.
- [x] Add a Galileo-only live runner with no Aristotle mainnet signing path.
- [x] Harden source acquisition: verify the exact GitHub commit through the GitHub API, fetch that exact SHA's tarball inside 0G Sandbox, and verify the resolved SHA before packaging.
- [x] Independently package `examples/agent-skills/clean-review` inside live 0G Sandbox from exact commit `2f193aad92d2f807c2e25f67eb28c5090fa945cf`.
- [x] Prove publisher/reproduced package SHA-256 equality at `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878` → `MATCH`.
- [x] Prove substitution digest `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb` → `MISMATCH` while reproduced bytes remain unchanged.
- [x] Produce canonical evidence: `3470` bytes / SHA-256 `16bbfe2235cdb28cf3f5019c326edc9d619f7a920bee01dc120d7dced4f5837a`.
- [x] Complete proof-verified 0G Storage round trip: root `0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66`, tx `0x59a63ddf1d2d985b947e7829ec6a47c19760870ed066558123cf817d19fe063d`, sequence `147101`, exact bytes `true`.
- [x] Register/read back the exact commitments on the existing Galileo registry: record `0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a`, tx `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`, exact readback `true`.
- [x] Preserve honest TEE semantics: provider TDX evidence proven; artifact-digest challenge binding unavailable; artifact computed in TEE unavailable.
- [x] Delete the successful live Sandbox after evidence creation.
- [x] Derive Aristotle commitments but leave M7 `PREPARED_NOT_SUBMITTED`; no M7 mainnet transaction.
- [x] Restore Railway production to exactly `proofrail-app` + `proofrail-worker`; worker standby, signer configured, public signing disabled.
- [x] Record durable structured proof in `hackathon/m7-live-evidence.json`.
- [x] Final CI on completed PR head passed (run #140).
- [x] PR #14 marked ready and squash-merged as `07da06180cb7e530f9b3b7820fc478ccb235884f`.
- [x] Issue #12 closed as completed.

## Stable production topology

```text
proofrail-app    -> API/UI + Supabase-backed mutable job index
proofrail-worker -> controlled shared-signer boundary; standby, no public signing endpoint
0G Sandbox       -> independent reproduction
0G Storage       -> durable canonical evidence
0G registry      -> compact immutable commitments
```

No M7 Aristotle mainnet transaction was submitted. Any future mainnet registration requires a fresh read-only preflight and separate explicit approval.

No next milestone is defined by this file. Start new work only from an explicitly scoped issue/goal.
