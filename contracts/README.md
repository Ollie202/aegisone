# ProofRail registry contracts

M3 introduces a deliberately small append-only registry for compact reproduction-evidence commitments.

## `ProofRailRegistry.sol`

A record commits to five values:

- `manifestDigest` — SHA-256 digest of the canonical ProofRail provenance manifest;
- `sourceClaimDigest` — SHA-256 digest of the canonical release/source claim;
- `publisherArtifactDigest` — SHA-256 digest of the publisher-distributed bytes;
- `reproducedArtifactDigest` — SHA-256 digest of independently reproduced bytes;
- `provenanceRoot` — the 32-byte 0G Storage root holding the canonical evidence.

`recordId` is computed onchain as `keccak256(abi.encode(...five commitments))`. Exact duplicate records are rejected. Records are immutable and permissionless: the contract records `submitter` and timestamp but does not treat the submitter as an authenticated publisher.

The registry deliberately stores no `PASS`, `safe`, `official`, or malware/security label. Matching or divergent artifact digests remain raw evidence whose meaning is determined by the canonical manifest and verifier policy.

## Toolchain

The M3 spike uses Hardhat with Solidity `0.8.24`, optimizer runs `200`, and `evmVersion: "cancun"`. Galileo is configured at chain ID `16602` and `https://evmrpc-testnet.0g.ai`. The compiler choice is intentionally validated by the Galileo dry-run before the Wave 3 interface/toolchain is frozen.

Secrets use `ZEROG_REGISTRY_PRIVATE_KEY` only at deployment/runtime. There is no browser signer path and no private key belongs in Git history.

Commands from repository root:

```bash
pnpm install
pnpm --filter @proofrail/contracts compile
pnpm --filter @proofrail/contracts test
```

Mainnet deployment is outside the M3 implementation step until every pre-mainnet gate in `docs/09-deployment-runbook.md` has passed.
