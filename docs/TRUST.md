# Trust model

AegisOne does not have one trust score. It exposes separate facts so a human or agent can apply its own policy.

## Dimensions

### Discovery

`INDEXED`, `STALE` or unavailable answers only whether AegisOne knows about a capability. Discovery is not verification.

### Source assurance

Examples include `NONE`, `DECLARED`, `REPOSITORY_AUTHENTICATED` and `SIGNED_RELEASE`.

A repository URL appearing in metadata does not authenticate the publisher. Stronger labels require the actual corresponding evidence.

### Source inspection

`INSPECTED` means an exact immutable source revision was acquired/inspected and can carry its snapshot digest. It does not prove what a distributor served.

### Distribution correspondence

- `NOT_EVALUATED` / insufficient evidence — no valid comparison exists;
- `MATCH` — distinct distributed bytes equal the independently reproduced exact-source bytes;
- `MISMATCH` — they differ;
- `DIVERGED` — reproducibility is insufficient/ambiguous rather than malicious by definition.

**Source-only work can never emit `MATCH` or `MISMATCH`.**

### Security audit

Deterministic findings are independent from correspondence. A package may be `MATCH` and still contain critical behavior. Zero findings is not proof of safety.

### Canonical evidence / 0G

Evidence may include a canonical digest, 0G Storage root and, where actually written, a chain registry commitment. A field is shown only when its integrity gate accepts the underlying facts.

`STORED ON 0G` means a qualifying publication exists. It is not another word for `VERIFIED`.

### Consumer policy

Policy returns `ALLOW`, `REVIEW` or `DENY` from explicit requirements such as minimum source assurance, required correspondence, maximum severity or evidence freshness. Search relevance/category data never participates.

## Non-negotiable rules

1. `MATCH` / `MISMATCH` is deterministic; no LLM decides it.
2. `MATCH` needs a distinct distributed artifact and independent exact-source reproduction.
3. `MATCH` does not mean safe, benevolent or malware-free.
4. Audit findings never rewrite correspondence.
5. 0G Compute/LLM output is advisory only.
6. Missing evidence stays missing.
7. Supabase rows cannot manufacture proof.
8. A new commit is a new source revision, not a broken fingerprint.
9. Provider/search metadata cannot upgrade source assurance or evidence.
10. Do not claim TEE output binding unless the relevant digest is actually bound in independently verifiable attestation evidence.
11. Historical evidence is immutable; cleanup/branding must not rewrite what happened on-chain or in recorded receipts.
