-- Harden scan/inbound separation:
-- even if another trigger mutates inbound during scan updates,
-- restore inbound fields to previous values.

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

  -- Scan flow must not mutate inbound status.
  IF scan_changed AND inbound_changed THEN
    NEW.is_inbound := OLD.is_inbound;
    NEW.inbound_at := OLD.inbound_at;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger with a lexicographically-late name so it runs after
-- most legacy BEFORE UPDATE triggers.
DROP TRIGGER IF EXISTS trg_enforce_shopee_scan_inbound_separation
  ON public.shopee_returns;

DROP TRIGGER IF EXISTS zzzz_enforce_shopee_scan_inbound_separation
  ON public.shopee_returns;

CREATE TRIGGER zzzz_enforce_shopee_scan_inbound_separation
BEFORE UPDATE ON public.shopee_returns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shopee_scan_inbound_separation();
