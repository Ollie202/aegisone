# ProofRail *(working name)*

> Independently rebuild software from its publisher-declared source and give humans or AI agents evidence of whether the published artifact actually matches.

**Status:** M1 technical feasibility  
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

## The core Wave 3 demo

```text
Publisher says:
  source = github.com/acme/wallet @ commit 7c91ab...
  artifact = wallet-linux.tar.gz

Published artifact SHA-256       ABC123
Independent 0G rebuild SHA-256   ABC123
                                 -------
                                 MATCH ✓
```

Then replace or alter the published artifact:

```text
Published artifact SHA-256       999XYZ
Independent 0G rebuild SHA-256   ABC123
                                 -------
                                 MISMATCH ✕
```

That is the product's core security behavior.

## What ProofRail is not

- a malware scanner;
- a code-quality grader;
- an LLM deciding whether software is good or bad;
- a guarantee that verified source code is safe;
- a system that guesses which GitHub repository is official;
- a blockchain hash database with no independent rebuild.

A malicious project can publish malicious source and receive a valid correspondence result if the released artifact really came from that source. ProofRail proves **correspondence and evidence**, not benevolence.

## Why not just GitHub?

GitHub Artifact Attestations already provide strong signed provenance for software built in GitHub workflows. ProofRail should interoperate with that ecosystem rather than duplicate it.

Our intended wedge is **independent reproduction**: corroborate a publisher's release using a builder outside the publisher's own build pipeline, then aggregate portable evidence and explicit trust policies. SLSA describes this general pattern as verified reproducibility when independent build systems corroborate provenance.

See `research/competitors.md` and `research/prior-art.md`.

## Why 0G?

- **0G Sandbox / Tapp** — run the independent build in confidential/attestable execution where the supported evidence path allows it.
- **0G Storage** — preserve full provenance and build evidence outside a private ProofRail database.
- **0G Chain** — anchor compact historical commitments on mainnet so ProofRail cannot silently rewrite them later.
- **0G Agentic ID / ERC-8004 direction** — later identify independent builder/verifier agents and attach track records to them.
- **0G Compute** — later diagnose *why* two legitimate rebuilds diverge; it does not decide MATCH/MISMATCH.

## Humans and agents use the same verification engine

Wave 3 exposes deterministic CLI/JSON output. An agent does not need an MCP server to consume ProofRail initially:

```bash
proofrail verify wallet-linux.tar.gz --json
```

Later interfaces can include REST, SDK, and MCP without changing the cryptographic core.

## Scale model

Verification is cheap; rebuilding is expensive. ProofRail should rebuild a release once per builder/policy and let many consumers verify the resulting evidence. Wave 3 supports a narrow, constrained build family and explicit resource limits rather than arbitrary huge repositories.

## Wave 3 definition of done

1. Accept an explicit public-repository source/release claim.
2. Resolve the source to an exact immutable commit.
3. Rebuild a supported target independently using 0G execution where proven feasible.
4. Hash both the publisher artifact and reproduced artifact.
5. Generate canonical provenance and comparison evidence.
6. Store evidence on 0G Storage.
7. Anchor the compact record on 0G Chain mainnet.
8. Verify through CLI/JSON and a public human-readable page.
9. Show the genuine artifact pass and a tampered artifact fail.
10. Label every guarantee according to the evidence actually available.

No mocked 0G integration counts as completion.

## Start here

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/00-vision.md`
4. `docs/01-prd.md`
5. `docs/03-architecture.md`
6. `docs/11-trust-model.md`
7. `docs/12-agent-consumption.md`
8. `planning/current-sprint.md`

## License

Not selected yet. Do not add a license without an explicit ADR.
