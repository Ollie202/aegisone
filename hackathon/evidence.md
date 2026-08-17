# Evidence Ledger

Record real proof here immediately when created. Do not paste secrets.

## Repository
- Repository: https://github.com/Ollie202/proofrail-0g
- Visibility: PUBLIC
- Foundation completion commit: `f7d1d9a010c8067b7a719fe97d1042c00a611ff4`

## 0G Storage
- Network: 0G Galileo Testnet
- Chain ID: `16602`
- Provenance root: `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`
- Upload transaction: `0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd`
- Transaction explorer: https://chainscan-galileo.0g.ai/tx/0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd
- Storage sequence: `147010`
- StorageScan: https://scan-devnet.0g.ai/submission/147010
- Canonical payload byte length: `1792`
- Uploaded SHA-256: `f922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`
- Downloaded SHA-256: `f922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`
- Exact byte equality: `true`
- Retrieval proof requested: `true`
- Retrieval proof verified: `true`
- RPC: https://evmrpc-testnet.0g.ai
- Indexer: https://indexer-storage-testnet-turbo.0g.ai
- Railway deployment: `6ff57bc8-6c0d-4304-a19c-659a88334798`
- Source commit used by the live runner: `d1b340fb2b7636e5b10b5c0720b1c59a07a7e89e`
- Live run timestamp: `2026-08-17T14:36:16Z`
- Independent network/config reference: https://build.0g.ai/chain
- Status: M2 live Storage evidence round trip COMPLETE; no wallet secret was written to repository evidence.

## 0G Chain — Galileo registry dry-run
- Network: 0G Galileo Testnet
- Chain ID: `16602`
- Registry contract: `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`
- Contract explorer: https://chainscan-galileo.0g.ai/address/0x227Fcc243f25c395C93Df789EC72Bc75bf096017
- Deployment transaction: `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`
- Deployment transaction explorer: https://chainscan-galileo.0g.ai/tx/0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1
- First registration transaction: `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`
- Registration transaction explorer: https://chainscan-galileo.0g.ai/tx/0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8
- Record ID: `0xf57437f137bba4a6104af296a7d470573ad49be112a7ef02f6b10b8e413f26e8`
- Manifest digest: `0xf922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`
- Source-claim digest: `0x7ceb96364d787db4e136b21b60b83266caf124380a1d00fe3cfb8e2c037ae63c`
- Publisher artifact digest: `0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Reproduced artifact digest: `0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Provenance root: `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`
- Exact contract read-back equality: `true`
- Deployment gas used: `299829`
- Registration gas used: `161123`
- Read-only Aristotle mainnet gas-price snapshot: `4000000007` wei
- Estimated mainnet deployment cost at that snapshot: `1199316002098803` wei
- Estimated mainnet registration cost at that snapshot: `644492001127861` wei
- Estimated combined mainnet cost at that snapshot: `1843808003226664` wei / `0.001843808003226664 0G`
- Toolchain: Solidity `0.8.24`, EVM target `cancun`, Hardhat `2.23.0`
- Signer address: `0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb`
- Railway deployment: `46fc7126-8d7b-4565-8f89-a284e8b3d898`
- Source branch head used by Railway: `28028f70165fb3c674224c4a508c687bce9e1a07`
- Live result timestamp: `2026-08-17T15:10:15Z`
- Status: M3 Galileo deploy → register → read-back COMPLETE. Mainnet was queried read-only for fee estimation; no mainnet transaction or deployment was sent.

## 0G Chain — Aristotle mainnet
- Network: Aristotle mainnet
- Chain ID: `16661` (verify again immediately before any deployment)
- Contract address: PENDING
- Deployment transaction: PENDING
- First build registration transaction: PENDING
- Mainnet status: NOT DEPLOYED; pre-mainnet gate and explicit approval still required.

## 0G Sandbox / Tapp
- Sandbox/provider ID: PENDING
- Build ID: PENDING
- Attestation/evidence reference: PENDING
- Artifact-output binding status: UNKNOWN — must be proven in M4

## Product
- Live verifier URL: PENDING
- CLI release/version: PENDING
- Passing tests: M1 + M2 offline suite reported 18/18 before the M2 live run. M3 contract/client CI compiled and passed before the Galileo dry-run; the live M3 runner then compiled Solidity for Cancun, deployed the registry, registered the canonical M2 commitments, and read them back exactly on 2026-08-17.
- Demo video: PENDING

## External validation
- External repository #1: PENDING
- External repository #2: PENDING
- External repository #3: PENDING
