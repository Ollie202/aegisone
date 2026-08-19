# Current Sprint — Submission Closure

## Primary objective

Close the 0G Bridge Buildathon submission cleanly without inventing a new product milestone, weakening ProofRail's trust model, or adding cosmetic blockchain transactions.

## Technical build — COMPLETE

- [x] M1–M7 implemented, live-proven, and merged.
- [x] Real software `MATCH` and controlled `MISMATCH` evidence proven.
- [x] Agent Skill deterministic packaging, correspondence, and separate security audit proven.
- [x] Real 0G Sandbox reproduction proven.
- [x] Proof-verified 0G Storage exact-byte evidence proven.
- [x] M5 software verification anchored/read back on Aristotle mainnet.
- [x] M7 Agent Skill commitments registered/read back on Galileo.
- [x] M7 Aristotle state remains honestly `PREPARED_NOT_SUBMITTED`.
- [x] Production consolidated to exactly `proofrail-app` + `proofrail-worker`.
- [x] Worker remains standby with signer configured and public signing disabled.

## Submission-readiness — COMPLETE

- [x] Issue #15 / PR #16 completed and merged.
- [x] Proof-first judge-facing homepage deployed successfully from `main`.
- [x] Real proof/evidence values are visible and pinned by tests.
- [x] Agent Skill provenance and security are visibly separate.
- [x] Official 0G evidence links are included on the live page.
- [x] 90-second demo path is recorded in `hackathon/demo-plan.md`.
- [x] Submission requirements matrix reconciled against actual evidence.
- [x] Submission checklist reconciled against actual evidence.
- [x] Full-history Gitleaks + complete test suite passed in final PR #16 CI.
- [x] Paste-ready project/progress/0G/media copy exists in `hackathon/submission-copy.md`.
- [x] Current Bridge Buildathon page recorded as `https://app.akindo.io/wave-hacks/Z4MlX4vreI72ol6pd`.

## Remaining user-authenticated actions

- [ ] Rehearse the 90-second script once.
- [ ] Record the final screen capture at readable/mobile-friendly zoom.
- [ ] Sign in to AKINDO and confirm the exact current deadline + mandatory form fields.
- [ ] Fill the form using `hackathon/submission-copy.md`.
- [ ] Add the final demo/social URL.
- [ ] Submit and confirm ProofRail appears as submitted on AKINDO.

## Stable production topology

```text
proofrail-app    -> proof-first API/UI + Supabase-backed mutable job index
proofrail-worker -> controlled shared-signer boundary; standby, no public signing endpoint
0G Sandbox       -> independent reproduction
0G Storage       -> durable canonical evidence
0G registry      -> compact immutable commitments
```

## Safety / scope boundary

- No new 0G transaction is required for submission closure.
- No M7 Aristotle mainnet write is authorized or needed.
- Any future mainnet write requires a fresh read-only preflight and separate explicit approval.
- No M8 is defined.
- Do not reopen engineering work merely because the final recording/form submission requires the user's authenticated browser session.
