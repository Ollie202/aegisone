# Operations

## Production topology

- **Vercel:** primary `apps/web` deployment — https://aegisone-three.vercel.app
- **Railway `aegisone-app`:** parity/fallback web deployment
- **Railway `aegisone-worker`:** privileged worker; no public signer surface
- **Supabase:** mutable catalog/job/source-claim/verification persistence

The Railway-generated legacy domain `https://proofrail-app-production.up.railway.app` may still exist even though the service is now named `aegisone-app`.

## Secrets

The 0G storage signer belongs only on `aegisone-worker`.

Do not expose, copy or move signer/private-key material into:

- Vercel;
- browser code;
- public API responses;
- source control;
- ordinary Supabase rows.

Some deployed environment variables and Supabase objects still use `PROOFRAIL_*` / `proofrail_*` names for compatibility. Renaming them is an infrastructure migration, not a cosmetic text replacement.

## Deploy workflow

Normal development is deliberately simple:

```text
edit -> test -> commit to main -> CI -> automatic deployment
```

No PR/issue/milestone workflow is required unless the repo owner asks for one.

CI runs on pushes to `main` and executes the repository tests plus secret scanning.

## Local checks

```bash
pnpm install
pnpm check
pnpm test
```

Node.js 22+ and pnpm 10.15.0 are expected.

## Active deployment files

Keep:

- `vercel.json`
- `railway.json`
- `railway.product.json`
- `railway.worker.json`

Old milestone-specific Railway configs are historical and should not return to the active root.

## Live/funded work

Do not perform a funded 0G operation, paid-service action or new mainnet write without explicit repo-owner approval.

When a live 0G action is approved, record only the durable facts needed to reproduce/check it under `hackathon/`; do not create a new planning/ADR stack around it.

## Failure rule

If an integration is unavailable, return unavailable/insufficient explicitly. Do not silently fabricate a successful state or downgrade a security boundary just to keep a demo moving.
