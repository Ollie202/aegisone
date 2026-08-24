# ADR-010 — Separate capability discovery, ProofRail evidence, and consumer policy

## Status
Accepted for M8.1.

## Context

M8 turns ProofRail from a verification-only surface into a capability discovery hub for humans and agents. Discovery systems can return Agent Skills, MCP servers, agents, and APIs with useful relevance metadata, but discovery itself does not prove publisher identity, source correspondence, security, or evidence freshness.

The largest product risk is accidental trust escalation: an indexed or highly relevant resource must never become `VERIFIED` merely because a catalog row, upstream registry, or UI badge says so. ProofRail already separates source identity, correspondence, and security findings; M8 must preserve and extend that separation.

## Decision

Introduce a provider-independent `@proofrail/capability-model` package with four supported resource kinds:

- `agent-skill`
- `mcp-server`
- `a2a-agent`
- `api`

The model separates five independent dimensions:

1. **Discovery metadata** — where the resource was found, URL/identifier, discovery freshness, and optional relevance score.
2. **Source assurance** — whether the source mapping is absent, declared, repository-authenticated, or signed.
3. **Source inspection** — whether an exact immutable source snapshot was independently acquired and inspected.
4. **Distribution correspondence** — whether a distinct distributed artifact matches independently reproduced bytes from the claimed source.
5. **Security assessment + canonical evidence** — deterministic findings and ProofRail evidence pointers/freshness, neither of which rewrites correspondence.

Consumer policy is a separate deterministic evaluation step that returns `ALLOW`, `REVIEW`, or `DENY` with machine-readable reasons. Policy evaluation has no LLM dependency and must fail closed or require review when required evidence is missing.

## Required invariants

- `INDEXED` is discovery state, not verification state.
- search relevance is not a trust score and is never consumed by the trust-policy evaluator.
- source-only inspection cannot emit `MATCH` or `MISMATCH`.
- `MATCH`, `MISMATCH`, and `DIVERGED` require a distinct distributed artifact digest and an independently reproduced digest.
- `MATCH` requires equal digests; `MISMATCH` requires different digests.
- security findings never rewrite correspondence.
- Supabase may cache/index these fields later, but mutable database state cannot create canonical proof.
- ARD-specific request/response fields stay in an adapter package; the provider-independent model does not depend on the ARD draft.

## Consequences

ProofRail can safely aggregate broad external discovery sources while making a narrow, strong verification claim only where evidence exists. Agent Skills can receive full ProofRail verification in M8; MCP/A2A/API resources can remain explicitly `INDEXED` or partially inspected until equivalent evidence paths are implemented.

This model also gives agent integrations a stable interface: discovery answers *what might help*, ProofRail evidence answers *what was observed*, and consumer policy answers *whether this consumer will use it*.
