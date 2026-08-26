# Judging Strategy

## Judge thesis

Within seconds, a judge should understand:

1. **the real failure:** public source can stay clean while distributed release bytes are substituted;
2. **the proof:** AegisOne independently rebuilds the exact claimed commit and compares bytes;
3. **the 0G fit:** execution, evidence preservation, and historical commitments become less dependent on AegisOne's own infrastructure;
4. **the honesty:** the product never calls a build safe or an unauthenticated repository official.

## 0G story

### 0G Sandbox / Tapp
Reduce trust in a normal centralized build server for the independent reproduction.

### 0G Storage
Keep full provenance/evidence independently retrievable rather than only in an AegisOne database.

### 0G Chain
Anchor compact historical commitments so records cannot be silently rewritten.

### Later agent layer
Agentic ID / ERC-8004 can identify builder/verifier agents and expose track records, while reproduction evidence remains the proof of output.

## Competitive differentiation

Do not pitch "blockchain provenance." GitHub/Sigstore/SLSA already provide strong provenance primitives.

Pitch:

> **independent reproduction + portable evidence + policy enforcement for humans and autonomous agents**

## What the demo must prove

- explicit source/release claim;
- exact commit pinning;
- real publisher artifact;
- real independent build;
- publisher/rebuild hash comparison;
- real 0G Storage/mainnet evidence;
- truthful TEE evidence level;
- genuine artifact passes;
- substituted/tampered artifact fails.

## What not to optimize for

- number of contracts;
- number of 0G products mentioned;
- fake users;
- arbitrary AI features;
- inflated test counts;
- unsupported "official/safe/trustless" claims.

Optimize for one specific failure mode, a load-bearing sponsor integration, real execution, and evidence a judge can inspect.
