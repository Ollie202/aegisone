-- M8.7: persist the exact source-snapshot digest an M8.6 INSPECTED result computes
-- (docs/15-m8-api-inventory.md section 13 "Stable read API"), so the stable
-- GET /api/v1/resources/:resourceId (and .../evidence) response can present source
-- inspection evidence without inventing/reconstructing a digest that was never stored.
--
-- Purely additive: nullable, no default, no backfill. Rows written before this column
-- existed keep source_snapshot_sha256 = null; the M8.7 API serializer treats that as
-- unavailable evidence, never as an inferred/reconstructed value, and never upgrades an
-- INSPECTED status to look complete when this digest is missing.

alter table public.capability_verifications
  add column if not exists source_snapshot_sha256 text null
  check (source_snapshot_sha256 is null or source_snapshot_sha256 ~ '^[0-9a-fA-F]{64}$');
