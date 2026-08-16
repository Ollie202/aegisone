# Vision

## North star

Make software releases independently verifiable instead of requiring users to blindly trust the publisher's build machine or distribution pipeline.

## Problem

Open source gives users visibility into source code, but users often install precompiled artifacts. The existence of clean source does not by itself prove that a downloaded binary, archive, package, or container was produced from that source.

## Long-term product

An open verification network where:

1. a project defines an exact source revision and build recipe;
2. independent builders reproduce it in controlled environments;
3. builders produce portable provenance/evidence;
4. evidence is independently inspectable;
5. users choose explicit trust policies such as `2-of-3 independent builds must agree`;
6. artifact verification remains possible without trusting a ProofRail website.

## Why this matters

High-consequence software includes wallets, node binaries, developer tools, infrastructure packages, security software, containers, and enterprise releases. Distribution integrity and source-to-artifact correspondence are meaningful trust boundaries for these systems.

## What this project is not

- A malware scanner.
- A code-quality grader.
- A guarantee that software is safe.
- A replacement for source review.
- A token/marketplace project.
- A blockchain added to a normal SaaS product without a trust reason.

## Product principle

**Evidence over authority.** ProofRail should not become the single source of truth. It should make the underlying evidence independently inspectable and verifiable.
