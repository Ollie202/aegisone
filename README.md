# ProofRail *(working name)*

> Independently rebuild software from its publisher-declared source and give humans or AI agents evidence of whether the published artifact actually matches.

**Status:** M5 end-to-end slice proven through 0G Aristotle mainnet  
**Current target:** 0G Bridge Buildathon — Wave 3  
**Working-name warning:** `ProofRail` is not considered brand-safe yet. An unrelated active public project already uses the name in the trust/verification space. See `research/brand-risk.md`.

## The problem

A public GitHub repository does **not** by itself prove that the binary, archive, package, or container users download was actually built from that source. A compromised release server, CI system, maintainer account, or distribution pipeline can serve different bytes while the public source still looks clean.

## What ProofRail actually proves

ProofRail separates two different claims:

1. **Source claim** — the publisher declares which repository, exact commit, build recipe, and release artifact correspond to a release.
2. **Build correspondence** — an independent builder rebuilds that exact source and compares the resulting artifact digest with the published artifact.

ProofRail must never pretend it can magically discover the "official" repository. If publisher ownership has not been authenticated, the UI says **Source Declared**, not **Official Source Verified**.

A tiny source change creates a new Git commit and therefore a new release claim. Historical verification records remain pinned to the exact immutable commit used for that release.

## Proven Wave 3 slice

The real M5 path is now:

```text
explicit source claim
  -> publisher artifact bytes
  -> exact immutable Git commit
  -> independent 0G Sandbox rebuild
  -> core SHA-256 comparison
  -> MATCH / MISMATCH
  -> canonical verification evidence
  -> proof-verified 0G Storage round trip
  -> 0G Aristotle mainnet registry anchor
  -> shared CLI/web verification projection
```

Observed genuine result:

```text
Publisher artifact SHA-256       9978d500...d9aa154
Independent 0G rebuild SHA-256   9978d500...d9aa154
                                 ----------------
                                 MATCH
```

Then ProofRail flips one byte of the publisher artifact while keeping the independently reproduced bytes unchanged:

```text
Substituted publisher SHA-256     d5318963...1f8889
Independent 0G rebuild SHA-256   9978d500...d9aa154
                                 ----------------
                                 MISMATCH
```

The canonical genuine verification was `3080` bytes with SHA-256 `4d5e01d343faada3649afb6d96574c3e96abaf8f189664ff787f330e9bc8c7ec`. 0G Storage returned root `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`, transaction `0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6`, and sequence `147016`; proof verification and exact-byte equality both passed.

Those commitments are now anchored on 0G Aristotle mainnet in `ProofRailRegistry` at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`:

- deployment tx: `0x7a23a2564784252647505f21b714280d20d5c209785ff4a67c878e3bc684582c`;
- M5 registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`;
- record ID: `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`;
- exact contract read-back: `true`;
- actual combined mainnet fee: `0.001843856003226748 0G`, below the approved cap of `0.002246628007863198 0G`.

A separate GitHub Actions verifier with **no signer secret** independently confirmed contract code, deployment and registration receipts, the registration event, the exact stored commitments, submitter, and fee cap.

See `hackathon/m5-live-evidence.json`, `hackathon/m5-aristotle-mainnet.json`, and `hackathon/evidence.md` for the durable evidence summary.

## TEE evidence: precise boundary

The live provider returned real TDX evidence, but its v5 quote uses the legacy provider-signer-padded `report_data`. The caller artifact digest is **not** cryptographically bound into that quote, and the public toolbox build is not proven to execute inside the TEE.

ProofRail therefore displays the M5/M4 classification as:

`PROVIDER_EVIDENCE_ONLY`

not `OUTPUT_DIGEST_BOUND` and not "TEE-attested build".

## What ProofRail is not

- a malware scanner;
- a code-quality grader;
- an LLM deciding whether software is good or bad;
- a guarantee that verified source code is safe;
- a system that guesses which GitHub repository is official;
- a blockchain hash database with no independent rebuild.

A malicious project can publish malicious source and receive a valid correspondence result if the released artifact really came from that source. ProofRail proves **correspondence and evidence**, not benevolence.

## Why 0G?

- **0G Sandbox / Tapp** — independent external execution plus the provider/runtime evidence the live surface actually supports.
- **0G Storage** — preserve full canonical verification evidence outside a private ProofRail database.
- **0G Chain** — anchor compact historical commitments on mainnet so ProofRail cannot silently rewrite them later.
- **0G Agentic ID / ERC-8004 direction** — later identify independent builder/verifier agents and attach track records to them.
- **0G Compute** — later diagnose *why* two legitimate rebuilds diverge; it does not decide MATCH/MISMATCH.

## Run the repository checks

Requires Node.js 22+ and pnpm 10.15.0.

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install
pnpm check
pnpm test
```

Those checks include core MATCH/MISMATCH behavior, Storage orchestration, registry commitments/contracts, Sandbox/Tapp parsing/live-ABI fixtures, the M5 genuine/substitution flow, CLI inspection, web rendering, guarded Aristotle execution syntax, and secret-free Aristotle mainnet verification.

## CLI and web status share one core projection

CLI inspection reads a canonical `VerificationJson` and calls the same integrity-checked `createVerificationView()` function as the web renderer. Neither interface is permitted to recalculate or override the verdict.

```bash
node --experimental-strip-types packages/cli/src/cli.ts \
  inspect --evidence verification.json --json

PROOFRAIL_EVIDENCE_FILE=verification.json \
  pnpm --filter @proofrail/web start
```

The input must be a real canonical ProofRail verification object. `hackathon/m5-live-evidence.json` is intentionally a **summary**, not a substitute for that canonical object; the actual live canonical object is identified by its 0G Storage root/transaction/SHA above.

## Live M5 runner

`pnpm m5:live` performs real Galileo Sandbox and Storage writes. It is not part of the default demo/check command and requires a disposable funded Galileo private key in `ZEROG_SANDBOX_PRIVATE_KEY` (optionally a separate `ZEROG_STORAGE_PRIVATE_KEY`). It enforces chain ID `16602`, a bounded Sandbox deposit, exact fixture hashes, proof-enabled Storage retrieval, guaranteed sandbox cleanup, and contains **no Aristotle signer/submission path**.

Do not run it casually; the successful evidence is already recorded in the repository.

## Aristotle mainnet anchor

M5's compact commitments were submitted only after a read-only balance/nonce/fee gate and explicit user approval of a maximum combined fee. The guarded write path enforced:

- Aristotle chain ID `16661`;
- exact signer address;
- nonce `0` before deployment;
- exact compiled deployment bytecode hash;
- exact M5 record ID and registration calldata hash;
- predicted empty contract address;
- final fee refresh immediately before signing;
- a hard combined approval cap of `0.002246628007863198 0G`.

The two successful transactions consumed `0.001843856003226748 0G` total. Afterward, a secret-free verifier independently read the chain and confirmed the exact M5 commitments. Durable final evidence is in `hackathon/m5-aristotle-mainnet.json`.

## Start here

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `hackathon/m5-live-evidence.json`
4. `hackathon/m5-aristotle-mainnet.json`
5. `hackathon/evidence.md`
6. `docs/03-architecture.md`
7. `docs/11-trust-model.md`
8. `planning/current-sprint.md`

## License

Not selected yet. Do not add a license without an explicit ADR.
