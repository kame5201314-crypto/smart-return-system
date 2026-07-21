-- Reject billing timestamps that would make a payment or entitlement appear
-- effective before it could have happened.
--
-- This migration is additive and repository-only. Apply it only to the SaaS
-- Supabase project after an explicit rollout approval. Never apply it to the
-- master/live/internal project.

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
  IF NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    original_created_at := OLD.created_at;
  ELSE
    original_created_at := NEW.created_at;
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
  'Requires a paid payment order to carry a plausible paid_at timestamp relative to its immutable original created_at and the database transaction time.';

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

  IF NEW.processed_at IS NOT NULL
     AND NEW.processed_at > accepted_future_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment processed_at cannot be more than five minutes in the future';
  END IF;

  IF NEW.payload ? 'effective_at'
     AND jsonb_typeof(NEW.payload -> 'effective_at') <> 'null' THEN
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
  'Rejects manual payment events whose processed or payload effective timestamp is implausibly in the future.';

CREATE OR REPLACE FUNCTION public.enforce_paid_subscription_activation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  covering_period_start TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'active'
     AND NEW.provider IN ('ecpay', 'manual')
     AND NEW.current_period_start IS NOT NULL
     AND NEW.current_period_start > transaction_timestamp() THEN
    SELECT period.period_start
    INTO covering_period_start
    FROM public.subscription_periods AS period
    WHERE period.subscription_id = NEW.id
      AND period.status = 'active'
      AND period.period_start <= transaction_timestamp()
      AND period.period_end > transaction_timestamp()
    ORDER BY period.period_start DESC, period.created_at DESC
    LIMIT 1;

    IF covering_period_start IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'a paid subscription cannot become active from a future period without a period covering the current database time';
    END IF;

    NEW.current_period_start := covering_period_start;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_paid_subscription_activation_timestamp
ON public.subscriptions;

CREATE TRIGGER trg_enforce_paid_subscription_activation_timestamp
BEFORE INSERT OR UPDATE OF status, provider, current_period_start, current_period_end
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_paid_subscription_activation_timestamp();

REVOKE ALL ON FUNCTION public.enforce_paid_subscription_activation_timestamp()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_paid_subscription_activation_timestamp()
  TO service_role;

COMMENT ON FUNCTION public.enforce_paid_subscription_activation_timestamp() IS
  'Prevents ECPay or manual billing from activating a future entitlement unless an active immutable subscription period covers the current database time.';
