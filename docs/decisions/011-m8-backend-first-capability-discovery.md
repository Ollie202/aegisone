# ADR-011 — Build M8 as a backend-first trust-aware discovery layer

## Status

Accepted for M8.

## Context

AegisOne M1–M7 proved deterministic source-to-artifact correspondence, Agent Skill packaging/auditing, independent 0G reproduction, durable 0G evidence, and compact registry commitments.

M8 expands the product from verification-only workflows into capability discovery for humans and autonomous agents. The main architectural risk is turning AegisOne into a generic marketplace/search UI that weakens the existing trust model, duplicates proof logic in frontend code, or creates new infrastructure cost/complexity before the backend evidence path is stable.

The existing production topology is intentionally small:

- `proofrail-app`
- `proofrail-worker`
- existing AegisOne Supabase project
- 0G Sandbox / Storage / registry adapters

The M8 product needs discovery, catalog persistence, source authentication, stable machine APIs, deterministic policy, and MCP consumption before a new human Hub frontend is useful.

## Decision

Build M8 **backend first** and preserve exactly the current two permanent Railway services.

The backend flow is:

```text
intent
  -> federated capability discovery
  -> provider-independent CapabilityResource
  -> source assurance
  -> AegisOne verification evidence
  -> deterministic consumer trust policy
  -> ALLOW | REVIEW | DENY
```

Responsibilities:

- `proofrail-app` is the public control/read plane: ARD/search, resource/evidence reads, GitHub source-auth web flow, deterministic policy, and MCP transport.
- `proofrail-worker` remains the internal secret-bearing execution plane for controlled verification and 0G operations.
- Supabase is mutable catalog/job/source-claim memory, not proof authority.
- 0G Sandbox remains independent reproduction.
- 0G Storage remains canonical evidence storage.
- the existing registry remains the compact commitment layer.

M8 introduces adapter/package boundaries as needed rather than new network services:

- `@aegisone/discovery-ard`
- discovery-provider adapters
- catalog-store abstraction
- GitHub source-auth adapter
- thin AegisOne MCP adapter

The M9 human Hub frontend begins only after M8.11 freezes the backend API/MCP contract and completes the security/deployment gate.

## Trust consequences

Discovery is never verification.

- `INDEXED` is a mutable discovery state.
- relevance/search score is not a trust score.
- provider metadata/trust manifests cannot populate AegisOne correspondence/source-auth/security evidence without separate validation.
- frontend and MCP consume the same stable backend evidence model rather than implementing alternate trust logic.

## Cost consequences

The M8 MVP requires no runtime OpenAI/Anthropic API, embeddings API, paid vector database, third permanent Railway service, or new mainnet write.

Expensive independent verification is an explicit controlled job, not something triggered for every search result.

## Alternatives considered

### Build the Hub frontend first

Rejected. It would create a polished surface over unstable backend semantics and encourage trust logic to leak into UI state.

### Build a new microservice for discovery/MCP

Rejected for the MVP. Workspace packages inside the current app/worker topology are sufficient and materially cheaper/simpler for a solo builder.

### Crawl/index the entire agentic ecosystem ourselves

Rejected for M8. Existing federated providers/registries can supply broad discovery. AegisOne's differentiation is evidence/trust enrichment, not operating a global crawler/embedding stack.

### Verify every discovered capability immediately

Rejected. Discovery is cheap; independent reproduction is expensive. AegisOne indexes broadly and verifies selected supported versions/jobs.

## Consequences

Positive:

- preserves the proven trust boundary;
- minimizes infrastructure cost and deployment risk;
- creates one stable machine contract for humans, agents and later frontend;
- allows broad discovery without pretending broad verification;
- keeps the system feasible for a solo builder.

Trade-offs:

- frontend polish is deliberately delayed;
- many resources will remain honestly `INDEXED`/unverified;
- the system is not a full marketplace or universal verifier in M8.

## Implementation gates

Issue #18 defines the master sequence. Issues #21–#30 implement the backend one gate at a time. Issue #31 is the M9 frontend and remains blocked until M8.11 declares the backend frontend-ready.
