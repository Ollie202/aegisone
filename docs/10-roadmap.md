# Roadmap

## v0.1 — Wave 3: Independent Release Reproduction

**Goal:** prove one extremely clear trust boundary with real 0G evidence.

Capabilities:
- explicit publisher/release source claim;
- exact commit pinning;
- constrained reproducible Node build;
- publisher artifact hashing;
- one independent 0G rebuild;
- deterministic publisher-vs-rebuild comparison;
- canonical provenance/comparison evidence;
- 0G Storage;
- 0G mainnet commitment;
- CLI + stable JSON + public evidence page;
- tampered/substituted artifact failure demo.

Wave 3 does **not** need to authenticate every publisher or support arbitrary repositories. It must label source assurance accurately.

## v0.2 — Wave 4: Multiple Independent Verifiers

**Goal:** remove trust from a single reproducer and make agent participation real.

Candidate capabilities:
- second/third genuinely independent builder adapter;
- N-of-M verification policies;
- reproduction comparison across builders;
- GitHub App/OAuth publisher ownership proof;
- first ProofRail builder/verifier agent;
- Agentic ID / ERC-8004-compatible identity/reputation where technically appropriate;
- stronger TEE artifact-output binding if not completed in Wave 3;
- GitHub Action/CI integration;
- real external repositories.

## v0.3 — Wave 5: Open Software Verification Network

**Goal:** make independent verification consumable as infrastructure by humans, CI, and autonomous agents.

Candidate capabilities:
- open/permissioned builder enrollment;
- builder capabilities and diversity metadata;
- policy-driven verification such as `2-of-3`, `require-TEE`, `minimum source assurance`;
- public project/release verification history;
- REST/SDK/MCP interfaces over the same deterministic core;
- agent-to-agent verification jobs;
- reputation/validation records only where they add real Sybil/accountability value;
- optional 0G Compute divergence doctor.

## Post-Buildathon

- broader package/container ecosystems;
- Sigstore/SLSA/in-toto/SBOM interoperability;
- enterprise CI admission policies;
- package-manager/registry integrations;
- private-source workflows with controlled access;
- sustainable builder economics;
- provider-neutral attestation adapters;
- real adoption/network effects.

## Long-term moat hypothesis

Not novel hashing or TEE cryptography. The durable opportunity is **easy integration + independent builder network + policy/evidence interoperability + adoption**.
