-- Reject billing timestamps that would make a payment appear effective before
-- it could have happened, and keep settled timestamps immutable afterwards.
--
-- This migration is additive and repository-only. Apply it only to the SaaS
-- Supabase project after an explicit rollout approval. Never apply it to the
-- master/live/internal project. Migration 050 remains the source of truth for
-- early-renewal subscription aggregate start dates; this migration must not
-- reject a legitimate payment that is queued after an unexpired trial/manual
-- entitlement.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment_orders AS payment_order
    WHERE (
        payment_order.status = 'paid'
        OR (
          payment_order.status = 'manual_review'
          AND payment_order.paid_at IS NOT NULL
        )
      )
      AND (
        payment_order.paid_at IS NULL
        OR payment_order.paid_at < payment_order.created_at - INTERVAL '5 minutes'
        OR payment_order.paid_at > transaction_timestamp() + INTERVAL '5 minutes'
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'existing settled payment orders contain invalid timestamps; audit them before applying migration 052';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_payment_order_paid_at_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_created_at TIMESTAMPTZ;
  accepted_future_limit TIMESTAMPTZ := transaction_timestamp() + INTERVAL '5 minutes';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    original_created_at := OLD.created_at;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'payment order created_at is immutable';
    END IF;

    IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'payment order paid_at is immutable after it is recorded';
    END IF;
  ELSE
    original_created_at := NEW.created_at;
  END IF;

  IF NEW.status <> 'paid'
     AND NOT (NEW.status = 'manual_review' AND NEW.paid_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.paid_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'paid_at is required when a payment order is paid';
  END IF;

  IF original_created_at IS NULL
     OR NEW.paid_at < original_created_at - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'paid_at cannot predate the original payment order creation time';
  END IF;

  IF NEW.paid_at > accepted_future_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'paid_at cannot be more than five minutes in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payment_order_paid_at_integrity
ON public.payment_orders;

CREATE TRIGGER trg_enforce_payment_order_paid_at_integrity
BEFORE INSERT OR UPDATE OF status, paid_at, created_at
ON public.payment_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_order_paid_at_integrity();

REVOKE ALL ON FUNCTION public.enforce_payment_order_paid_at_integrity()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_payment_order_paid_at_integrity()
  TO service_role;

COMMENT ON FUNCTION public.enforce_payment_order_paid_at_integrity() IS
  'Requires paid and settled manual-review payment orders to carry a plausible paid_at timestamp relative to immutable original creation and database transaction times.';

CREATE OR REPLACE FUNCTION public.enforce_manual_payment_event_timestamp_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted_future_limit TIMESTAMPTZ := transaction_timestamp() + INTERVAL '5 minutes';
  payload_effective_at TIMESTAMPTZ;
BEGIN
  IF NEW.event_type <> 'manual.payment_marked' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.event_type = 'manual.payment_marked'
     AND (
       NEW.processed_at IS DISTINCT FROM OLD.processed_at
       OR NEW.payload -> 'effective_at' IS DISTINCT FROM OLD.payload -> 'effective_at'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment effective timestamps are immutable after processing';
  END IF;

  IF NEW.processed_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment processed_at is required';
  END IF;

  IF NEW.processed_at > accepted_future_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment processed_at cannot be more than five minutes in the future';
  END IF;

  IF NOT (NEW.payload ? 'effective_at')
     OR jsonb_typeof(NEW.payload -> 'effective_at') = 'null' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment payload effective_at is required';
  END IF;

  BEGIN
    payload_effective_at := NULLIF(BTRIM(NEW.payload ->> 'effective_at'), '')::TIMESTAMPTZ;
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION USING
        ERRCODE = '22007',
        MESSAGE = 'manual payment payload effective_at must be a valid timestamp';
  END;

  IF payload_effective_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment payload effective_at cannot be empty';
  END IF;

  IF payload_effective_at > accepted_future_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment payload effective_at cannot be more than five minutes in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_manual_payment_event_timestamp_integrity
ON public.billing_events;

CREATE TRIGGER trg_enforce_manual_payment_event_timestamp_integrity
BEFORE INSERT OR UPDATE OF event_type, processed_at, payload
ON public.billing_events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_manual_payment_event_timestamp_integrity();

REVOKE ALL ON FUNCTION public.enforce_manual_payment_event_timestamp_integrity()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_manual_payment_event_timestamp_integrity()
  TO service_role;

COMMENT ON FUNCTION public.enforce_manual_payment_event_timestamp_integrity() IS
  'Requires immutable, plausible processing/effective timestamps for manual payment events.';
