# ADR-017: 0G evidence publication architecture and the Verified Library

- Status: accepted
- Date: 2026-08-28
- Supersedes: nothing
- Related: ADR-007 (canonical JSON manifest), ADR-008 (minimal registry commitments), ADR-016 (four-section IA), `docs/17-m8-security-boundaries.md` (Threats M8-005, M8-006, M8-012, M8-013)

## Context

Before this change, nothing in the running product ever wrote to 0G. `packages/storage-0g`'s
`performStorageRoundTrip` and `packages/registry-0g`'s `registerEvidence` were proven by the M5 and
M7 live runs, but they had no trigger reachable from the deployed system: the M5/M7 evidence was
produced by one-off scripted runs and recorded in `hackathon/*.json`.

The Verified Library needs a state that means "AegisOne's evidence for this resource genuinely
lives on 0G". That state is worthless — worse than worthless, actively dishonest — if it can be
produced by writing a row into Supabase, which AGENTS.md explicitly designates as "mutable
application/catalog/job memory, not proof authority".

So two problems had to be solved together: how evidence actually gets onto 0G, and how a reader can
tell a real publication from a claimed one.

## Decision

### 1. The signer stays in exactly one service

`ZEROG_STORAGE_PRIVATE_KEY` is held only by `aegisone-worker` (Railway). Neither `aegisone-app` nor
the Vercel deployment has it, and neither may construct a signing transport.

The worker gains exactly one new route, `POST /internal/publish-evidence`, which:

- **does not exist** unless `AEGISONE_WORKER_INTERNAL_TOKEN` is set (fail closed, matching how the
  GitHub App integration is absent when unconfigured);
- authenticates a bearer token by comparing SHA-256 digests with `timingSafeEqual`, **before**
  reading any request body;
- accepts a **closed key set** validated by `parsePublishEvidenceRequest`. There is deliberately no
  field for bytes-to-sign, calldata, a destination address, a contract, a command, or a URL. A
  fully-authenticated caller can cause exactly one class of effect: a size-capped evidence upload
  and a fixed-shape commitment of AegisOne's own digests to the configured registry contract;
- leaves `/health` behaviour unchanged and exposes no other route.

Signer construction lives in one module, `apps/worker/src/publish-config.ts`.
`apps/worker/test/signer-boundary.test.ts` asserts the entire `apps/web` source tree never reads the
key, never imports a signing-capable module, and never constructs a wallet.

### 2. Publication is an operator action

`POST /api/v1/publish` on the app calls the worker server-side. It requires an operator token
(minting the branded `VerificationAuthorization` from `packages/skill-verification-link`), applies a
strict independent rate limit and an in-process concurrency cap of one, and is absent entirely
unless the operator token, worker URL and worker internal token are all configured.

**We considered and rejected an end-user-facing publish button.** AegisOne has no user accounts and
no sessions, so a spend cannot be attributed or budgeted to a user; a per-IP limit on a funded
endpoint is trivially bypassed and every request would spend project funds. AGENTS.md forbids a
public endpoint that automatically spends 0G, and Threat M8-005 names this directly. An honest
operator-gated path is better than an anonymous spend endpoint dressed up as controlled, and the
Verified Library says so on the page rather than implying a capability visitors do not have.

### 3. Two-phase publication binds the storage root into the evidence digest

This is the load-bearing design decision.

1. **Phase 1** — the evidence bundle (exact artifact package bytes + canonical audit report +
   evidence facts) is canonically serialized and uploaded via `performStorageRoundTrip`, which
   already re-downloads with `proof: true` and asserts exact-byte equality. No root is returned
   unless the exact bytes were proven retrievable.
2. **Phase 2** — the canonical evidence manifest is built over the evidence facts **plus the root
   from phase 1**, and hashed. That digest is stored in `capability_verifications.
   canonical_evidence_sha256` and committed on chain as `manifestDigest`, with the same root as
   `provenanceRoot`.

The manifest cannot live inside the bundle it describes (a document cannot contain its own hash),
so the root flows forward. The payoff: **the storage root is cryptographically bound into the
canonical evidence digest.** A root and an evidence digest from two different publications can never
be paired, and mutating any committed field — correspondence status, either artifact digest, the
audit result, the timestamp, or the root itself — invalidates the pair.

Every field the manifest commits to is also a column on `capability_verifications`, which is what
lets `checkStoragePublicationIntegrity` recompute the digest from a stored row alone, with no side
data and no network call.

### 4. What each Verified Library state requires

Four **independent facts**, never summed, never collapsed into one badge, never a numeric score:

| State | Earned by |
|---|---|
| `INDEXED` | a current discovery record exists. Proves nothing about publisher, bytes or safety. |
| `AUDITED` | `trust.security.status === "COMPLETED"` — the deterministic static audit genuinely ran. Zero findings is not a safety guarantee. |
| `VERIFIED` | `trust.correspondence.status === "MATCH"` from `assembleTrustEvidence`, which re-checks the row's own invariants first. Never inferred from an audit passing. MATCH does not mean safe. |
| `STORED ON 0G` | `checkStoragePublicationIntegrity` returned `ok` — a structurally valid non-zero root and transaction, a valid timestamp, and a canonical evidence digest that **recomputes from the row's own facts with that exact root bound in**. |

`assembleTrustEvidence` — the single assembler behind the REST API, the MCP tools, the Evidence
Passport and the library — nulls `canonicalEvidence.storageRoot` and `registryRecordId` unless the
gate passes. The evidence-history endpoint applies the same gate independently. So a fabricated root
is structurally unable to reach any surface.

### 5. The honest limit, stated rather than glossed

The integrity check proves a recorded publication is **internally coherent**. It does not, and
cannot, prove locally that the root exists on the 0G network — only 0G can answer that. That is
precisely why every surface that renders a root also renders its public explorer/retrieval pointer,
and why the Evidence Passport says so in as many words. We rejected implying otherwise: claiming a
local check verifies on-chain existence would be exactly the "mock a required 0G integration and
present it as complete" failure AGENTS.md forbids.

### 6. Chain commitment is a separate, optional fact

A publication can be storage-only. When a registry is configured, the compact commitment is written
**only if the publication holds all five real commitments** (source snapshot, publisher and
reproduced digests, plus the manifest digest and provenance root). It is never padded with a
duplicated or zero value to fill a slot — a commitment asserting something AegisOne cannot back is
worse than no commitment. A failed chain write never discards a real storage root.

### 7. 0G DA and Agentic ID are deliberately excluded

Neither solves a problem AegisOne has.

- **0G DA** is for making large data availability provable to a rollup/consensus layer. AegisOne's
  evidence bundles are kilobytes, already stored with a proof-verified round trip on 0G Storage, and
  already committed compactly on chain. Adding DA would move no guarantee — it would add a
  dependency and a surface, and let us name a third 0G product without strengthening a single
  claim.
- **Agentic ID** addresses agent identity. AegisOne deliberately makes no identity claim about
  agents or publishers: source assurance is a separate, explicit ladder (`NONE` / `DECLARED` /
  `REPOSITORY_AUTHENTICATED` / `SIGNED_RELEASE`) anchored in GitHub repository authority. Grafting a
  second, weaker identity notion on top would blur the distinction ADR-012 exists to protect.

A shallow integration of either would make the 0G story *weaker*, not stronger, because it would
add claims we could not defend under scrutiny. The integration we do have — Storage, the Chain
registry, the Sandbox for independent reproduction, and Compute as strictly advisory — is used where
each genuinely earns its place.

## Consequences

- Storage and Compute keep their existing boundaries: 0G Sandbox independent reproduction is what
  earns correspondence; TEE/TDX evidence remains provider/runtime evidence only and is never
  described as binding the artifact digest or proving in-TEE computation; 0G Compute output stays
  advisory and can never change a deterministic verdict.
- No new permanent service, database or paid dependency. Production stays `aegisone-app` +
  `aegisone-worker`, and the existing `capability_verifications` columns are reused — no migration.
- A publication appends a new `capability_verifications` row and never mutates a prior verdict.
- The whole path is exercised in CI against injected fake transports, so no funded run is needed to
  prove it. A live run is a separate, explicitly approved step.
- Changing `PUBLICATION_NETWORK` would correctly invalidate every existing publication's integrity
  check rather than silently relabelling old evidence as belonging to a different chain.
