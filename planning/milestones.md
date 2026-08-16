# Milestones

## M0 — Foundation
**Outcome:** repository structure, product scope, architecture, risks, and agent rules are documented.

Acceptance:
- core docs exist;
- Wave 3 scope is frozen;
- current sprint identifies technical unknowns.

## M1 — Local verification kernel
**Outcome:** controlled fixture can be built locally and verified by artifact digest.

Acceptance:
- SHA-256 implementation tested;
- canonical manifest generated;
- genuine artifact passes;
- one-byte mutation fails.

## M2 — 0G Storage round trip
**Outcome:** real provenance bytes survive upload/retrieval with evidence.

Acceptance:
- testnet upload succeeds;
- root and transaction captured;
- download returns identical bytes;
- proof verification enabled/succeeds where supported.

## M3 — Registry contract
**Outcome:** minimal registry is tested and deployed through a dry-run network path.

Acceptance:
- contract tests pass;
- register/read events work;
- interface is minimal;
- deployment cost measured.

## M4 — 0G build runner spike
**Outcome:** a real fixture build runs through the available 0G Sandbox/Tapp path.

Acceptance:
- sandbox can be created/accessed programmatically;
- repo/commit is built;
- artifact bytes can be retrieved;
- exact available attestation evidence is documented.

## M5 — Full vertical slice
**Outcome:** source -> build -> artifact -> provenance -> Storage -> registry -> verify works end-to-end.

This is the minimum point at which the project is a credible technical submission.

## M6 — CLI productization
- clean `verify`/`inspect` UX;
- JSON output;
- useful failure messages.

## M7 — Web verifier
- live public URL;
- evidence visualization;
- no hidden trust claims.

## M8 — Hardening
- complete security-critical tests;
- failure injection;
- docs/README polish;
- secrets/deployment review.

## M9 — External proof
- multiple real verification records;
- ideally 3-5 external/public repositories or maintainers testing the flow;
- mainnet evidence collected.

## M10 — Submission
- 90-second demo;
- official requirement check;
- public repository;
- live app;
- evidence links;
- final smoke test.
