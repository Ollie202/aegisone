# Supabase — application index, not proof authority

ProofRail uses Supabase for mutable product state such as verification-job lifecycle and user ownership. It is deliberately **not** the source of truth for artifact correspondence.

## Trust boundary

- `verification_jobs.status` describes the application pipeline (`queued`, `running`, `verified`, `failed`).
- There is no mutable `verdict` column.
- `verification_json` is only a convenience cache. The app must pass it through ProofRail core integrity checks before displaying MATCH/MISMATCH.
- Durable canonical evidence belongs on 0G Storage.
- Compact immutable commitments belong on 0G Aristotle.
- Deleting or corrupting Supabase must not invalidate an already-published ProofRail proof.

## Migration

Apply `migrations/202608180001_m6_verification_jobs.sql` to the dedicated ProofRail Supabase project.

The migration enables RLS and creates authenticated-owner policies. The Railway backend uses a server-side service-role key; that key must never be shipped to browser code, committed to Git, printed in logs, or stored in a database row.
