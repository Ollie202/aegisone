# Applications

- `web/` — judge-facing AegisOne evidence viewer. It reads canonical `VerificationJson` and renders status through the same `createVerificationView()` core projection used by CLI inspection. It does not calculate or override MATCH/MISMATCH itself.
