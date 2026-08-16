# Integrations

**Last reviewed:** 2026-08-16

External APIs evolve. Verify current official docs before implementation.

## 0G Chain

**Purpose:** public, tamper-evident registry of compact release/reproduction commitments.

Wave 3 policy: prove locally/testnet first, then publish real mainnet evidence required by the Buildathon. Do not store large logs onchain.

References:
- https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts
- https://github.com/0gfoundation/awesome-0g

## 0G Storage

**Purpose:** preserve canonical provenance, build logs/evidence, and future SBOM/attestation bundles outside a private ProofRail database.

Wave 3 spike:
1. upload tiny canonical provenance bytes;
2. capture root/transaction evidence;
3. retrieve identical bytes;
4. enable proof verification where supported;
5. record evidence in `hackathon/evidence.md`.

References:
- https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
- https://github.com/0gfoundation/0g-storage-ts-sdk

## 0G Sandbox / Tapp

**Purpose:** run the independent reproduction in confidential/attestable execution and reduce trust in a normal ProofRail-controlled build server.

The current official 0G Sandbox project combines 0G Tapp TEE execution with Daytona workspaces and exposes user/CLI flows suitable for scripted operation. We still must prove the exact consumer path required by ProofRail.

Wave 3 questions:
- Can the sandbox be created/accessed programmatically?
- Can it clone an exact public commit and run a constrained Node build?
- Can built artifact bytes be retrieved?
- What exact Tapp/TDX evidence can we retrieve?
- Can the artifact/provenance digest be bound directly into report data through the accessible path?

If output binding is unavailable, the product must state the weaker guarantee accurately.

References:
- https://github.com/0gfoundation/0g-sandbox
- https://github.com/0gfoundation/0g-tapp
- https://0g.ai/blog/0g-tapp-tee-security-without-ssh
- https://0g.ai/blog/tech-update-nov-2025

## GitHub

**Wave 3 role:** explicit source provider, not automatic truth oracle.

Public repositories can be cloned without an API key. The first version should accept explicit repository/release context and pin an immutable commit.

Later source-claim assurance may use:
- GitHub App/OAuth to prove repository permissions;
- GitHub release/tag metadata;
- GitHub Artifact Attestations as complementary evidence.

GitHub Artifact Attestations already provide signed build provenance tying artifacts to repository/workflow/commit context. ProofRail's differentiation must therefore be independent reproduction and evidence/policy aggregation, not "we invented provenance."

References:
- https://docs.github.com/en/actions/concepts/security/artifact-attestations
- https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations

## 0G Agentic ID / ERC-8004

**Wave 3:** not required.

**Wave 4/5 direction:** independent builder/verifier agents can have portable identities and track records. 0G supports the ERC-8004 Identity and Reputation registries on its network. Treat identity/reputation as a way to reason about builders, not as proof that their build output is correct.

Reference:
- https://0g.ai/blog/0g-supports-erc-8004

## 0G Compute

**Wave 3:** not part of the core truth path.

Potential later use: when independent builders produce different hashes, analyze build logs/dependencies/environments and explain likely causes. The deterministic comparison remains authoritative; an LLM diagnosis is advisory.

## MCP / REST / SDK

No MCP server is required for Wave 3. `proofrail verify --json` already gives agents a machine-readable interface. Add REST/SDK/MCP after the core evidence model is stable.

## 0G DA

Not currently load-bearing. Do not integrate decoratively.
