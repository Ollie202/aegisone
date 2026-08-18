-- M6: token-gated server-to-server RPC surface.
--
-- Railway never needs the Supabase service-role secret. A normal publishable
-- Supabase key can invoke these RPCs, but every function additionally requires
-- a high-entropy ProofRail app token. Only a SHA-256 digest of that token is
-- stored in the private schema. The raw token lives only in Railway.

create schema if not exists proofrail_private;
revoke all on schema proofrail_private from public, anon, authenticated;

create table if not exists proofrail_private.app_auth (
  singleton boolean primary key default true check (singleton),
  token_sha256 bytea not null,
  rotated_at timestamptz not null default now()
);
revoke all on table proofrail_private.app_auth from public, anon, authenticated;

create or replace function proofrail_private.app_token_authorized(p_token text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from proofrail_private.app_auth
    where singleton = true
      and token_sha256 = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
  );
$$;
revoke all on function proofrail_private.app_token_authorized(text) from public, anon, authenticated;

create or replace function public.proofrail_job_create(
  p_token text,
  p_owner_id uuid,
  p_artifact_kind text,
  p_project_id text,
  p_source_repository text,
  p_source_commit_sha text,
  p_source_subdirectory text,
  p_publisher_artifact_name text,
  p_publisher_artifact_sha256 text
)
returns setof public.verification_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not proofrail_private.app_token_authorized(p_token) then
    raise exception 'invalid ProofRail app token' using errcode = '42501';
  end if;

  return query
    insert into public.verification_jobs (
      owner_id,
      status,
      artifact_kind,
      project_id,
      source_repository,
      source_commit_sha,
      source_subdirectory,
      publisher_artifact_name,
      publisher_artifact_sha256
    ) values (
      p_owner_id,
      'queued',
      p_artifact_kind,
      p_project_id,
      p_source_repository,
      p_source_commit_sha,
      p_source_subdirectory,
      p_publisher_artifact_name,
      p_publisher_artifact_sha256
    )
    returning *;
end;
$$;
revoke all on function public.proofrail_job_create(text, uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.proofrail_job_create(text, uuid, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.proofrail_job_get(
  p_token text,
  p_id uuid
)
returns setof public.verification_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not proofrail_private.app_token_authorized(p_token) then
    raise exception 'invalid ProofRail app token' using errcode = '42501';
  end if;

  return query
    select * from public.verification_jobs where id = p_id limit 1;
end;
$$;
revoke all on function public.proofrail_job_get(text, uuid) from public;
grant execute on function public.proofrail_job_get(text, uuid) to anon, authenticated;

create or replace function public.proofrail_job_list(
  p_token text,
  p_filter_owner boolean,
  p_owner_id uuid
)
returns setof public.verification_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not proofrail_private.app_token_authorized(p_token) then
    raise exception 'invalid ProofRail app token' using errcode = '42501';
  end if;

  return query
    select *
    from public.verification_jobs
    where not p_filter_owner
       or (p_owner_id is null and owner_id is null)
       or owner_id = p_owner_id
    order by created_at desc;
end;
$$;
revoke all on function public.proofrail_job_list(text, boolean, uuid) from public;
grant execute on function public.proofrail_job_list(text, boolean, uuid) to anon, authenticated;

create or replace function public.proofrail_job_update(
  p_token text,
  p_id uuid,
  p_patch jsonb
)
returns setof public.verification_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not proofrail_private.app_token_authorized(p_token) then
    raise exception 'invalid ProofRail app token' using errcode = '42501';
  end if;

  return query
    update public.verification_jobs
    set
      status = case when p_patch ? 'status' then p_patch->>'status' else status end,
      publisher_artifact_sha256 = case when p_patch ? 'publisher_artifact_sha256' then p_patch->>'publisher_artifact_sha256' else publisher_artifact_sha256 end,
      manifest_sha256 = case when p_patch ? 'manifest_sha256' then p_patch->>'manifest_sha256' else manifest_sha256 end,
      storage_root = case when p_patch ? 'storage_root' then p_patch->>'storage_root' else storage_root end,
      storage_transaction = case when p_patch ? 'storage_transaction' then p_patch->>'storage_transaction' else storage_transaction end,
      registry_contract = case when p_patch ? 'registry_contract' then p_patch->>'registry_contract' else registry_contract end,
      registry_transaction = case when p_patch ? 'registry_transaction' then p_patch->>'registry_transaction' else registry_transaction end,
      registry_record_id = case when p_patch ? 'registry_record_id' then p_patch->>'registry_record_id' else registry_record_id end,
      verification_json = case when p_patch ? 'verification_json' then p_patch->'verification_json' else verification_json end,
      failure_code = case when p_patch ? 'failure_code' then p_patch->>'failure_code' else failure_code end,
      failure_message = case when p_patch ? 'failure_message' then p_patch->>'failure_message' else failure_message end
    where id = p_id
    returning *;
end;
$$;
revoke all on function public.proofrail_job_update(text, uuid, jsonb) from public;
grant execute on function public.proofrail_job_update(text, uuid, jsonb) to anon, authenticated;
