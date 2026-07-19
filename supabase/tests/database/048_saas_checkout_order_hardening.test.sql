BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(10);

SELECT extensions.ok(
  to_regclass('public.idx_payment_orders_pending_checkout_reuse') IS NOT NULL,
  '048 creates the pending checkout reuse index'
);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'checkout-048-1@example.invalid', '', NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'checkout-048-2@example.invalid', '', NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'checkout-048-3@example.invalid', '', NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'checkout-048-4@example.invalid', '', NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  );

INSERT INTO public.organizations (id, name, slug, plan, status, owner_email)
VALUES
  (
    '82000000-0000-4000-8000-000000000001',
    'Checkout Reuse Store', 'checkout-reuse-048', 'basic', 'trialing',
    'checkout-048-1@example.invalid'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    'Checkout Actor Limit Store', 'checkout-actor-limit-048', 'basic', 'trialing',
    'checkout-048-2@example.invalid'
  ),
  (
    '82000000-0000-4000-8000-000000000003',
    'Checkout Org Limit Store', 'checkout-org-limit-048', 'basic', 'trialing',
    'checkout-048-1@example.invalid'
  );

INSERT INTO public.subscriptions (id, org_id, plan, status, trial_end)
VALUES
  (
    '83000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    'basic', 'trialing', NOW() + INTERVAL '3 days'
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    'basic', 'trialing', NOW() + INTERVAL '3 days'
  ),
  (
    '83000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000003',
    'basic', 'trialing', NOW() + INTERVAL '3 days'
  );

INSERT INTO public.organization_members (id, org_id, user_id, role, email, status)
VALUES
  (
    '84000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'owner', 'checkout-048-1@example.invalid', 'active'
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002',
    'owner', 'checkout-048-2@example.invalid', 'active'
  ),
  (
    '84000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000001',
    'owner', 'checkout-048-1@example.invalid', 'active'
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000003',
    'admin', 'checkout-048-3@example.invalid', 'active'
  ),
  (
    '84000000-0000-4000-8000-000000000005',
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000004',
    'admin', 'checkout-048-4@example.invalid', 'active'
  );

SELECT set_config('request.jwt.claim.role', 'service_role', TRUE);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"service_role"}',
  TRUE
);

CREATE TEMP TABLE checkout_048_capture (
  check_name TEXT PRIMARY KEY,
  value JSONB NOT NULL
) ON COMMIT DROP;

DO $checkout_048$
DECLARE
  first_order JSONB;
  reused_order JSONB;
  replacement_order JSONB;
  nonpending_replacement JSONB;
  rate_result JSONB;
  actor_id UUID;
  index_value INTEGER;
BEGIN
  first_order := public.create_self_service_payment_order(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'ecpay', 'test', 'basic', 399,
    'R048REUSE001', 'migration-048-reuse-order-0001',
    '{"merchant_id":"reuse-merchant-048"}'::jsonb
  );
  reused_order := public.create_self_service_payment_order(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'ecpay', 'test', 'basic', 399,
    'R048REUSE002', 'migration-048-reuse-order-0002',
    '{"merchant_id":"reuse-merchant-048"}'::jsonb
  );
  INSERT INTO checkout_048_capture VALUES (
    'pending_reuse',
    jsonb_build_object(
      'same_id', first_order ->> 'id' = reused_order ->> 'id',
      'disposition', reused_order ->> 'disposition',
      'count', (
        SELECT COUNT(*)
        FROM public.payment_orders
        WHERE org_id = '82000000-0000-4000-8000-000000000001'
      )
    )
  );

  UPDATE public.payment_orders
  SET expires_at = NOW() - INTERVAL '1 second'
  WHERE id = (first_order ->> 'id')::UUID;

  replacement_order := public.create_self_service_payment_order(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'ecpay', 'test', 'basic', 399,
    'R048EXPIRE001', 'migration-048-expire-order-0001',
    '{"merchant_id":"reuse-merchant-048"}'::jsonb
  );
  INSERT INTO checkout_048_capture VALUES (
    'expired_replacement',
    jsonb_build_object(
      'different_id', first_order ->> 'id' <> replacement_order ->> 'id',
      'old_status', (
        SELECT status
        FROM public.payment_orders
        WHERE id = (first_order ->> 'id')::UUID
      )
    )
  );

  UPDATE public.payment_orders
  SET status = 'cancelled'
  WHERE id = (replacement_order ->> 'id')::UUID;

  nonpending_replacement := public.create_self_service_payment_order(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'ecpay', 'test', 'basic', 399,
    'R048TERMINAL01', 'migration-048-terminal-order-0001',
    '{"merchant_id":"reuse-merchant-048"}'::jsonb
  );
  INSERT INTO checkout_048_capture VALUES (
    'terminal_not_reused',
    jsonb_build_object(
      'different_id', replacement_order ->> 'id' <> nonpending_replacement ->> 'id'
    )
  );

  FOR index_value IN 1..5 LOOP
    PERFORM public.create_self_service_payment_order(
      '82000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000002',
      'ecpay', 'test', 'basic', 399,
      'R048ACT' || LPAD(index_value::TEXT, 3, '0'),
      'migration-048-actor-order-' || LPAD(index_value::TEXT, 4, '0'),
      jsonb_build_object('merchant_id', 'actor-merchant-' || index_value)
    );
  END LOOP;
  rate_result := public.create_self_service_payment_order(
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002',
    'ecpay', 'test', 'basic', 399,
    'R048ACT006', 'migration-048-actor-order-0006',
    '{"merchant_id":"actor-merchant-6"}'::jsonb
  );
  INSERT INTO checkout_048_capture VALUES ('actor_limit', rate_result);

  FOR index_value IN 1..10 LOOP
    actor_id := CASE MOD(index_value - 1, 3)
      WHEN 0 THEN '81000000-0000-4000-8000-000000000001'::UUID
      WHEN 1 THEN '81000000-0000-4000-8000-000000000003'::UUID
      ELSE '81000000-0000-4000-8000-000000000004'::UUID
    END;
    PERFORM public.create_self_service_payment_order(
      '82000000-0000-4000-8000-000000000003',
      actor_id,
      'ecpay', 'test', 'basic', 399,
      'R048ORG' || LPAD(index_value::TEXT, 3, '0'),
      'migration-048-org-order-' || LPAD(index_value::TEXT, 4, '0'),
      jsonb_build_object('merchant_id', 'org-merchant-' || index_value)
    );
  END LOOP;
  rate_result := public.create_self_service_payment_order(
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000003',
    'ecpay', 'test', 'basic', 399,
    'R048ORG011', 'migration-048-org-order-0011',
    '{"merchant_id":"org-merchant-11"}'::jsonb
  );
  INSERT INTO checkout_048_capture VALUES ('org_limit', rate_result);
END
$checkout_048$;

SELECT extensions.ok(
  (SELECT (value ->> 'same_id')::BOOLEAN FROM checkout_048_capture WHERE check_name = 'pending_reuse'),
  '048 reuses a matching pending order across different idempotency keys'
);

SELECT extensions.is(
  (SELECT value ->> 'disposition' FROM checkout_048_capture WHERE check_name = 'pending_reuse'),
  'reused_pending',
  '048 identifies a same-plan pending reuse'
);

SELECT extensions.is(
  (SELECT (value ->> 'count')::BIGINT FROM checkout_048_capture WHERE check_name = 'pending_reuse'),
  1::BIGINT,
  'pending reuse does not create another payment order'
);

SELECT extensions.ok(
  (
    SELECT (value ->> 'different_id')::BOOLEAN AND value ->> 'old_status' = 'expired'
    FROM checkout_048_capture
    WHERE check_name = 'expired_replacement'
  ),
  '048 expires stale pending orders before creating their replacement'
);

SELECT extensions.ok(
  (
    SELECT (value ->> 'different_id')::BOOLEAN
    FROM checkout_048_capture
    WHERE check_name = 'terminal_not_reused'
  ),
  '048 never reuses a non-pending order for a new idempotency key'
);

SELECT extensions.ok(
  (
    SELECT value ->> 'error_code' = 'checkout_rate_limited'
      AND value ->> 'scope' = 'actor'
      AND (value ->> 'retry_after_seconds')::INTEGER > 0
    FROM checkout_048_capture
    WHERE check_name = 'actor_limit'
  ),
  '048 returns a stable actor limit with a positive retry interval'
);

SELECT extensions.is(
  (
    SELECT COUNT(*)
    FROM public.payment_orders
    WHERE org_id = '82000000-0000-4000-8000-000000000002'
  ),
  5::BIGINT,
  'actor limiting persists exactly five new orders in fifteen minutes'
);

SELECT extensions.ok(
  (
    SELECT value ->> 'error_code' = 'checkout_rate_limited'
      AND value ->> 'scope' = 'org'
      AND (value ->> 'retry_after_seconds')::INTEGER > 0
    FROM checkout_048_capture
    WHERE check_name = 'org_limit'
  ),
  '048 returns a stable organization limit across multiple administrators'
);

SELECT extensions.is(
  (
    SELECT COUNT(*)
    FROM public.payment_orders
    WHERE org_id = '82000000-0000-4000-8000-000000000003'
  ),
  10::BIGINT,
  'organization limiting persists exactly ten new orders in one hour'
);

SELECT * FROM extensions.finish();

ROLLBACK;
