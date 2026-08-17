# Project State

**Last updated:** 2026-08-17  
**Phase:** M5 Galileo judgeable slice proven — Aristotle mainnet gate pending
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
- The M5 runner prepared Aristotle commitments from that exact stored verification but contains no mainnet signer/submission path. The prepared object remains `PREPARED_NOT_SUBMITTED` with null contract/transaction fields.
- CLI inspection and the web viewer derive their status through the shared integrity-checked `createVerificationView()` core projection rather than UI logic.
- The successful M5 sandbox was deleted. The temporary M4 Railway execution service was restored to its read-only M4 inspection configuration and the temporary M4 Git branch handoff was restored to its original M4 SHA.
- No Aristotle mainnet contract has been deployed. The pre-mainnet gate and explicit approval remain required.
- Repository is public.

## Current remaining gate

M5 is technically proven through Galileo. The remaining Issue #5 chain criterion is the separately gated Aristotle mainnet anchor.

Before any mainnet write:

1. re-confirm current Aristotle chain/RPC/explorer details from official 0G sources;
2. query current mainnet gas/fees read-only;
3. determine the exact deploy/register transaction sequence and commitments;
4. verify the selected wallet has enough mainnet 0G without exposing its key;
5. present the exact proposed write/cost to the user;
6. obtain explicit approval;
7. only then submit the mainnet transaction(s), record evidence, and complete M5.

## Highest-risk unknowns

1. Is the current Aristotle deployment/registration cost acceptable at the explicit mainnet gate?
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
