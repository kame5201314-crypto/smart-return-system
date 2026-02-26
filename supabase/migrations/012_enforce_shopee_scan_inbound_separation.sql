-- Enforce scan/inbound workflow separation at DB level.
-- Scan flow: update is_scanned/scanned_at only.
-- Inbound flow: update is_inbound/inbound_at only.

CREATE OR REPLACE FUNCTION public.enforce_shopee_scan_inbound_separation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  scan_changed BOOLEAN;
  inbound_changed BOOLEAN;
BEGIN
  scan_changed :=
    (NEW.is_scanned IS DISTINCT FROM OLD.is_scanned)
    OR (NEW.scanned_at IS DISTINCT FROM OLD.scanned_at);

  inbound_changed :=
    (NEW.is_inbound IS DISTINCT FROM OLD.is_inbound)
    OR (NEW.inbound_at IS DISTINCT FROM OLD.inbound_at);

  IF scan_changed AND inbound_changed THEN
    RAISE EXCEPTION 'Scan and inbound updates must be separated'
      USING ERRCODE = '23514',
            HINT = 'Update scan fields and inbound fields in separate statements.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shopee_scan_inbound_separation
  ON public.shopee_returns;

CREATE TRIGGER trg_enforce_shopee_scan_inbound_separation
BEFORE UPDATE ON public.shopee_returns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shopee_scan_inbound_separation();
