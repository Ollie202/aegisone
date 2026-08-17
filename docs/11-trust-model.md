# Trust Model

This document answers the recurring question: **what exactly does ProofRail know, and why should anyone trust it?**

## ProofRail is not the source of truth

The product should be designed so users do not need to trust ProofRail's opinion. ProofRail assembles independently checkable claims and evidence.

## Claim 1 — Which source belongs to the release?

ProofRail cannot discover this with certainty from arbitrary bytes. A publisher/declarant supplies project/release identity, repository, immutable commit, build recipe, and artifact reference/bytes.

Assurance levels remain separate:

1. **DECLARED** — the mapping was supplied; ownership is not proven.
2. **REPOSITORY_AUTHENTICATED** — later, a GitHub-authenticated identity with repository permission registered it.
3. **SIGNED_RELEASE** — later, a recognized publisher key signs the release mapping.
4. Future domain/package/onchain bindings can add context.

Never collapse these into "official" without evidence.

## Claim 2 — Does the distributed artifact correspond to that source?

This is the main ProofRail job.

```text
exact source commit + explicit build recipe
                 ↓
        independent build
                 ↓
       reproduced artifact
                 ↓
              SHA-256
                 ↓
compare with SHA-256 of publisher artifact
```

- same bytes/hash → `MATCH`;
- different bytes/hash → `MISMATCH` or `DIVERGED`, depending on context;
- missing required evidence → `INSUFFICIENT_EVIDENCE`.

No LLM is needed.

## M4 — what 0G Sandbox/Tapp evidence actually proves

M4 independently proved that the hosted 0G Sandbox path can toolbox-clone an exact immutable ProofRail commit, execute the committed Node.js build, return the produced artifact bytes, and reproduce the expected 53-byte artifact SHA-256 exactly.

M4 separately obtained real TDX quote evidence from the execution provider's TappRegistry node. That evidence is useful provider/runtime evidence, but it is **not evidence that the artifact was computed inside the TEE**:

- the successful toolbox build ran in a non-sealed sandbox;
- the observed sealed-only provider rejects toolbox operations;
- the live Tapp quote v5 `report_data` is the provider signer address padded to 64 bytes;
- it does not match the SHA-512 construction that would bind the supplied artifact-digest challenge;
- the live evidence envelope also omits `runtime_data`.

Therefore ProofRail may say **independent 0G rebuild** and **provider TDX evidence available**. It must not say **TEE-attested artifact build**, **TEE-computed artifact**, or **artifact digest bound to TDX attestation** for the M4 flow.

A future stronger path may earn those labels only if the measured execution/output binding is independently verifiable.

## Why a tiny commit does not break the model

Git commits identify exact source revisions. If one line changes, the commit changes. A release record stays pinned to its original commit; a later release gets a new record.

## Why GitHub alone is not the same thing

GitHub can show source and can provide strong publisher-side build provenance/attestations. ProofRail's intended additional value is **corroboration outside the publisher's own build path**. The strongest future version asks multiple independent builders whether they can reproduce the exact release bytes and lets the consumer select a policy.

## What a PASS never means

A matching release can still contain intentionally malicious source code.

Therefore these phrases are forbidden unless separately proven:
- "safe software";
- "malware-free";
- "secure code";
- "trusted developer";
- "official source" from an unauthenticated declaration;
- "TEE-attested build" when only provider/runtime TEE evidence exists.

## Scaling model

Rebuild once per builder/policy, verify many times. Consumers normally hash the artifact they received and verify previously produced evidence. Builders perform the expensive work.

Wave 3 intentionally constrains supported repositories/build recipes and resource limits. Arbitrary-source build execution is a later operational problem, not an MVP requirement.

## Future trust policy example

```yaml
source:
  minimum_assurance: repository_authenticated

reproduction:
  minimum_builders: 3
  require_exact_match: true
  require_tee_builders: 1
  require_output_binding_for_tee_label: true

on_failure:
  refuse_execution: true
```

This is where ProofRail becomes useful infrastructure for autonomous agents and CI systems.
