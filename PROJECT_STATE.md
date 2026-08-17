# Project State

**Last updated:** 2026-08-17  
**Phase:** M5 Galileo slice proven — Aristotle gate blocked on funding + explicit approval
**Product name:** ProofRail *(working name only)*

## Current product thesis

ProofRail does **not** determine whether code is good or bad and does **not** magically identify an official source repository.

The publisher supplies a source/release claim. ProofRail independently rebuilds the exact immutable commit under an explicit recipe, compares the reproduced artifact with the published artifact, and packages the resulting evidence for humans or AI agents.

Wave 3's headline is now:

> **publisher artifact vs independent 0G rebuild**

not merely "hash + blockchain".

## What is true now

- Repository foundation and project documentation exist.
- Core trust model separates source-claim identity from source-to-artifact correspondence.
- An LLM is outside the core MATCH/MISMATCH decision.
- Public repositories only for the first build path.
- M1 provider-independent core, local runner, deterministic fixture, canonical evidence, CLI JSON, MATCH and one-byte MISMATCH are complete.
- M2 real 0G Storage round trip is complete on Galileo with proof-verified exact-byte retrieval.
- M3 minimal registry contract/client is complete with a real Galileo deploy/register/read-back and measured gas. No mainnet transaction was sent.
- M4 real hosted 0G Sandbox exact-commit build is complete. The live provider returns real TDX evidence, but its legacy quote binds the provider signer rather than the caller artifact digest; ProofRail therefore labels it `PROVIDER_EVIDENCE_ONLY`, not a TEE-attested artifact build.
- M5 now has a real judgeable Galileo flow implemented by the same core checks used by CLI/web presentation.
- The successful M5 live run toolbox-cloned exact source commit `e9c82277cef2f7630977e2473664e14eed2f860d`, verified detached `.git/HEAD`, ran Node `v22.14.0`, rebuilt the 53-byte artifact, and reproduced SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`.
- Genuine publisher bytes returned `MATCH`. A deterministic one-byte publisher substitution returned `MISMATCH` while the independently reproduced bytes stayed unchanged.
- The genuine M5 verification produced manifest SHA-256 `b0ac39ac60df76f427311e3d1fce665b820b81a9c4b39481ce16843804419a54` and canonical evidence SHA-256 `4d5e01d343faada3649afb6d96574c3e96abaf8f189664ff787f330e9bc8c7ec` over `3080` bytes.
- Those exact canonical bytes completed a real 0G Storage round trip: root `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`, transaction `0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6`, sequence `147016`, proof verified, uploaded/downloaded SHA equal, and bytes equal.
- CLI inspection and the web viewer derive status through the shared integrity-checked `createVerificationView()` core projection rather than UI logic.
- The successful M5 sandbox was deleted. The temporary M4 Railway execution service and M4 Git branch were restored after the live run and again after the mainnet preflight.
- Current official 0G Builder Hub mainnet configuration was re-confirmed before the gate: chain ID `16661`, RPC `https://evmrpc.0g.ai`, explorer `https://chainscan.0g.ai`.
- The read-only Aristotle preflight on Railway deployment `685275d2-20a4-4995-a290-050fcdade44b` queried chain/balance/fees and estimated deployment without creating a signer or sending a transaction.
- The selected public wallet address is `0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb`; Aristotle nonce is `0`; Aristotle balance is currently `0.0 0G`.
- Current mainnet deployment gas estimate is `306924`. The approval envelope uses 20% safety limits of `368309` deployment gas and `193348` registration gas, total `561657` gas.
- At the gate's current max-fee snapshot `4000000014` wei/gas, that safety envelope is `0.002246628007863198 0G`.
- The predicted registry address if the currently empty wallet deploys at nonce `0` is `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`; it had no code at preflight time.
- Prepared M5 Aristotle record ID is `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`.
- No Aristotle mainnet contract has been deployed and no mainnet transaction has been signed or submitted.

## Current blocking gate

M5 cannot proceed to mainnet yet because the selected wallet has `0.0 0G` on Aristotle and the user has not given the separate mainnet approval.

Required next actions:

1. fund `0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb` with enough mainnet 0G for the two-transaction safety envelope plus a small fee buffer;
2. re-run the read-only gate immediately after funding because fee data and nonce can change;
3. present the refreshed exact deploy/register envelope;
4. obtain explicit user approval;
5. only then submit deployment + registration, verify read-back, record ChainScan evidence, and close M5.

A practical funding target should be comfortably above the current `0.002246628007863198 0G` envelope (for example `0.003 0G` or more), but the actual required fee must be refreshed immediately before signing.

## Highest-risk unknowns

1. Is the current Aristotle deployment/registration cost acceptable to the user after funding and refresh?
2. Can the first supported real-world Node.js build family remain deterministic outside the controlled fixture?
3. Can the live 0G Tapp/provider path later bind caller/runtime data or build output without replacing the proven public toolbox path?

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/registry/evidence links and no hidden "trust us" step.
