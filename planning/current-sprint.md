# Current Sprint — M1 + Infrastructure Feasibility

## Primary objective

Prove the core independent-reproduction behavior locally before spending time on product polish or agent integrations.

## M1 tasks

- [ ] Create `hello-proofrail` deterministic fixture.
- [ ] Produce a known fixture artifact representing the publisher's release.
- [ ] Define minimal `ReleaseClaim` / `SourceRef` structures.
- [ ] Pin the fixture build to an immutable source revision concept.
- [ ] Implement SHA-256 helper and known-vector tests.
- [ ] Implement minimal canonical manifest/comparison representation.
- [ ] Independently rebuild the fixture locally.
- [ ] Compare publisher artifact digest with reproduced artifact digest.
- [ ] Genuine artifact returns `MATCH`.
- [ ] One-byte/substitution mutation returns `MISMATCH`.
- [ ] Stable `--json`/machine result shape exists in core tests or CLI scaffold.
- [ ] No 0G or LLM dependency enters `packages/core`.

## Following technical spikes

- [ ] 0G Storage upload/download/proof round trip.
- [ ] Record Storage root/transaction in `hackathon/evidence.md`.
- [ ] Scaffold/test minimal registry locally and dry-run non-mainnet deployment.
- [ ] Prove 0G Sandbox programmatic exact-commit build/retrieval path.
- [ ] Determine exact Tapp/TEE evidence available.
- [ ] Determine whether artifact/provenance digest can be bound to attestation report data.
- [ ] Measure resource/cost characteristics for the supported demo build.
- [ ] Update architecture/threat model based on real findings.

## Explicitly out of scope now

- polished frontend;
- accounts/authentication;
- automatic source discovery;
- private repositories;
- arbitrary huge repositories;
- multi-builder network;
- Agentic ID/ERC-8004 integration;
- MCP server;
- 0G Compute;
- token/rewards/marketplace;
- production branding.
