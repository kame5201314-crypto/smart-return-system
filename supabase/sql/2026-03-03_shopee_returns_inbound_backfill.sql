-- One-off recovery script (2026-03-03)
-- Incident: part of shopee_returns lost inbound flags during status-separation rollout.
-- Scope: only rows that are scanned but currently not inbound.
-- Safety: this script only mutates is_inbound / inbound_at / updated_at.

BEGIN;

UPDATE public.shopee_returns
SET
  is_inbound = TRUE,
  inbound_at = COALESCE(inbound_at, scanned_at, NOW()),
  updated_at = NOW()
WHERE is_scanned = TRUE
  AND COALESCE(is_inbound, FALSE) = FALSE;

COMMIT;

