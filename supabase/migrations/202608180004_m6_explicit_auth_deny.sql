-- M6: make the Edge Function token-hash table's deny-by-default policy explicit.
-- The service-role used inside the Supabase Edge Function bypasses RLS; browser/
-- anonymous/authenticated API roles must never read or mutate this table.

drop policy if exists "proofrail_app_auth_deny_clients" on public.proofrail_app_auth;
create policy "proofrail_app_auth_deny_clients"
on public.proofrail_app_auth
for all
to anon, authenticated
using (false)
with check (false);
