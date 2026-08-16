# Milestones

## M0 — Foundation ✅
Repository structure, product scope, architecture, risks, and agent rules are documented.

## M1 — Local independent-reproduction kernel
**Outcome:** a controlled publisher artifact is compared against an independently rebuilt artifact from the same declared source/recipe.

Acceptance:
- explicit release/source claim model;
- SHA-256 tested;
- canonical comparison evidence generated;
- genuine publisher artifact MATCHES rebuild;
- one-byte/substituted artifact MISMATCHES;
- stable machine-readable result;
- core is provider/LLM independent.

## M2 — 0G Storage round trip
**Outcome:** real canonical evidence survives upload/retrieval with verifiable references.

Acceptance:
- upload succeeds on appropriate test environment;
- root/transaction captured;
- identical bytes retrieved;
- proof verification enabled where supported.

## M3 — Registry contract
**Outcome:** minimal release/reproduction commitment registry is tested and deployment path proven before mainnet spend.

Acceptance:
- contract tests pass;
- register/read events work;
- interface remains minimal;
- deployment cost measured.

## M4 — 0G independent build runner spike
**Outcome:** real fixture is independently rebuilt through the available 0G Sandbox/Tapp path.

Acceptance:
- sandbox usable programmatically;
- exact source revision and build recipe run;
- artifact bytes retrieved;
- available attestation evidence documented;
- output-binding capability classified truthfully.

## M5 — Judgeable vertical slice
**Outcome:** `declared release -> publisher artifact -> independent 0G rebuild -> compare -> Storage -> mainnet -> verify` works end-to-end.

This is the minimum credible Wave 3 technical submission.

## M6 — CLI/agent-facing productization
- clean `verify`, `inspect`, and internal reproduction UX;
- stable JSON schema;
- useful fail-closed error states.

## M7 — Web evidence viewer
- live public URL;
- source-assurance + build-correspondence dimensions clearly separated;
- evidence links visible.

## M8 — Hardening
- security-critical tests;
- resource-limit/failure injection;
- secrets review;
- docs/README polish.

## M9 — External proof
- multiple real release records;
- ideally 3–5 external/public projects or maintainers;
- mainnet evidence collected.

## M10 — Submission
- 90-second demo;
- public repository;
- live app;
- all required evidence/links;
- final regression and requirement check.

## Wave 4/5 continuation
After Wave 3, add genuinely independent builders, policy consensus, authenticated publisher sources, builder/verifier agents, then Agentic ID/ERC-8004/REST/SDK/MCP only where they strengthen the network.
