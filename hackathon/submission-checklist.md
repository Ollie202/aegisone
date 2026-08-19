# Submission Checklist

This checklist records **judge-inspectable state**, not aspirations. Technical items are checked only when there is committed/live evidence. Final AKINDO form/media actions remain user-required.

## Product
- [x] End-to-end vertical slice works from a clean independent 0G Sandbox environment.
- [x] Genuine software artifact passes verification (`MATCH`).
- [x] Tampered/substituted publisher artifact fails verification (`MISMATCH`) while reproduced bytes remain unchanged.
- [ ] Proof-first live web verifier deployed and re-checked after PR #16 merge.
- [x] CLI invocation documented in README and covered by repository tests.

## 0G evidence
- [x] 0G Storage roots captured for M5 and M7.
- [x] Storage upload transactions captured.
- [x] Storage retrieval/proof demonstrated with exact-byte equality.
- [x] 0G Aristotle mainnet registry contract deployed for the M5 software slice.
- [x] Mainnet contract address recorded.
- [x] Mainnet deployment transaction recorded.
- [x] Real software-build registration transaction recorded on Aristotle mainnet.
- [x] M7 Agent Skill commitments registered/read back on Galileo; Aristotle state explicitly `PREPARED_NOT_SUBMITTED`.
- [x] Sandbox/Tapp execution evidence recorded with the TDX limitation stated accurately.

## Repository
- [x] Public visibility.
- [x] Judge-oriented README with live/demo/evidence links.
- [x] Architecture/trust-flow documentation.
- [x] Setup and repository-check instructions.
- [ ] Final PR #16 CI green after full-history Gitleaks scan + test suite.
- [ ] No secret/history leaks according to the new full-history Gitleaks CI gate.
- [x] Submission-name decision resolved: use `ProofRail` for the buildathon while retaining the documented brand-risk warning.

## Demo
- [x] Recording-ready 90-second script uses real observed proof values.
- [ ] User rehearses the 90-second script once.
- [ ] User records the final screen capture at mobile-readable zoom.
- [x] Recorded path is designed to avoid waiting on a slow live build.
- [ ] Confirm evidence links are live on the deployed proof-first homepage.
- [ ] Confirm MATCH → MISMATCH tamper moment is clearly readable on the deployed homepage.

## AKINDO / final user actions
- [ ] Re-open the dynamic live AKINDO event page and confirm the exact current deadline/required fields immediately before submission.
- [ ] Complete all mandatory submission fields.
- [ ] Paste the final live app, public repository, evidence, and required project links.
- [ ] Upload/paste the required demo/social media.
- [ ] Save/submit before the deadline and confirm the entry appears on AKINDO.

## Already-proven anchors to use in the form/demo

- Live app: `https://proofrail-app-production.up.railway.app`
- Public repo: `https://github.com/Ollie202/proofrail-0g`
- M5 Aristotle registry: `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`
- M5 mainnet registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`
- M7 Galileo registration tx: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`
- Evidence ledger: `hackathon/evidence.md`
- Recording script: `hackathon/demo-plan.md`
