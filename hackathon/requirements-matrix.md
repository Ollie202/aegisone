# 0G Bridge Buildathon Requirements Matrix

**Rechecked:** 2026-08-20. Publicly indexed AKINDO guidance still describes the 0G Bridge Buildathon as progress-based rather than fixed-checkpoint judging and asks builders to keep the repo updated and include a short demo. The AKINDO event page is dynamic, so the exact live form/deadline must still be re-read immediately before final submission.

| Requirement / evaluation concern | Current interpretation | AegisOne response | Judge-inspectable evidence | Status |
|---|---|---|---|---|
| Real product progress | Reward meaningful forward movement, not a cosmetic milestone | M1–M7 progressed from local reproduction → real 0G Storage → registry → Sandbox/Tapp → full slice → product runtime → Agent Skill verification/audit | Git history, `PROJECT_STATE.md`, M5/M7 evidence | **PROVEN** |
| 0G ecosystem fit | 0G should be functionally important to the product | 0G Sandbox performs independent reproduction; 0G Storage preserves canonical evidence; 0G Chain anchors compact commitments | live app + `hackathon/evidence.md` | **PROVEN** |
| 0G Chain / mainnet progress | Mainnet integration is a strong progress signal | `ProofRailRegistry` (now `contracts/src/AegisOneRegistry.sol` in source; the already-deployed mainnet contract's on-chain identity is historical and unchanged) deployed on Aristotle mainnet and the M5 software verification registered/read back exactly | `hackathon/m5-aristotle-mainnet.json` | **PROVEN** |
| Technical architecture | Credible, implemented architecture with explicit trust boundaries | provider-independent core + 0G adapters + immutable correspondence + mutable job state kept separate | `docs/03-architecture.md`, `docs/11-trust-model.md`, tests | **PROVEN** |
| Team/execution signal | Public working implementation and sustained shipping matter | public repository, issues/PRs, green CI, live Railway app, durable 0G evidence | GitHub + live app | **PROVEN** |
| Agent / Trust & Safety relevance | Trust/safety is an accepted 0G build category | Agent Skills get independent correspondence plus deterministic security findings; MATCH never means safe | M7 UI/tests/evidence | **PROVEN** |
| Demo/submission media | Short judgeable demo expected | proof-first live page + recording-ready 90-second script | live app + `hackathon/demo-plan.md` | **READY; RECORDING PENDING** |
| Public deliverable | Code must be inspectable | repository is public and evidence ledger is committed | https://github.com/Ollie202/aegisone | **PROVEN** |
| Repository hygiene | Submission should not expose credentials | signer remains in Railway; full-history Gitleaks scan and complete test suite passed in final PR #16 CI | `.github/workflows/ci.yml` + PR #16 CI run #152 | **PROVEN** |

## Submission-day rule

Do not mark the final submission complete because the implementation exists. Before pressing submit:

1. Re-open the live AKINDO event page and confirm the exact deadline/current required fields.
2. Confirm the live Railway URL loads the proof-first homepage.
3. Use the final 90-second recording, not an old architecture-only capture.
4. Include the public repo, live app, demo media, and relevant 0G evidence links.
5. Save/submit before the platform deadline and confirm the submission appears on AKINDO.

## Explicit capability boundaries

- M7 Agent Skill commitments are `PREPARED_NOT_SUBMITTED` for Aristotle; do not claim an M7 mainnet transaction.
- Current TDX evidence is provider/runtime evidence only; artifact-digest challenge binding and artifact-in-TEE computation are not proven.
- Source assurance in the demonstrated flows is publisher-declared unless stronger identity evidence is supplied.
