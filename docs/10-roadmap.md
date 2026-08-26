# Roadmap

## Proven foundation — M1–M7

AegisOne's original buildathon foundation is complete and live-proven:

- explicit source claims and immutable commit pinning;
- deterministic independent reproduction and exact-byte comparison;
- canonical evidence;
- real 0G Sandbox execution;
- proof-verified 0G Storage round trips;
- compact registry commitments;
- real Aristotle mainnet M5 anchor;
- product runtime/Supabase mutable job index;
- Agent Skill deterministic packaging + separate static security audit;
- controlled `MATCH` / `MISMATCH` demonstrations.

This foundation is not being replaced by M8.

## M8 — Verified Capability Discovery Backend — ACTIVE

**Goal:** make AegisOne consumable as trust-aware discovery infrastructure for humans and autonomous agents.

Core thesis:

```text
intent
 -> capability discovery
 -> source assurance
 -> AegisOne evidence
 -> consumer trust policy
 -> ALLOW | REVIEW | DENY
```

### M8.1 — capability/evidence/policy model — COMPLETE

- provider-independent capability types;
- independent discovery/source/correspondence/security/evidence dimensions;
- deterministic consumer policy.

### M8.2 — ARD adapter

- pinned ARD v0.9 adapter;
- `/.well-known/ai-catalog.json`;
- `POST /search`;
- local deterministic search/conformance.

### M8.3 — federated discovery

- GitHub Agent Finder;
- Hugging Face Discover;
- provider isolation, attribution, limits, dedup/cache.

### M8.4 — capability catalog

- extend existing AegisOne Supabase project;
- stable resources/versions/discovery observations;
- mutable catalog cannot create proof.

### M8.5 — source authentication

- GitHub App user authorization;
- stable repo identity + effective repository authority;
- exact immutable source claims;
- `REPOSITORY_AUTHENTICATED`;
- optional `SIGNED_RELEASE` only after cryptographic provenance verification.

### M8.6 — verification enrichment

- connect discovered Agent Skills to existing M7 engine;
- source inspection distinct from distribution correspondence;
- separate distribution required for `MATCH`/`MISMATCH`.

### M8.7 — stable backend JSON

- resource/version/evidence reads;
- deterministic policy API;
- stable error model.

### M8.8 — MCP agent interface

- `aegisone_search`;
- `aegisone_inspect`;
- `aegisone_evaluate`;
- no auto-install/execute/sign.

### M8.9 — controlled substitution vertical slice

- real repository-authenticated source;
- genuine separate distribution -> independent 0G `MATCH`;
- substituted bytes under same claimed identity/source -> `MISMATCH`;
- policy ALLOW genuine / DENY substitution;
- durable 0G evidence.

This is the core backend MVP proof.

### M8.10 — MCP Registry indexing — stretch

- read-only official Registry ingestion;
- real MCP resources in discovery;
- remains `INDEXED` until independent AegisOne evidence exists.

### M8.11 — backend freeze

- security regression pass;
- Supabase/Railway deployment verification;
- complete CI/Gitleaks;
- frozen REST/ARD/MCP contract for frontend.

## M9 — Human-facing AegisOne Hub

**Start condition:** M8.11 explicitly declares backend frontend-ready.

**Goal:** turn the proven backend into a judgeable/usable human product without moving trust decisions into browser code.

Planned surfaces:

- intent/capability search;
- evidence-rich search cards;
- resource Evidence Passport;
- publisher GitHub source-claim UX;
- deterministic trust-policy playground;
- verification/version history;
- 90–120 second genuine-vs-substitution judge demo.

Frontend should evolve inside the existing `proofrail-app` deployment unless a different architecture is explicitly approved by ADR.

## Post-M9 / product expansion

Only after the core Hub has real usage/evidence:

### More artifact/resource families

- reproducible MCP server packages/containers where source-to-distribution evidence is actually available;
- npm packages;
- Python/package-registry releases;
- OCI/container images;
- additional Agent Skill ecosystems.

### More source-auth/provenance adapters

- npm provenance/trusted publishing;
- Sigstore/cosign;
- domain/DNS / `.well-known` publisher bindings;
- package-registry ownership;
- on-chain publisher authorization.

### Multiple independent builders

- genuinely independent second/third builder adapters;
- N-of-M correspondence policies;
- builder capability/diversity metadata;
- stronger TEE artifact-output binding only if cryptographically proven.

### Agent/network integration

- GitHub Action / CI admission hooks;
- TypeScript SDK;
- policy templates for autonomous agents;
- builder/verifier identity/reputation where it adds accountability;
- ERC-8004/0G Agentic ID only when useful rather than decorative.

### Enterprise/security expansion

- private-source workflows with controlled secret isolation;
- SBOM/SLSA/in-toto interoperability;
- enterprise admission policies;
- organization policy management;
- audit/history exports.

### Economics

Only after real verification demand:

- sustainable builder economics;
- paid verification tiers;
- publisher automation;
- network incentives.

Do not build marketplace payments/social features merely to make the hackathon surface larger.

## Long-term moat hypothesis

The moat is not hashing, a green security badge, or a generic Skill directory.

The durable opportunity is:

> **broad agentic capability discovery + independently checkable source/distribution evidence + consumer-owned policy + interoperable proof history.**

AegisOne should become the layer an agent asks before it grants a newly discovered capability access to its environment.
