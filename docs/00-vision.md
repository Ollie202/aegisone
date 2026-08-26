# Vision

## North star

Make software release claims independently verifiable by humans and autonomous agents instead of requiring them to trust the publisher's source page, build machine, CI pipeline, distribution server, or AegisOne itself.

## The exact problem

Open source lets people inspect source code. It does not automatically establish that the precompiled artifact they install was actually produced from that source.

The useful question is not:

> Is this code good?

It is:

> Does this exact artifact correspond to the exact source revision and build claim the publisher declared?

## Long-term product

An open software-verification network where:

1. publishers create explicit release/source claims;
2. source identities can accumulate stronger evidence such as repository authentication, signatures, or domain binding;
3. independent builders reproduce exact revisions in controlled environments;
4. builders produce portable cryptographic evidence;
5. multiple genuinely independent builders can corroborate the same release;
6. humans and agents apply explicit policies such as `2-of-3 matching builders` or `require at least one TEE builder`;
7. verification remains possible without trusting an AegisOne website.

## Agent future

AegisOne should be infrastructure **used by agents**, not another generic agent wrapper. A software-installing/deploying agent can query deterministic AegisOne evidence before executing an artifact. Builder/verifier agents may later use Agentic ID / ERC-8004-compatible identity and reputation signals.

## What this project is not

- A malware scanner.
- A code-quality grader.
- An LLM security oracle.
- A guarantee that software is safe.
- A magical discovery engine for "official" repositories.
- A replacement for source review, signatures, SBOMs, Sigstore, SLSA, or GitHub attestations.
- A token/marketplace project in Wave 3.

## Product principle

**Evidence over authority.** AegisOne is not the source of truth. It makes independently produced evidence easier to create, aggregate, inspect, and enforce.
