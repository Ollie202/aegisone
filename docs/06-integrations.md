# Integrations

**Last reviewed:** 2026-08-24

External APIs evolve. M8 pins observed contracts behind adapters and records those pins in `docs/15-m8-api-inventory.md`. Do not silently follow upstream `main` in security-sensitive integration code.

## Integration principles

- Provider-specific schemas live behind adapters.
- Discovery metadata cannot become AegisOne evidence merely because an upstream provider calls it trusted/verified.
- Exact source identity uses immutable commits.
- Public search/read calls must not trigger funded 0G work.
- No runtime LLM API is required for M8.
- Production remains exactly `proofrail-app` + `proofrail-worker`.

## ARD — Agentic Resource Discovery

**M8 role:** common discovery envelope/search contract.

Pinned implementation target:

- `ards-project/ard-spec@1d25abcf07e081f604dba3ae5398b16c79f20b7b`
- observed as v0.9 Draft / Proposal.

M8.2 implements:

```text
GET  /.well-known/ai-catalog.json
POST /search
```

The issue-branch implementation lives in `@aegisone/discovery-ard` and uses a deterministic in-memory catalog only. Its supported profile is deliberately narrow: `query.filter.type`, omitted/`none` federation, 32 KiB request bodies, 2,000-code-point queries, and at most 25 results. The generic API mapping is `application/openapi+json`. Upstream federation remains M8.3.

ARD belongs in `@aegisone/discovery-ard`, not in the provider-independent capability/evidence model.

Important boundary: ARD search score is relevance only. ARD `trustManifest`/metadata may be retained as upstream discovery metadata but cannot create AegisOne `REPOSITORY_AUTHENTICATED`, `MATCH`, audit findings, or canonical evidence.

## GitHub Agent Finder

**M8.3 role:** primary real public federated discovery source.

Pinned connector reference:

`ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07`

Endpoint:

```text
POST https://agentfinder.github.com/api/v1/search
```

The documented public search does not require a paid API key.

AegisOne applies strict timeout/response/result caps, validates the response, preserves source attribution, and never upgrades returned resource metadata into AegisOne trust evidence.

## Hugging Face Discover

**M8.3 role:** secondary/fallback public federated discovery source.

Pinned implementation reference:

`huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa`

REST endpoint:

```text
POST https://huggingface-hf-discover.hf.space/search
```

Hosted MCP endpoint exists upstream, but AegisOne M8.3 uses REST; AegisOne exposes its own MCP surface later in M8.8.

AegisOne does not require or forward user Hugging Face tokens in the MVP.

## Official MCP Registry

**M8.10 role:** read-only discovery/indexing of a second real resource family after the core Agent Skill vertical slice works.

Pinned implementation reference:

`modelcontextprotocol/registry@6036804f1c62633b5e7d2927f411a6f4127f148a`

Production base:

```text
https://registry.modelcontextprotocol.io
```

Stable reads:

```text
GET /v0.1/servers
GET /v0.1/servers/{serverName}/versions
GET /v0.1/servers/{serverName}/versions/{version}
```

Use pagination/incremental fields such as cursor, `updated_since`, search and `version=latest` where appropriate.

A Registry entry is ecosystem metadata. Initial MCP resources remain `INDEXED` unless independent AegisOne evidence actually exists.

## GitHub — source provider and source authentication

GitHub has two distinct M8 roles.

### Exact source acquisition

Existing AegisOne behavior remains:

- resolve repository metadata/stable identity;
- resolve source revision to full immutable commit SHA;
- retrieve exact source archive at that SHA;
- independently reproduce from that exact source.

Recommended GitHub REST header where applicable:

```text
X-GitHub-Api-Version: 2026-03-10
```

Repository existence/source retrieval alone does **not** authenticate the publisher's source mapping.

### GitHub App source authentication

M8.5 adds `REPOSITORY_AUTHENTICATED` through a real GitHub App user authorization flow.

Required observations include:

- authenticated GitHub user identity;
- GitHub App installation/repository access;
- stable GitHub repository ID;
- effective write/push or admin-equivalent authority;
- exact immutable source commit/subdirectory;
- deterministic canonical source claim digest.

Read/triage/unknown authority is insufficient.

The basic public-repository claim flow uses a short-lived GitHub App user access token and does not require long-term token persistence. No GitHub App private key is required unless later server-to-server installation-token behavior is actually introduced.

Detailed design: `docs/14-source-authentication.md`.

## GitHub Artifact Attestations

**M8 role:** optional stronger `SIGNED_RELEASE` source/release evidence.

Candidate listing endpoint:

```text
GET /repos/{owner}/{repo}/attestations/{subject_digest}
```

But listing an attestation is not cryptographic verification.

Preferred worker-side verification if implemented:

```text
gh attestation verify <artifact-path> \
  --repo <owner/repo> \
  --source-digest <expected-source-commit-sha> \
  --format json
```

Add signer/workflow constraints where publisher policy requires them.

Only successful cryptographic verification under the expected artifact/repository/source/signer constraints may produce `SIGNED_RELEASE`.

If the required verified toolchain is unavailable, leave this assurance level unavailable rather than weakening its meaning.

## 0G Chain

**Purpose:** public tamper-evident registry of compact source/artifact/reproduction commitments.

Proven Galileo registry:

`0x227Fcc243f25c395C93Df789EC72Bc75bf096017`

M5 also has a real Aristotle mainnet anchor. M7 Aristotle commitments remain prepared but not submitted.

M8 requires no new mainnet transaction. Search/discovery never writes chain state.

Only explicit authorized verification/evidence work may use the registry writer.

## 0G Storage

**Purpose:** durable canonical evidence outside mutable AegisOne application state.

Existing pinned implementation:

- `@0gfoundation/0g-storage-ts-sdk@1.2.9`
- peer `ethers@6.13.1`
- Galileo chain ID `16602`
- dev RPC `https://evmrpc-testnet.0g.ai`
- Turbo indexer `https://indexer-storage-testnet-turbo.0g.ai`

AegisOne has already live-proven upload, proof-enabled retrieval and exact byte equality.

M8 reuses this path for selected verification jobs; it does not upload every discovery result.

## 0G Sandbox / Tapp

**Purpose:** independent reproduction outside the publisher build path.

M4/M7 proved exact-commit independent execution through the current provider path.

Current TDX evidence limitation remains unchanged:

- provider/runtime TDX evidence exists;
- live legacy Tapp quote does not bind AegisOne's artifact digest;
- therefore AegisOne may claim independent 0G reproduction and provider TDX evidence, but not `TEE-attested artifact build`/artifact-output binding.

M8 reuses the existing Sandbox adapter only for explicitly authorized verification jobs.

## Supabase

**M8 role:** mutable catalog/job/source-claim index.

Use the existing AegisOne Supabase project. Current public tables before M8 catalog migrations are:

- `verification_jobs`
- `proofrail_app_auth`

Both currently have RLS enabled.

M8 adds resource/discovery/version/ingestion/source-claim/evidence-pointer tables according to `docs/16-m8-database-plan.md`.

Supabase never becomes proof authority. Cached strong evidence must remain integrity-checked against canonical AegisOne evidence/pointers.

## Railway

**M8 role:** unchanged two-service production topology.

### `proofrail-app`

Public:

- ARD catalog/search;
- stable resource/evidence reads;
- GitHub source-auth flow;
- deterministic policy endpoint;
- later AegisOne MCP endpoint.

Must not contain the 0G private key.

### `proofrail-worker`

Internal/secret-bearing:

- verification orchestration;
- exact source acquisition where needed;
- 0G Sandbox;
- 0G Storage/registry writes;
- optional cryptographic artifact-attestation verification.

Current worker has health-only public behavior and signer configured. Preserve no-public-signing/no-generic-execution boundary.

No third permanent Railway service is planned.

## MCP / agent interface

M8.8 now makes MCP an active product interface rather than a generic future idea.

Initial AegisOne tools only:

```text
aegisone_search
aegisone_inspect
aegisone_evaluate
```

They wrap the same discovery/read/policy services as REST. MCP remains an integration convenience, not a trust primitive.

No automatic install/execute/sign tool in M8.

## 0G Agentic ID / ERC-8004

Not load-bearing for the M8 backend MVP.

It may later represent independent builder/verifier identities/reputation, but identity/reputation never proves build output correctness. Reproduction evidence remains authoritative for correspondence.

## 0G Compute

Not part of the core truth path.

Potential later use remains advisory divergence diagnosis when independent builders disagree. LLM output cannot turn a mismatch/divergence into a match.

## 0G DA

Not currently load-bearing. Do not integrate decoratively.

## Future source/auth adapters

Post-M8 possibilities:

- npm trusted publishing/provenance;
- Sigstore/cosign;
- domain/DNS or `.well-known` publisher bindings;
- package-registry ownership;
- on-chain publisher authorization.

All must normalize into provider-independent evidence rather than contaminating the capability model with provider-specific fields.
