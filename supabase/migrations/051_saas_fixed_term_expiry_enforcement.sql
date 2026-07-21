-- Enforce fixed-term prepaid subscription expiry at the database boundary.
--
-- ECPay purchases are one-month prepaid entitlements rather than recurring
-- subscriptions. The application rejects writes after current_period_end, but
-- the database must independently enforce the same rule for stale sessions and
-- direct table writes. A truly legacy manual subscription may keep a NULL
-- end-date only when there is no self-service or manual-payment evidence.
--
-- Repository-only migration. Apply only to the SaaS Supabase project after an
-- explicit rollout approval. Never apply to the master/live/internal project.

CREATE INDEX IF NOT EXISTS idx_subscriptions_active_prepaid_expiry
ON public.subscriptions(current_period_end, org_id)
WHERE status = 'active'
  AND provider IN ('ecpay', 'manual')
  AND current_period_end IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_writable_organization_member(
  p_org_id UUID,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    JOIN public.organizations AS organization
      ON organization.id = member.org_id
    JOIN public.subscriptions AS subscription
      ON subscription.org_id = member.org_id
    WHERE member.org_id = p_org_id
      AND member.user_id = auth.uid()
      AND COALESCE(member.status, 'active') = 'active'
      AND (
        p_roles IS NULL
        OR member.role = ANY(p_roles)
      )
      AND (
        (
          organization.status = 'active'
          AND subscription.status = 'active'
          AND (
            (
              subscription.provider = 'ecpay'
              AND subscription.current_period_end IS NOT NULL
              AND subscription.current_period_end > NOW()
            )
            OR (
              subscription.provider = 'manual'
              AND (
                (
                  subscription.current_period_end IS NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM public.saas_self_service_trial_claims AS self_service_claim
                    WHERE self_service_claim.org_id = subscription.org_id
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM public.payment_orders AS paid_order
                    WHERE paid_order.org_id = subscription.org_id
                      AND paid_order.status = 'paid'
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM public.billing_events AS manual_payment_event
                    WHERE manual_payment_event.org_id = subscription.org_id
                      AND manual_payment_event.provider = 'manual'
                      AND manual_payment_event.event_type = 'manual.payment_marked'
                      AND manual_payment_event.status = 'processed'
                  )
                )
                OR subscription.current_period_end > NOW()
              )
            )
            OR subscription.provider IS NULL
            OR subscription.provider NOT IN ('ecpay', 'manual')
          )
        )
        OR (
          organization.status = 'trialing'
          AND subscription.status = 'trialing'
          AND subscription.trial_end IS NOT NULL
          AND subscription.trial_end > NOW()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) TO service_role;

COMMENT ON FUNCTION public.is_writable_organization_member(UUID, TEXT[])
  IS 'RLS helper that permits writes only while a paid prepaid period or trial entitlement is currently usable.';

CREATE OR REPLACE FUNCTION public.suspend_expired_paid_organization(
  p_org_id UUID,
  p_effective_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_at TIMESTAMPTZ := COALESCE(p_effective_at, NOW());
  org_record public.organizations%ROWTYPE;
  subscription_record public.subscriptions%ROWTYPE;
  covering_period_start TIMESTAMPTZ;
  covering_period_end TIMESTAMPTZ;
  created_audit_log_id UUID;
  expired_period_count INTEGER := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may suspend expired paid organizations.'
      USING ERRCODE = '42501';
  END IF;

  -- Billing writers use the same subscription -> organization lock order.
  SELECT *
  INTO subscription_record
  FROM public.subscriptions
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'reason', 'subscription_not_found'
    );
  END IF;

  IF subscription_record.status <> 'active'
     OR subscription_record.provider NOT IN ('ecpay', 'manual')
     OR subscription_record.current_period_end IS NULL
     OR subscription_record.current_period_end > effective_at THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'reason', 'not_expired_prepaid_subscription'
    );
  END IF;

  -- A stale aggregate may point at an already-ended period while the immutable
  -- ledger still contains a period that covers this exact effective instant.
  -- Lock that covering period after the subscription, repair both aggregate
  -- endpoints atomically, and leave the tenant active. A future-only period or
  -- a gap does not cover effective_at and therefore fails closed below.
  SELECT
    period.period_start,
    period.period_end
  INTO
    covering_period_start,
    covering_period_end
    FROM public.subscription_periods AS period
    WHERE period.subscription_id = subscription_record.id
      AND period.status = 'active'
      AND period.period_start <= effective_at
      AND period.period_end > effective_at
    ORDER BY period.period_start DESC, period.created_at DESC
    LIMIT 1
    FOR UPDATE;

  IF FOUND THEN
    UPDATE public.subscriptions
    SET
      current_period_start = covering_period_start,
      current_period_end = covering_period_end,
      updated_at = NOW()
    WHERE id = subscription_record.id;

    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'reason', 'active_paid_period_aggregate_repaired',
      'aggregate_repaired', true,
      'current_period_start', covering_period_start,
      'current_period_end', covering_period_end
    );
  END IF;

  SELECT *
  INTO org_record
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'reason', 'organization_not_found'
    );
  END IF;

  IF org_record.status <> 'active' THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'reason', 'organization_not_active'
    );
  END IF;

  UPDATE public.subscription_periods
  SET status = 'expired'
  WHERE subscription_id = subscription_record.id
    AND status = 'active'
    AND period_end <= effective_at;

  GET DIAGNOSTICS expired_period_count = ROW_COUNT;

  UPDATE public.subscriptions
  SET
    status = 'suspended',
    updated_at = NOW()
  WHERE id = subscription_record.id;

  UPDATE public.organizations
  SET
    status = 'suspended',
    suspension_source = 'billing',
    suspended_at = effective_at,
    updated_at = NOW()
  WHERE id = p_org_id;

  INSERT INTO public.audit_logs (
    org_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    p_org_id,
    NULL,
    'lifecycle.prepaid_period_expired_suspended',
    'subscription',
    subscription_record.id::text,
    jsonb_build_object(
      'previous_org_status', org_record.status,
      'previous_subscription_status', subscription_record.status,
      'next_status', 'suspended',
      'provider', subscription_record.provider,
      'current_period_end', subscription_record.current_period_end,
      'effective_at', effective_at,
      'expired_period_count', expired_period_count,
      'source', 'cron.saas.paid_period_expiry'
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'changed', true,
    'org_id', p_org_id,
    'subscription_id', subscription_record.id,
    'audit_log_id', created_audit_log_id,
    'next_status', 'suspended',
    'reason', 'prepaid_period_expired',
    'expired_period_count', expired_period_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)
  FROM anon;
REVOKE ALL ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ) IS
  'Idempotently repairs a stale current covering period or suspends an expired ECPay or bounded manual prepaid entitlement.';

CREATE OR REPLACE FUNCTION public.sync_organization_suspension_source_from_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.action = 'lifecycle.trial_expired_suspended' THEN
    UPDATE public.organizations
    SET suspension_source = 'trial_expired', updated_at = NOW()
    WHERE id = NEW.org_id AND status = 'suspended';
  ELSIF NEW.action = 'lifecycle.prepaid_period_expired_suspended' THEN
    UPDATE public.organizations
    SET suspension_source = 'billing', updated_at = NOW()
    WHERE id = NEW.org_id AND status = 'suspended';
  ELSIF NEW.action = 'platform.billing.org_suspended' THEN
    UPDATE public.organizations
    SET suspension_source = 'platform_admin', updated_at = NOW()
    WHERE id = NEW.org_id AND status = 'suspended';
  ELSIF NEW.action IN (
    'platform.billing.org_resumed',
    'platform.billing.manual_payment_marked'
  ) THEN
    UPDATE public.organizations
    SET suspension_source = NULL, updated_at = NOW()
    WHERE id = NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_organization_suspension_source ON public.audit_logs;
CREATE TRIGGER trg_sync_organization_suspension_source
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_organization_suspension_source_from_audit();

REVOKE ALL ON FUNCTION public.sync_organization_suspension_source_from_audit() FROM PUBLIC;
