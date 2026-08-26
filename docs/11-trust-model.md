# Trust Model

This document answers the recurring question: **what exactly does AegisOne know, and why should anyone trust it?**

## AegisOne is not the source of truth

AegisOne is designed so users/agents do not need to trust a mutable AegisOne opinion. It assembles independently checkable claims and evidence, then lets a consumer policy decide whether that evidence is sufficient.

M8 adds discovery, but discovery does not become truth.

## The M8 trust questions are separate

For every capability, AegisOne may know different amounts about several independent dimensions:

1. **Discovery:** what resource might satisfy the requested intent?
2. **Source assurance:** who, if anyone, authenticated the mapping between this resource/version and a source repository/revision?
3. **Source inspection:** did AegisOne independently retrieve/inspect the exact immutable source snapshot?
4. **Distribution correspondence:** do the distributed bytes correspond to independent reproduction from that exact claimed source?
5. **Security assessment:** what deterministic findings were observed in the Skill/package?
6. **Canonical evidence:** is there integrity-protected evidence/0G storage/registry data for the observation?
7. **Consumer policy:** is this evidence sufficient for this consumer?

None of these dimensions silently rewrites another.

## Claim 1 — Which source belongs to the release/capability?

AegisOne cannot infer the official source with certainty from arbitrary bytes or a search result.

The source-assurance ladder is:

### `NONE`

A discovery provider/metadata may reference a repository, but AegisOne has not received an authenticated explicit source claim.

### `DECLARED`

An explicit mapping was supplied and the exact source may be resolved, but authority over that source mapping is not proven.

### `REPOSITORY_AUTHENTICATED`

M8.5 earns this only when a real GitHub App user authorization flow establishes that an authenticated GitHub identity has sufficient effective write/push or admin-equivalent authority over the stable claimed repository identity, and the exact immutable source claim is canonicalized/digested.

The evidence records stable repository/user IDs, observed permission and authentication time in addition to human-readable names.

This does **not** mean the account is uncompromised, the code is safe, or every stakeholder approves the release.

### `SIGNED_RELEASE`

A stronger cryptographic provenance/signature path verifies the artifact/source/signing identity under explicit expected constraints.

For the current design, GitHub Artifact Attestations are the first candidate. Merely listing an attestation does not earn this level; cryptographic verification must succeed under expected repository/source/signer policy.

If no verifier succeeds, this assurance remains unavailable.

### Future adapters

Domain, package-registry, Sigstore/npm provenance or on-chain bindings may add new evidence paths later without changing correspondence semantics.

Never collapse any assurance level into “official/trusted/safe” without stating the exact evidence.

Detailed implementation: `docs/14-source-authentication.md`.

## Claim 2 — Was the exact source independently inspected?

AegisOne may retrieve an exact immutable source commit and inspect/package/audit it.

For Agent Skills this can legitimately produce:

`sourceInspection = INSPECTED`

But source inspection alone is **not distribution correspondence**.

If there is no distinct distributed/publisher artifact, AegisOne must leave correspondence as `NOT_EVALUATED` or `INSUFFICIENT_EVIDENCE`.

## Claim 3 — Does the distributed artifact correspond to that source?

This is the core AegisOne correspondence job.

```text
separate distributed/publisher artifact
                  ↓
               SHA-256
                  ↓
                  VS
                  ↓
exact claimed source commit + constrained recipe/package rule
                  ↓
        independent reproduction
                  ↓
       reproduced artifact/package
                  ↓
               SHA-256
```

- same bytes/hash → `MATCH`;
- different bytes/hash → `MISMATCH` or `DIVERGED` according to context;
- missing required evidence → `INSUFFICIENT_EVIDENCE` / not evaluated.

No LLM is needed or permitted in this verdict.

A repository/source archive cannot be compared against itself twice and called a meaningful `MATCH`. The publisher/distribution artifact must be distinct evidence from the independent exact-source reproduction.

## Claim 4 — Is the capability safe?

AegisOne does not currently make a universal safety certification.

For Agent Skills, deterministic static auditing is a separate evidence dimension that can identify known risky instruction/script/resource patterns.

Valid combinations include:

```text
MATCH + CRITICAL findings
MISMATCH + no findings
MATCH + no findings
```

A `MATCH` never means safe. Zero deterministic findings never proves malware-free/secure behavior.

## Claim 5 — What does discovery/relevance prove?

Nothing about security or provenance by itself.

ARD, GitHub Agent Finder, Hugging Face Discover and the MCP Registry help answer:

> “what might help with this task?”

Their identifiers, descriptions, scores and trust metadata are useful discovery context only until AegisOne separately validates evidence.

Search relevance is explicitly excluded from the M8 deterministic trust-policy evaluator.

## Claim 6 — What does canonical/0G evidence add?

Supabase/application rows are mutable. Strong AegisOne observations therefore have canonical deterministic evidence whose digest can be stored/retrieved through 0G Storage and committed in the AegisOne registry.

The database may cache summaries/pointers, but changing a row cannot create a cryptographic correspondence result or authenticated source claim.

Consumers can inspect the underlying evidence rather than trust a screenshot/database boolean.

## M4 / TEE boundary — unchanged

M4 independently proved that the hosted 0G Sandbox path can toolbox-clone an exact immutable AegisOne commit, execute the committed Node.js build, return the produced artifact bytes, and reproduce the expected artifact SHA-256 exactly.

M4 separately obtained real TDX quote evidence from the execution provider's TappRegistry node. That evidence is useful provider/runtime evidence, but it is **not evidence that the artifact was computed inside the TEE**:

- the successful toolbox build ran in a non-sealed sandbox;
- the observed sealed-only provider rejects toolbox operations;
- the live Tapp quote v5 `report_data` is the provider signer address padded to 64 bytes;
- it does not match the construction that would bind the supplied artifact-digest challenge;
- the live evidence envelope omits the required artifact/runtime output binding.

Therefore AegisOne may say **independent 0G rebuild** and **provider TDX evidence available**. It must not say **TEE-attested artifact build**, **TEE-computed artifact**, or **artifact digest bound to TDX attestation** for the current flow.

A future stronger path may earn those labels only if measured execution/output binding is independently verifiable.

## Source-claim conflicts

AegisOne must not silently choose between conflicting source assertions.

Examples:

- discovery provider says repository A, authenticated publisher claim says repository B;
- authenticated claim pins commit A, verified signed provenance for the same purported release binds commit B;
- version/distribution metadata conflicts with the authenticated claim.

Represent a source-claim conflict explicitly and let policy return `REVIEW` or `DENY` according to consumer settings.

Historical authenticated claims are not rewritten to make a newer claim look consistent.

## Why tiny source changes do not break the model

Git commits identify exact source revisions. A one-line change creates a new commit. A release/source claim stays pinned to the original immutable SHA; a later revision gets a new claim/version/evidence record.

## Why GitHub alone is not the same thing as AegisOne

GitHub can provide source hosting, repository authority, releases and strong publisher-side build provenance/attestations.

AegisOne's additional value is **independent correspondence evidence and policy aggregation outside the publisher's build path**, plus a discovery layer that makes these evidence dimensions consumable by agents.

Repository authentication says who had authority to make the source claim. Signed provenance can say what a publisher-side build identity produced. Independent 0G reproduction asks whether another environment can produce the same distributed bytes from the exact claimed source. These reinforce one another but are not interchangeable.

## Consumer trust policy

M8.1 implements deterministic consumer-side policy over independently available evidence dimensions.

Example:

```yaml
source:
  minimum_assurance: repository_authenticated

correspondence:
  require: match

security:
  maximum_severity: medium

evidence:
  maximum_age_hours: 24

missing_evidence:
  decision: deny
```

Policy output is:

- `ALLOW`
- `REVIEW`
- `DENY`

with structured reasons.

AegisOne supplies evidence; the consumer chooses requirements.

Future policies may add multiple independent builders/TEE-output-binding constraints only after those evidence paths genuinely exist.

## What AegisOne must never imply without separate proof

Forbidden/misleading phrases include:

- “safe software”;
- “malware-free”;
- “secure code”;
- “trusted developer”;
- “official source” from unauthenticated discovery/declaration;
- “verified Skill” without identifying which evidence dimension is verified;
- “TEE-attested build” when only provider/runtime TDX evidence exists.

## Scaling model

Discovery can operate over many indexed resources cheaply. Expensive independent verification is performed only for explicit supported jobs/versions, then consumers verify/reuse the resulting evidence many times.

AegisOne therefore does **not** need to independently rebuild every Skill returned by search.

Current resource/build limits remain part of the trust/security boundary. Arbitrary private-source and arbitrary build-recipe execution are not M8 MVP promises.

## Agent usage

Agents query AegisOne for discovery/evidence/policy; they do not need AegisOne to become a generic agent itself.

M8 MCP surface is intentionally read/policy oriented:

- search;
- inspect;
- evaluate.

No automatic installation/execution/signing is part of the initial trust path.

See `docs/12-agent-consumption.md` and `docs/17-m8-security-boundaries.md`.
