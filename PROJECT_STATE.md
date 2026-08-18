# Project State

**Last updated:** 2026-08-18  
**Phase:** M5 complete — Aristotle mainnet anchor verified and merged
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
- M3 minimal registry contract/client is complete with a real Galileo deploy/register/read-back and measured gas.
- M4 real hosted 0G Sandbox exact-commit build is complete. The live provider returns real TDX evidence, but its legacy quote binds the provider signer rather than the caller artifact digest; ProofRail therefore labels it `PROVIDER_EVIDENCE_ONLY`, not a TEE-attested artifact build.
- M5 has a real judgeable end-to-end flow implemented by the same core checks used by CLI/web presentation.
- The successful M5 live run toolbox-cloned exact source commit `e9c82277cef2f7630977e2473664e14eed2f860d`, verified detached `.git/HEAD`, ran Node `v22.14.0`, rebuilt the 53-byte artifact, and reproduced SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`.
- Genuine publisher bytes returned `MATCH`. A deterministic one-byte publisher substitution returned `MISMATCH` while the independently reproduced bytes stayed unchanged.
- The genuine M5 verification produced manifest SHA-256 `b0ac39ac60df76f427311e3d1fce665b820b81a9c4b39481ce16843804419a54` and canonical evidence SHA-256 `4d5e01d343faada3649afb6d96574c3e96abaf8f189664ff787f330e9bc8c7ec` over `3080` bytes.
- Those exact canonical bytes completed a real 0G Storage round trip: root `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`, transaction `0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6`, sequence `147016`, proof verified, uploaded/downloaded SHA equal, and bytes equal.
- CLI inspection and the web viewer derive status through the shared integrity-checked `createVerificationView()` core projection rather than UI logic.
- 0G Aristotle mainnet network used for the final anchor: chain ID `16661`, RPC `https://evmrpc.0g.ai`, explorer `https://chainscan.0g.ai`.
- The user-approved mainnet safety envelope was capped at `0.002246628007863198 0G` for exactly two transactions.
- `ProofRailRegistry` is deployed on Aristotle at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`.
- Deployment transaction: `0x7a23a2564784252647505f21b714280d20d5c209785ff4a67c878e3bc684582c`, block `41916904`, gas used `299829`.
- M5 record `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e` is registered in that contract.
- Registration transaction: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`, block `41916913`, gas used `161135`.
- Independent secret-free GitHub Actions verification at block `41917073` confirmed contract code, deployment receipt, registration event, exact commitment read-back, submitter, nonce progression, and fee cap.
- Actual combined mainnet fee was `0.001843856003226748 0G`, below the approved cap.
- Ending signer nonce is `2`; ending observed balance is `0.618043437732865255 0G`.
- Mainnet execution tokens were cleared immediately after verification. M3/M4 temporary branch handoffs and Railway configs were restored.
- Durable final mainnet evidence is `hackathon/m5-aristotle-mainnet.json`.
- Final completed-head CI passed.
- PR #10 was marked ready and squash-merged into `main` as `38c427c3beadca008430ce86fde4238afcdd8db9`.
- Issue #5 is closed as completed.
- The temporary Railway signer service is staged for deletion; Railway requires dashboard two-factor verification to finalize that deletion.

## M5 status

M5 is **COMPLETE**. The required path is proven end-to-end through real 0G Sandbox execution, proof-verified Storage, and an independently verified Aristotle mainnet registry anchor.

The only remaining cleanup item is non-product infrastructure hygiene: apply the staged Railway deletion of the disposable `m5-aristotle-anchor-temp` service from the Railway dashboard because the platform requires two-factor verification for that destructive action.

## Highest-risk unknowns after M5

1. Can the first supported real-world Node.js build family remain deterministic outside the controlled fixture?
2. Can the live 0G Tapp/provider path later bind caller/runtime data or build output without replacing the proven public toolbox path?

## Kill / rethink criteria

Reconsider the project if:

- the basic independent-reproduction UX is confusing even on the controlled fixture;
- the supported build cannot be made deterministic enough for a credible demo;
- 0G execution cannot produce/retrieve the needed artifact/evidence without an impractical workaround;
- Wave 3 collapses into merely storing a publisher-provided hash onchain.

## Wave 3 success signal

A judge sees a publisher-declared GitHub commit and release artifact, watches ProofRail independently rebuild the commit through real 0G infrastructure, sees both hashes agree, then watches a substituted artifact fail — with inspectable Storage/registry/evidence links and no hidden "trust us" step.
