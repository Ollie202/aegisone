# AegisOne

> Find agent capabilities. Audit what you have. Verify exact packages. Preserve evidence on 0G.

**Live app:** https://aegisone-three.vercel.app  
**Repository:** https://github.com/Ollie202/aegisone

AegisOne is a trust-aware capability hub for humans and AI agents. It keeps discovery, security findings, package correspondence and durable evidence separate instead of hiding them behind one vague trust score.

## Product

| Section | Route | Purpose |
| --- | --- | --- |
| **Skills** | `/` | Find and inspect Agent Skills/capabilities. |
| **Audit** | `/audit` | Run the live Agent Skill audit or package/artifact verification flows. |
| **Verified** | `/verified` | Browse evidence-backed resources and see exactly which states they earned. |
| **For Agents** | `/agents` | Use the same discovery/evidence/policy surface through REST and MCP. |

### What works today

- deterministic Agent Skill scanning and plain-English findings;
- package/artifact verification against an exact immutable source revision;
- federated discovery through ARD-compatible providers and the official MCP Registry;
- Evidence Passports with separate source, inspection, correspondence, security and evidence dimensions;
- deterministic `ALLOW` / `REVIEW` / `DENY` policy evaluation;
- MCP tools: `aegisone_search`, `aegisone_inspect`, `aegisone_evaluate`, `aegisone_scan`;
- real 0G Storage evidence publication through the protected worker path.

Smart-contract auditing and full MCP/agent-capability auditing are not live product capabilities yet.

## Trust rules

These are product invariants, not marketing copy:

- `INDEXED` means discovered, not verified.
- Search relevance is not trust.
- Source inspection alone cannot produce `MATCH` or `MISMATCH`.
- `MATCH` requires a distinct distributed artifact compared with an independent exact-source reproduction.
- `MATCH` does not mean safe.
- Security findings do not rewrite correspondence.
- 0G Compute output is advisory and cannot override deterministic results.
- Supabase is mutable product state; it cannot create proof.
- Missing evidence stays missing.

See `docs/TRUST.md` for the compact trust model.

## Architecture

```text
Humans / agents
      |
      v
Vercel: apps/web
  |       |        \
  |       |         -> discovery providers
  |       -> Supabase (mutable catalog/jobs)
  |
  -> Railway: aegisone-worker (privileged jobs / 0G signer)
                  |
                  -> 0G Storage / Chain

Independent verification uses the exact-source reproduction and audit modules;
canonical evidence is only surfaced when its integrity checks pass.
```

Vercel is the primary human-facing deployment. Railway keeps `aegisone-app` for parity/fallback and `aegisone-worker` for the privileged worker boundary. The 0G signer must remain worker-only.

## Repository map

```text
apps/          deployable web + worker
packages/      product modules and external adapters
contracts/     AegisOne registry contract
supabase/      database migrations + Edge Functions
examples/      deterministic fixtures/examples
hackathon/     immutable live evidence and submission receipts
docs/          five current docs only
```

The codebase is being simplified. Do not add a new package, planning document or abstraction unless it removes more complexity than it introduces or represents a real deploy/security boundary.

## Development

Requires Node.js 22+ and pnpm 10.15.0.

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
pnpm install
pnpm check
pnpm test
```

### Working style

This is a solo project. Normal changes go directly to `main`, CI runs on pushes to `main`, and Git history is the historical record. Do **not** create issues, pull requests, milestone documents, sprint files or ADRs unless the repo owner explicitly asks for them.

For current work, read only:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TRUST.md`

## 0G evidence

Historical receipts remain immutable under `hackathon/`.

Notable live evidence:

- M5 Aristotle mainnet anchor: `hackathon/m5-aristotle-mainnet.json`
- M7 Agent Skill / Galileo proof: `hackathon/m7-live-evidence.json`
- latest Verified Library 0G Storage publication: `hackathon/m10-0g-publication-evidence.json`

The latest publication has a proof-verified 0G Storage root, but deliberately has **no new chain registry commitment** because that resource had no real correspondence pair to commit.

## License

No license has been selected yet.
