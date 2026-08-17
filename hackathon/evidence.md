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
- Railway deployment: `6ff57bc8-6c0d-4304-a19c-659a88334798`
- Status: M2 live Storage evidence round trip COMPLETE.

## 0G Chain — Galileo registry dry-run
- Network: 0G Galileo Testnet
- Chain ID: `16602`
- Registry contract: `0x227Fcc243f25c395C93Df789EC72Bc75bf096017`
- Contract explorer: https://chainscan-galileo.0g.ai/address/0x227Fcc243f25c395C93Df789EC72Bc75bf096017
- Deployment transaction: `0xc265ce3bcd03440a6b7f40e7d24bbfc99722635399763e583f84e4ef4f332ae1`
- First registration transaction: `0xa20ae8bf02502020e4bef3ae22fb6f32b2a71fb4d6034e6cca6c3444f4f794c8`
- Record ID: `0xf57437f137bba4a6104af296a7d470573ad49be112a7ef02f6b10b8e413f26e8`
- Manifest digest: `0xf922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594`
- Source-claim digest: `0x7ceb96364d787db4e136b21b60b83266caf124380a1d00fe3cfb8e2c037ae63c`
- Publisher artifact digest: `0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Reproduced artifact digest: `0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Provenance root: `0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310`
- Exact contract read-back equality: `true`
- Deployment gas used: `299829`
- Registration gas used: `161123`
- Estimated combined Aristotle cost at the M3 read-only fee snapshot: `0.001843808003226664 0G`
- Railway deployment: `46fc7126-8d7b-4565-8f89-a284e8b3d898`
- Status: M3 Galileo deploy → register → read-back COMPLETE. No mainnet transaction was sent.

## 0G Chain — Aristotle mainnet
- Network: Aristotle mainnet
- Chain ID: `16661` (verify again immediately before any deployment)
- Contract address: PENDING
- Deployment transaction: PENDING
- First build registration transaction: PENDING
- Mainnet status: NOT DEPLOYED; pre-mainnet gate and explicit approval still required.

## 0G Sandbox / Tapp — M4
- Network: 0G Galileo Testnet / hosted private Sandbox surface
- Chain ID: `16602`
- Broker: `https://private-sandbox-testnet.0g.ai`
- Settlement contract: `0x3490B9053AC46F7Bf71A1ceBffcB2be2C1405b41`
- TappRegistry: `0x2Ce80374318B1d7Fb3345724457a182E0ad165c9`
- Execution provider: `0xa19C4E672576E186AF81548E950Bf74A736220C3`
- Provider URL: `https://provider-private-sandbox.0g.ai`
- Provider app ID: `0g-sandbox-provider`
- Snapshot: `daytonaio/sandbox:0.5.0-slim` (`0f9ef4b7-c805-4428-93f7-cc430678bf18`), 1 CPU / 1 GB memory / 3 GB disk
- Successful Railway deployment: `aca4afd8-b340-4866-8fb5-59267dc9d376`
- M4 implementation head used by the successful Railway run: `adc94f29e7695507757f7695a4c0c3886facc1e7`
- Successful sandbox ID: `adb7d1e4-d3cc-440d-8712-51ce498b5e69`
- Source repository: `https://github.com/Ollie202/proofrail-0g.git`
- Exact source commit requested: `e9c82277cef2f7630977e2473664e14eed2f860d`
- Clone transport: Daytona toolbox `/toolbox/git/clone` with exact `commit_id`
- Detached `.git/HEAD` read back: `e9c82277cef2f7630977e2473664e14eed2f860d`
- Exact commit verified: `true`
- Sandbox Node: `v22.14.0`
- Build command: `node /tmp/proofrail-m4/examples/hello-proofrail/build.mjs`
- Artifact check command: `sha256sum /tmp/proofrail-m4/examples/hello-proofrail/dist/hello-proofrail.json`
- Retrieved artifact path: `/tmp/proofrail-m4/examples/hello-proofrail/dist/hello-proofrail.json`
- Retrieved artifact bytes: `53`
- Retrieved artifact SHA-256: `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Expected artifact SHA-256: `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Exact artifact match: `true`
- Retrieved UTF-8 payload: `{"message":"hello from ProofRail","schemaVersion":1}\n`
- Successful sandbox cleanup/deletion: `true`

### M4 Tapp / TDX evidence
- TappRegistry version observed: `0.1.0`
- Registered TEE URL: `http://47.84.230.89:50051`
- Tapp node compose hash: `0xa32695bab9528fa38432d34f55322418e58334a058ca5f0e19508034f66f6178ab2cea1b25e6404e153a7d0826f6ba00`
- Successful-run TDX evidence byte length: `44897`
- Successful-run evidence SHA-256: `490e2f52e83f7dcb58a6ae044b20242fd85751596095bf5f9377364715e7fdfb`
- Successful-run evidence type: `Tdx`
- Successful-run evidence timestamp returned by provider: `1786983664`
- Evidence envelope keys observed: `cc_eventlog`, `gpu_evidence`, `quote`
- Quote encoding/version: base64 / TDX quote v5
- Quote `report_data` offset: `574`
- Quote `report_data`: `0xa19c4e672576e186af81548e950bf74a736220c30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`
- Artifact digest supplied as caller challenge: `0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`
- Expected SHA-512 runtime-data binding under current upstream construction: `0x949e3e5b71360d808e55e51577256949ecb35b82f45da43c9e112896338afac53ec016fd2eb7840449433eb0283d231e2b91f2563829c0b6985b19d0cdc3ca0f`
- Quote matches expected artifact-challenge runtime-data SHA-512: `false`
- Quote matches legacy provider-signer padding: `true`
- Provider TDX evidence: `PROVEN`
- Artifact-digest challenge binding on the live provider: `NOT AVAILABLE`
- Artifact computed inside the TEE: `NOT AVAILABLE`
- Reason: the real toolbox build ran in a non-sealed sandbox; the live Tapp quote attests the registered provider identity/runtime with legacy signer-only `report_data`, not the caller artifact digest. The observed sealed-only provider surface rejects toolbox operations, so ProofRail does not label this a TEE-attested build.

### M4 Sandbox transactions / cost observations
- Initial Tapp acknowledgement transaction: `0x595fd950c4752d41942100763607473f9295b6b903683e9dec892f17572fd778`
- Initial diagnostic deposit transaction: `0xab53685aac8d4997597e1ffeb668c42e77431bebd2f72be61d68cc6cf90d07d5`
- Initial diagnostic deposit: `0.08` Galileo testnet 0G; sandbox `deb16a03-2aac-4c2c-8f51-50d03acc28ba` was deleted after the image lacked a `git` binary. This attempt is retained as diagnostic evidence, not represented as a successful build.
- Successful retry deposit transaction: `0x5226b6185b53f1a5496f980c8ef67def589a97217a2b43461c38f0380f5f5639`
- Successful retry deposited: `69999999999999720` wei (`~0.07` Galileo testnet 0G)
- Authoritative on-chain create fee observed: `0.06 0G`
- Authoritative one-minute CPU+memory rate for selected snapshot: `0.0015 0G`
- Total provider deposits during M4: `149999999999999720` wei (`~0.15` testnet 0G)
- Read-only post-success provider balance at `2026-08-17T16:23:56Z`: `20000000000000160` wei (`~0.02` testnet 0G)
- Cumulative provider settlement observed by that snapshot: `129999999999999560` wei (`~0.13` testnet 0G), excluding wallet gas; voucher settlement is asynchronous.
- No mainnet transaction or deployment was sent during M4.
- Railway execution service returned to `railway.m4.inspect.json` read-only mode after the live run.
- Status: M4 real exact-commit Sandbox build → artifact retrieval → digest verification COMPLETE; TDX provider evidence captured with unsupported output-binding claims explicitly withheld.

## Product
- Live verifier URL: PENDING
- CLI release/version: PENDING
- Passing tests: M1–M4 branch CI green on `adc94f29e7695507757f7695a4c0c3886facc1e7` before the successful live M4 run.
- Demo video: PENDING

## External validation
- External repository #1: PENDING
- External repository #2: PENDING
- External repository #3: PENDING
