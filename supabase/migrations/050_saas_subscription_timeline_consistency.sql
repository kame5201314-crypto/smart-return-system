-- Keep the subscription entitlement summary on the period that is usable now.
--
-- Migration 046 correctly appends an early same-plan renewal after the existing
-- paid period, but then copies that future period_start into the subscription
-- aggregate. The entitlement end is correct; only the aggregate start is moved
-- into the future. This additive guard preserves the currently usable period
-- start while retaining the extended entitlement end.
--
-- Repository-only migration. Apply only to the SaaS Supabase project after an
-- explicit rollout approval. Never apply to the master/live/internal project.

CREATE OR REPLACE FUNCTION public.keep_current_subscription_period_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  covering_period_start TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'active'
     AND NEW.current_period_start IS NOT NULL
     AND NEW.current_period_start > NOW() THEN
    SELECT period.period_start
    INTO covering_period_start
    FROM public.subscription_periods AS period
    WHERE period.subscription_id = NEW.id
      AND period.status = 'active'
      AND period.period_start <= NOW()
      AND period.period_end > NOW()
    ORDER BY period.period_start DESC, period.created_at DESC
    LIMIT 1;

    IF covering_period_start IS NOT NULL THEN
      NEW.current_period_start := covering_period_start;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keep_current_subscription_period_start
ON public.subscriptions;

CREATE TRIGGER trg_keep_current_subscription_period_start
BEFORE INSERT OR UPDATE OF status, current_period_start, current_period_end
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.keep_current_subscription_period_start();

WITH corrected AS (
  SELECT
    subscription.id AS subscription_id,
    (
      SELECT period.period_start
      FROM public.subscription_periods AS period
      WHERE period.subscription_id = subscription.id
        AND period.status = 'active'
        AND period.period_start <= NOW()
        AND period.period_end > NOW()
      ORDER BY period.period_start DESC, period.created_at DESC
      LIMIT 1
    ) AS covering_period_start
  FROM public.subscriptions AS subscription
  WHERE subscription.status = 'active'
    AND subscription.current_period_start > NOW()
)
UPDATE public.subscriptions AS subscription
SET
  current_period_start = corrected.covering_period_start,
  updated_at = NOW()
FROM corrected
WHERE subscription.id = corrected.subscription_id
  AND corrected.covering_period_start IS NOT NULL;

REVOKE ALL ON FUNCTION public.keep_current_subscription_period_start()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keep_current_subscription_period_start()
  TO service_role;

COMMENT ON FUNCTION public.keep_current_subscription_period_start() IS
  'Prevents an early prepaid renewal from replacing the currently usable subscription period start with a future date.';
