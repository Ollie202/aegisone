# Product Requirements Document

## Product

ProofRail *(working name)* — independent software-release reproduction and evidence verification.

## Primary Wave 3 users

### Maintainer / publisher
Wants to make a release claim independently checkable.

### Consumer / security-conscious developer
Wants to verify that a downloaded artifact corresponds to a declared source revision.

### AI agent / automation
Wants a deterministic machine-readable policy result before installing, executing, or deploying software.

## Source entry model

ProofRail never guesses the official source.

Wave 3 accepts explicit source context through either:

1. **Publisher/source declaration** — repository URL + exact commit + build recipe + artifact/release reference.
2. **Direct GitHub release context** — a GitHub Release/repository is supplied explicitly, from which the exact commit/tag is resolved and pinned.

If publisher identity/ownership has not been authenticated, evidence must say `source_declared`, not `official_source_verified`.

Later versions can add GitHub App/OAuth repository ownership, signed release manifests, verified domains, package-registry identities, and onchain identities.

## Primary Wave 3 workflow

1. Receive a declared public GitHub source and published artifact.
2. Resolve the source to an immutable commit SHA.
3. Validate a constrained build recipe.
4. Hash the publisher artifact.
5. Independently rebuild the exact source revision.
6. Hash the reproduced artifact.
7. Compare the two digests.
8. Generate canonical provenance/comparison evidence.
9. Store evidence on 0G Storage.
10. Anchor the compact commitment on 0G mainnet.
11. Expose deterministic CLI/JSON and human-readable verification results.
12. Demonstrate a genuine MATCH and tampered MISMATCH.

## Core user stories

### Publisher
- I can explicitly declare the source/commit/build recipe for a release.
- I can submit the artifact users actually receive.
- I can see whether an independent reproduction matches it.
- I can publish evidence without claiming more identity assurance than was established.

### Verifier
- I can see who/what declared the source.
- I can see the exact immutable source commit.
- I can independently hash my local artifact.
- I can inspect independent reproduction evidence.
- I can distinguish MATCH, MISMATCH, DIVERGED, and INSUFFICIENT EVIDENCE.

### Agent
- I can consume stable JSON without parsing UI copy.
- I can apply a simple policy and refuse execution when required evidence is missing or mismatched.

## Wave 3 must-have

- public GitHub source input only;
- exact commit pinning;
- explicit source/release claim model;
- one narrow supported build family, initially Node.js with pinned lockfile;
- hard build resource/time limits;
- publisher-artifact SHA-256;
- independently reproduced-artifact SHA-256;
- deterministic comparison result;
- canonical provenance manifest;
- local verification engine;
- 0G Storage evidence round trip;
- minimal 0G mainnet registry;
- 0G Sandbox/Tapp build integration if the spike proves a usable path;
- CLI with `--json`;
- public web evidence viewer;
- tamper demo.

## Stretch only

- GitHub App/OAuth ownership proof;
- GitHub Action;
- SBOM / in-toto / SLSA interoperability;
- Docker/container verification;
- direct artifact-digest binding in TEE report data;
- 0G Compute divergence diagnosis.

## Non-goals for Wave 3

- private repositories;
- arbitrary repositories/languages;
- automatic source discovery;
- malware classification;
- AI code review as a trust oracle;
- multiple independent network builders;
- MCP server;
- token incentives, staking, reputation market, or multi-chain support.

## Success criteria

Wave 3 succeeds when a third party can reproduce the demo and independently confirm:

- the exact source claim;
- the publisher artifact digest;
- the independent rebuild digest;
- real 0G evidence;
- a real 0G mainnet registry record;
- MATCH for the genuine artifact;
- MISMATCH for a substituted/tampered artifact;
- truthful labels for every guarantee.
