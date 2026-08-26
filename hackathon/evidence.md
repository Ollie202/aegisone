# Evidence Ledger

Record real proof here immediately when created. Do not paste secrets.

## Repository
- Repository: https://github.com/Ollie202/aegisone
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
- Status: COMPLETE.

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
- Source repository: `https://github.com/Ollie202/aegisone.git`
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
- Registry commitments derive from those exact stored verification bytes.
- Mainnet signer/submission code in the M5 Galileo live runner: `false`.
- Durable structured summary: `hackathon/m5-live-evidence.json`.
- Status: GALILEO SLICE COMPLETE.

## M5 — Aristotle approval gate (historical preflight)
- Network / chain ID: 0G Mainnet / Aristotle / `16661`.
- Public wallet: `0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb`.
- Final approved sequence: nonce `0` registry deployment + nonce `1` M5 registration.
- Approved 20% safety limits: deploy `368309`, register `193348`; total `561657` gas.
- Approved maximum combined fee: `0.002246628007863198 0G`.
- Predicted registry address at nonce `0`: `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`.
- Prepared M5 record ID: `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`.
- Registration calldata hash: `0x9312e036d22d405998b17325cba4039c6bbddf0259189fe998e12838927b15be`.
- Durable structured preflight: `hackathon/m5-aristotle-preflight.json`.

## M5 — Aristotle mainnet anchor
- Network / chain ID: 0G Mainnet / Aristotle / `16661`.
- Registry: `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`.
- Contract code present: `true`.
- Deployment transaction: `0x7a23a2564784252647505f21b714280d20d5c209785ff4a67c878e3bc684582c`.
- Deployment block: `41916904`.
- Deployment gas used: `299829`.
- Deployment fee: `0.001199316002098803 0G`.
- M5 record ID: `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`.
- Registration transaction: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`.
- Registration block: `41916913`.
- Registration gas used: `161135`.
- Registration fee: `0.000644540001127945 0G`.
- Submitter: `0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb`.
- Exact contract read-back: `true`.
- Publisher/reproduced artifact commitments remain identical at `0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`.
- Provenance root: `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`.
- Actual combined fee: `0.001843856003226748 0G`.
- Approved maximum combined fee: `0.002246628007863198 0G`.
- Within approved cap: `true`.
- Ending wallet nonce: `2`.
- Independent secret-free GitHub Actions verification: run `32068243865`, job `95506685727`, verified at block `41917073`.
- Durable structured final evidence: `hackathon/m5-aristotle-mainnet.json`.
- Status: VERIFIED / COMPLETE.

## M7 — Agent Skill verification + audit
- Railway live deployment: `6cec0482-813a-45d9-a831-0cea9dc3090e`.
- Network / chain ID: 0G Galileo Testnet / `16602`.
- Source repository: `https://github.com/Ollie202/aegisone.git`.
- Exact source commit requested and independently resolved: `2f193aad92d2f807c2e25f67eb28c5090fa945cf`.
- Source acquisition inside 0G Sandbox: exact-SHA GitHub commit API verification + tarball for that exact SHA (`GITHUB_API_EXACT_SHA_TARBALL`).
- Skill directory: `examples/agent-skills/clean-review`.
- Package format: `proofrail-agent-skill-package-v1`.
- Publisher package: `973` bytes / 2 files / SHA-256 `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`.
- Independent 0G package: SHA-256 `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`.
- Genuine correspondence: `MATCH`.
- Substitution publisher SHA-256: `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb`.
- Substitution correspondence: `MISMATCH`; reproduced package remained unchanged.
- Deterministic static audit: `0` findings on the clean fixture; highest severity `INFO`.
- LLM advisory: `NOT_RUN`.
- Successful Sandbox ID: `d3d81adc-d7ba-4557-93e3-ae02fd1bf4ff`.
- Successful sandbox cleanup/deletion: `true`.
- Provider: `0xa19C4E672576E186AF81548E950Bf74A736220C3`.
- TDX evidence SHA-256: `791501f7610de3f7deb827a845e73f76370bf29e926d084ac833919920efffd1`.
- Provider TDX evidence: `PROVEN`.
- Artifact-digest challenge binding: `NOT AVAILABLE ON LIVE LEGACY TAPP`.
- Artifact computed inside TEE: `NOT AVAILABLE`.
- Canonical evidence: `3470` bytes / SHA-256 `16bbfe2235cdb28cf3f5019c326edc9d619f7a920bee01dc120d7dced4f5837a`.
- 0G Storage root: `0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66`.
- 0G Storage transaction: `0x59a63ddf1d2d985b947e7829ec6a47c19760870ed066558123cf817d19fe063d`.
- Storage sequence: `147101`.
- Storage proof verified: `true`.
- Storage exact-byte equality: `true`.
- Galileo registry: `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`.
- Galileo record ID: `0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a`.
- Galileo registration transaction: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`.
- Galileo block / gas: `50237703` / `161135`.
- Exact Galileo readback: `true`.
- Prepared Aristotle target: existing registry `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`, record `0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a`, status `PREPARED_NOT_SUBMITTED`, transaction `null`.
- M7 Aristotle mainnet writes: `false`.
- Durable structured summary: `hackathon/m7-live-evidence.json`.
- Status: GALILEO VERIFIED; MAINNET PREPARED ONLY.

## Product
- Judge-facing shared integrity-checked projections: IMPLEMENTED for software and Agent Skills.
- Railway production topology: `proofrail-app` + `proofrail-worker` only.
- Supabase-backed job persistence: LIVE.
- Public signing endpoint: NONE.
- Demo video: PENDING.

## External validation
- External repository #1: PENDING
- External repository #2: PENDING
- External repository #3: PENDING
