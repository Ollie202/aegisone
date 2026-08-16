# Trust Model

This document answers the recurring question: **what exactly does ProofRail know, and why should anyone trust it?**

## ProofRail is not the source of truth

The product should be designed so users do not need to trust ProofRail's opinion.

ProofRail assembles independently checkable claims and evidence.

## Claim 1 — Which source belongs to the release?

ProofRail cannot discover this with certainty from arbitrary bytes.

A publisher/declarant supplies:
- project/release identity;
- repository;
- immutable commit;
- build recipe;
- artifact reference/bytes.

The claim can carry different assurance levels:

1. **DECLARED** — the mapping was supplied; ownership is not proven.
2. **REPOSITORY_AUTHENTICATED** — later, a GitHub-authenticated identity with repository permission registered it.
3. **SIGNED_RELEASE** — later, a recognized publisher key signs the release mapping.
4. Future domain/package/onchain bindings can add more context.

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

## Why a tiny commit does not break the model

Git commits identify exact source revisions. If one line changes, the commit changes. That is correct behavior.

A release record stays pinned to its original commit. A later commit/release gets a new record.

```text
v2.4 -> commit A -> artifact hash X
v2.5 -> commit B -> artifact hash Y
```

ProofRail does not maintain one permanent fingerprint for an evolving repository.

## Why GitHub alone is not the same thing

GitHub can show source and can provide strong publisher-side build provenance/attestations. That is useful prior art.

ProofRail's intended additional value is **corroboration outside the publisher's own build path**. The strongest future version asks multiple independent builders whether they can reproduce the exact release bytes and lets the consumer select a policy.

## What a PASS never means

A matching release can still contain intentionally malicious source code.

Therefore these phrases are forbidden unless separately proven:
- "safe software";
- "malware-free";
- "secure code";
- "trusted developer";
- "official source" from an unauthenticated declaration.

## Scaling model

Rebuild once per builder/policy, verify many times.

Consumers normally do not rebuild large projects. They hash the artifact they received and verify previously produced evidence. Builders perform the expensive work.

Wave 3 intentionally constrains supported repositories/build recipes and resource limits. Arbitrary-source build execution is a later operational problem, not an MVP requirement.

## Future trust policy example

```yaml
source:
  minimum_assurance: repository_authenticated

reproduction:
  minimum_builders: 3
  require_exact_match: true
  require_tee_builders: 1

on_failure:
  refuse_execution: true
```

This is where ProofRail becomes useful infrastructure for autonomous agents and CI systems.
