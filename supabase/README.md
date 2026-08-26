# Supabase — application index, not proof authority

AegisOne uses Supabase for mutable product state such as verification-job lifecycle and user ownership. It is deliberately **not** the source of truth for artifact correspondence.

## Trust boundary

- `verification_jobs.status` describes the application pipeline (`queued`, `running`, `verified`, `failed`).
- There is no mutable `verdict` column.
- `verification_json` is only a convenience cache. The app must pass it through AegisOne core integrity checks before displaying MATCH/MISMATCH.
- Durable canonical evidence belongs on 0G Storage.
- Compact immutable commitments belong on 0G Aristotle.
- Deleting or corrupting Supabase must not invalidate an already-published AegisOne proof.

## Migrations

1. `migrations/202608180001_m6_verification_jobs.sql` creates the RLS-enabled application index.
2. `migrations/202608180002_m6_app_rpc.sql` adds a narrow token-gated server-to-server RPC surface.

The Railway backend does **not** need the Supabase service-role secret. It uses a normal Supabase publishable key plus a separate high-entropy `PROOFRAIL_SUPABASE_APP_TOKEN` held only in Railway. Supabase stores only SHA-256 of that app token in the private `proofrail_private.app_auth` table. The RPC functions are security-definer functions with fixed empty search paths and only expose the job operations AegisOne needs.

Authenticated-user RLS policies remain in place for future direct user-scoped access. No service-role secret, app token, private key, or other credential belongs in browser code, Git history, logs, or a public database row.
