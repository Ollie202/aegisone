# AegisOne coding rules

AegisOne is a solo project. Optimize for code that one person and one coding agent can understand quickly.

## Start here

Before meaningful changes, read:

1. `PROJECT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/TRUST.md`
4. the code you are actually changing

Do not read historical hackathon evidence unless the task needs it.

## Working method

- Work directly on `main` unless the repo owner explicitly asks for a branch.
- Do **not** create GitHub issues, pull requests, milestones, sprint files, planning docs or ADRs unless explicitly requested.
- Make the smallest coherent change that solves the current problem.
- Prefer deleting, merging or reusing abstractions over adding new ones.
- Do not create a new package merely because a concept is different. A package should normally represent a real reusable boundary, external adapter family, deploy boundary or security boundary.
- Keep current docs current; do not create a new document for every decision.
- Git history is history. `PROJECT_STATE.md` is current truth, not a diary.

## Product invariants

- `INDEXED` is discovery only.
- Search relevance/category metadata is never trust.
- Source assurance, source inspection, correspondence, security audit and canonical evidence are separate dimensions.
- Source-only inspection cannot emit `MATCH` / `MISMATCH`.
- `MATCH` requires a distinct distributed artifact and an independent reproduction from the exact claimed source revision.
- `MATCH` does not mean safe or malware-free.
- Security findings never rewrite correspondence.
- LLM/0G Compute analysis is advisory only and cannot override deterministic results.
- Missing evidence stays unavailable; never infer it to make a flow look complete.
- Supabase is mutable application state and cannot create proof.
- Never claim TEE artifact/output binding unless the digest is actually cryptographically bound in verifiable attestation evidence.

## Security / infrastructure

- Vercel is the primary public app.
- `aegisone-worker` is the privileged Railway boundary.
- The 0G signer must never enter browser, Vercel or public app code.
- Public endpoints must not become generic URL fetchers, shell runners, installers, signers or arbitrary funded-job triggers.
- Preserve request/download/archive/rate/concurrency limits around untrusted input.
- Historical evidence files under `hackathon/` are immutable facts; do not rewrite them for branding or cleanup.
- Some legacy `PROOFRAIL_*`, Supabase and Railway-domain identifiers are live compatibility contracts. Change them only as an explicit infrastructure migration.
- No funded 0G operation, paid API or mainnet write without explicit approval.

## Code-quality rule

Before adding a file/package/abstraction, ask:

> Does this make the system easier to understand and maintain, or am I creating another layer?

If it is another layer without a hard reason, do not add it.

Keep route handlers thin, move reusable behavior into clear domain modules, and avoid giant god files. The simplification target is documented in `PROJECT_STATE.md` and `docs/ARCHITECTURE.md`.

## Done

A change is done when:

- behavior is correct;
- relevant tests pass;
- `pnpm check` / `pnpm test` are run when practical;
- trust/security claims still match reality;
- `PROJECT_STATE.md` is updated only if current product truth changed.
