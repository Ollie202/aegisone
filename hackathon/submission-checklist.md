# Submission Checklist

This checklist records **judge-inspectable state**, not aspirations. Technical items are checked only when there is committed/live evidence. Final AKINDO form/media actions remain user-required.

## Product
- [x] End-to-end vertical slice works from a clean independent 0G Sandbox environment.
- [x] Genuine software artifact passes verification (`MATCH`).
- [x] Tampered/substituted publisher artifact fails verification (`MISMATCH`) while reproduced bytes remain unchanged.
- [x] Proof-first web verifier deployed from merged `main` commit `982d76e1531571f451fcdc3379f54ee16f7e4e7c`; Railway deployment `25b2e0e3-de8f-46d6-b0ac-b6900375ce39` passed `/health`.
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
- [x] PR #16 CI green after full-history Gitleaks scan + test suite (final PR CI run #152).
- [x] No secret/history leaks reported by the full-history Gitleaks CI gate.
- [x] Submission-name decision resolved: use `AegisOne` for the buildathon while retaining the documented brand-risk warning.
- [x] Paste-ready AKINDO submission packet prepared in `hackathon/submission-copy.md`.

## Demo
- [x] Recording-ready 90-second script uses real observed proof values.
- [ ] User rehearses the 90-second script once.
- [ ] User records the final screen capture at mobile-readable zoom.
- [x] Recorded path is designed to avoid waiting on a slow live build.
- [x] Deployed proof-first homepage includes evidence links using the official current Galileo and mainnet 0G ChainScan explorer domains.
- [x] MATCH → MISMATCH tamper moment is pinned by web tests and deployed in the exact successful `main` release.

## AKINDO / final user actions

Current Bridge Buildathon page: `https://app.akindo.io/wave-hacks/Z4MlX4vreI72ol6pd`

- [ ] Sign in and confirm the exact current deadline + mandatory fields shown in the authenticated form.
- [ ] Complete all mandatory submission fields using `hackathon/submission-copy.md` as the paste-ready source.
- [ ] Paste the final live app, public repository, evidence, and required project links.
- [ ] Upload/paste the final demo/social media URL and replace the placeholder in the submission packet if desired.
- [ ] Save/submit before the deadline and confirm the AegisOne entry appears on AKINDO.

## Already-proven anchors to use in the form/demo

- Live app: `https://proofrail-app-production.up.railway.app`
- Public repo: `https://github.com/Ollie202/aegisone`
- M5 Aristotle registry: `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`
- M5 mainnet registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`
- M7 Galileo registration tx: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`
- Evidence ledger: `hackathon/evidence.md`
- Recording script: `hackathon/demo-plan.md`
- Paste-ready submission copy: `hackathon/submission-copy.md`
