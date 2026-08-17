# Evidence Ledger

Record real proof here immediately when created. Do not paste secrets.

## Repository
- Repository: https://github.com/Ollie202/proofrail-0g
- Visibility: PUBLIC
- Foundation completion commit: `f7d1d9a010c8067b7a719fe97d1042c00a611ff4`

## M2 — 0G Storage
- Network: 0G Galileo Testnet
- Chain ID: `16602`
- Provenance root: `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`
- Upload transaction: `0xe2f4801e2dcb6dd45c6cf95ee2f2973aaec926e4e1133600c63ff7b85555e8dd`
- Storage sequence: `147010`
- Canonical payload bytes: `1792`
- SHA-256: `f922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`
- Retrieval proof verified: `true`
- Exact byte equality: `true`
- Railway deployment: `6ff57bc8-6c0d-4304-a19c-659a88334798`
- Status: COMPLETE.

## M3 — Galileo registry dry-run
- Network / chain ID: 0G Galileo Testnet / `16602`
- Registry: `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`
- Deployment transaction: `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`
- Registration transaction: `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`
- Record ID: `0xf57437f137bba4a6104af296a7d470573ad49be112a7ef02f6b10b8e413f26e8`
- Exact contract read-back: `true`
- Gas: deploy `299829`, register `161123`
- Railway deployment: `46fc7126-8d7b-4565-8f89-a284e8b3d898`
- Status: COMPLETE; no mainnet transaction.

## M4 — real 0G Sandbox / Tapp
- Network / chain ID: Galileo / `16602`
- Provider: `0xa19C4E672576E186AF81548E950Bf74A736220C3`
- Provider URL: `https://provider-private-sandbox.0g.ai`
- Exact source commit: `e9c82277cef2f7630977e2473664e14eed2f860d`
- Node: `v22.14.0`
- Retrieved artifact bytes: `53`
- Artifact SHA-256: `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Exact artifact match: `true`
- Provider TDX evidence: `PROVEN`
- Artifact-digest challenge binding: `NOT AVAILABLE`
- Artifact computed inside the TEE: `NOT AVAILABLE`
- Successful sandbox cleanup: `true`
- Status: COMPLETE; provider/runtime TDX evidence only.

## M5 — judgeable Galileo slice
- Railway deployment: `cd9faa4c-4c02-4532-8f13-f4e41da19096`
- M5 implementation commit: `eb96681ff683a25a56741b8ceaab8918cbceecac`
- Source assurance: `DECLARED`
- Source repository: `https://github.com/Ollie202/proofrail-0g.git`
- Exact source commit requested/read back: `e9c82277cef2f7630977e2473664e14eed2f860d`
- Runtime: Node `v22.14.0`
- Provider: `0xa19C4E672576E186AF81548E950Bf74A736220C3`
- Successful sandbox ID: `aa09bb88-1154-4454-bb74-cd8aec00225f`
- Successful sandbox cleanup/deletion: `true`
- Publisher artifact: `53` bytes / SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Independent 0G reproduction: `53` bytes / SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Genuine verdict: `MATCH`
- One-byte substituted publisher SHA-256: `d5318963f53126b4c4bd448bffca222a8e08f068764e379516fc0ad3bd1f8889`
- Substitution verdict: `MISMATCH`; reproduced SHA remained unchanged.
- TDX evidence SHA-256: `7e1f1ae8a6c344b3c0f62853796e260c9a148e5c4cdefd9c25a45c14bc2740fe`
- TDX classification: `PROVIDER_EVIDENCE_ONLY`
- Artifact challenge binding: `false` (`quoteMatchesLegacySignerPadding=true`).
- Manifest SHA-256: `b0ac39ac60df76f427311e3d1fce665b820b81a9c4b39481ce16843804419a54`
- Canonical evidence: `3080` bytes / SHA-256 `4d5e01d343faada3649afb6d96574c3e96abaf8f189664ff787f330e9bc8c7ec`
- 0G Storage root: `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`
- 0G Storage transaction: `0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6`
- Storage sequence: `147016`
- Uploaded/downloaded SHA: `4d5e01d343faada3649afb6d96574c3e96abaf8f189664ff787f330e9bc8c7ec`
- Storage proof verified: `true`
- Storage exact-byte equality: `true`
- Registry commitments prepared from that exact stored verification.
- Aristotle status: `PREPARED_NOT_SUBMITTED`; contract address `null`; transaction hash `null`.
- Mainnet signer/submission code in the M5 live runner: `false`.
- Durable structured summary: `hackathon/m5-live-evidence.json`.
- Status: GALILEO SLICE COMPLETE; Aristotle mainnet gate PENDING.

## 0G Chain — Aristotle mainnet
- Expected network: 0G Aristotle Mainnet
- Expected chain ID: `16661` — verify again from current official 0G sources immediately before any write.
- Contract address: PENDING
- Deployment transaction: PENDING
- M5 registration transaction: PENDING
- Mainnet status: NOT DEPLOYED; read-only pre-mainnet gate and explicit approval required.

## Product
- Judge-facing shared core projection: IMPLEMENTED (`createVerificationView()` used by CLI and web renderer)
- Live verifier URL: PENDING
- Demo video: PENDING

## External validation
- External repository #1: PENDING
- External repository #2: PENDING
- External repository #3: PENDING
