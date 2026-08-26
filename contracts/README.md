# AegisOne registry contracts

M3 introduces a deliberately small append-only registry for compact reproduction-evidence commitments.

## `AegisOneRegistry.sol`

A record commits to five values:

- `manifestDigest` — SHA-256 digest of the canonical AegisOne provenance manifest;
- `sourceClaimDigest` — SHA-256 digest of the canonical release/source claim;
- `publisherArtifactDigest` — SHA-256 digest of the publisher-distributed bytes;
- `reproducedArtifactDigest` — SHA-256 digest of independently reproduced bytes;
- `provenanceRoot` — the 32-byte 0G Storage root holding the canonical evidence.

`recordId` is computed onchain as `keccak256(abi.encode(...five commitments))`. Exact duplicate records are rejected. Records are immutable and permissionless: the contract records `submitter` and timestamp but does not treat the submitter as an authenticated publisher.

The registry deliberately stores no `PASS`, `safe`, `official`, or malware/security label. Matching or divergent artifact digests remain raw evidence whose meaning is determined by the canonical manifest and verifier policy.

## Toolchain

The validated Wave 3 path uses Hardhat `2.23.0` with Solidity `0.8.24`, optimizer runs `200`, and `evmVersion: "cancun"`. Galileo is chain ID `16602` at `https://evmrpc-testnet.0g.ai`.

The M3 Galileo dry-run compiled, deployed, registered the canonical M2 commitments, and read them back exactly. The testnet registry is `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`; deployment transaction `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`; first registration transaction `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`.

Measured gas was `299829` for deployment and `161123` for registration. The dry-run's read-only Aristotle fee snapshot estimated `0.001843808003226664 0G` combined at that moment; this is not a mainnet quote or spend.

Secrets use `ZEROG_REGISTRY_PRIVATE_KEY` only at deployment/runtime. There is no browser signer path and no private key belongs in Git history.

Commands from repository root:

```bash
pnpm install
pnpm --filter @aegisone/contracts compile
pnpm --filter @aegisone/contracts test
pnpm m3:live
```

Mainnet deployment remains outside M3. Every pre-mainnet gate in `docs/09-deployment-runbook.md` plus explicit approval is required before any Aristotle signing/broadcast path is used.
