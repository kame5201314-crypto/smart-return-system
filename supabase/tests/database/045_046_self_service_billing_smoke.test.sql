BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(25);

-- Migration 045 must keep every tenant write behind the centralized helper.
SELECT extensions.ok(
  to_regprocedure('public.is_writable_organization_member(uuid,text[])') IS NOT NULL,
  '045 creates the writable-organization membership helper'
);

SELECT extensions.ok(
  (
    SELECT COUNT(*) = 17
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = ANY (ARRAY[
        'customers_staff_insert',
        'orders_staff_insert',
        'orders_staff_update',
        'return_requests_staff_insert',
        'return_requests_staff_update',
        'return_items_staff_insert',
        'return_items_staff_update',
        'return_images_staff_insert',
        'return_images_staff_update',
        'inspection_records_staff_insert',
        'inspection_records_staff_update',
        'shopee_returns_staff_insert',
        'shopee_returns_staff_update',
        'pickup_records_staff_insert',
        'pickup_records_staff_update',
        'shopee_unmatched_scans_staff_insert',
        'shopee_unmatched_scans_staff_update'
      ])
  ),
  '045 recreates all 17 guarded tenant write policies'
);

SELECT extensions.ok(
  (
    SELECT COUNT(*) = 17
      AND BOOL_AND(
        COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
          LIKE '%is_writable_organization_member%'
      )
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = ANY (ARRAY[
        'customers_staff_insert',
        'orders_staff_insert',
        'orders_staff_update',
        'return_requests_staff_insert',
        'return_requests_staff_update',
        'return_items_staff_insert',
        'return_items_staff_update',
        'return_images_staff_insert',
        'return_images_staff_update',
        'inspection_records_staff_insert',
        'inspection_records_staff_update',
        'shopee_returns_staff_insert',
        'shopee_returns_staff_update',
        'pickup_records_staff_insert',
        'pickup_records_staff_update',
        'shopee_unmatched_scans_staff_insert',
        'shopee_unmatched_scans_staff_update'
      ])
  ),
  '045 policies call the centralized writable-organization helper'
);

-- Migration 046 objects and RPC contracts must exist after the clean replay.
SELECT extensions.ok(
  to_regclass('public.payment_orders') IS NOT NULL,
  '046 creates payment_orders'
);

SELECT extensions.ok(
  to_regclass('public.subscription_periods') IS NOT NULL,
  '046 creates subscription_periods'
);

SELECT extensions.ok(
  to_regprocedure(
    'public.create_self_service_payment_order(uuid,uuid,text,text,text,integer,text,text,jsonb)'
  ) IS NOT NULL,
  '046 creates the service-only checkout RPC'
);

SELECT extensions.ok(
  to_regprocedure(
    'public.process_ecpay_payment_notification(text,text,text,text,text,integer,integer,text,boolean,timestamp with time zone,jsonb)'
  ) IS NOT NULL,
  '046 creates the service-only settlement RPC'
);

-- All fixtures are deterministic and are rolled back at the end of this test.
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
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'migration-gate@example.invalid',
  '',
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

INSERT INTO public.organizations (
  id,
  name,
  slug,
  plan,
  status,
  owner_email
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'Migration Gate Store',
  'migration-gate-store',
  'basic',
  'trialing',
  'migration-gate@example.invalid'
);

INSERT INTO public.subscriptions (
  id,
  org_id,
  plan,
  status,
  trial_end
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'basic',
  'trialing',
  NOW() + INTERVAL '3 days'
);

INSERT INTO public.organization_members (
  id,
  org_id,
  user_id,
  role,
  email,
  status
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'owner',
  'migration-gate@example.invalid',
  'active'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  TRUE
);

SELECT extensions.ok(
  public.is_writable_organization_member(
    '22222222-2222-4222-8222-222222222222',
    ARRAY['owner', 'admin', 'staff']
  ),
  '045 permits an active member during an unexpired trial'
);

UPDATE public.subscriptions
SET trial_end = NOW() - INTERVAL '1 minute'
WHERE id = '33333333-3333-4333-8333-333333333333';

SELECT extensions.ok(
  NOT public.is_writable_organization_member(
    '22222222-2222-4222-8222-222222222222',
    ARRAY['owner', 'admin', 'staff']
  ),
  '045 rejects writes after the trial expires'
);

UPDATE public.organizations
SET status = 'active'
WHERE id = '22222222-2222-4222-8222-222222222222';

UPDATE public.subscriptions
SET status = 'active'
WHERE id = '33333333-3333-4333-8333-333333333333';

SELECT extensions.ok(
  public.is_writable_organization_member(
    '22222222-2222-4222-8222-222222222222',
    ARRAY['owner', 'admin', 'staff']
  ),
  '045 permits an active paid workspace'
);

UPDATE public.organization_members
SET status = 'disabled'
WHERE id = '44444444-4444-4444-8444-444444444444';

SELECT extensions.ok(
  NOT public.is_writable_organization_member(
    '22222222-2222-4222-8222-222222222222',
    ARRAY['owner', 'admin', 'staff']
  ),
  '045 rejects a disabled member'
);

UPDATE public.organization_members
SET status = 'active'
WHERE id = '44444444-4444-4444-8444-444444444444';

UPDATE public.organizations
SET status = 'suspended', suspension_source = 'trial_expired'
WHERE id = '22222222-2222-4222-8222-222222222222';

UPDATE public.subscriptions
SET status = 'suspended', current_period_start = NULL, current_period_end = NULL
WHERE id = '33333333-3333-4333-8333-333333333333';

SELECT set_config('request.jwt.claim.role', 'service_role', TRUE);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"service_role"}',
  TRUE
);

CREATE TEMP TABLE billing_gate_capture (
  check_name TEXT PRIMARY KEY,
  passed BOOLEAN NOT NULL,
  value JSONB
) ON COMMIT DROP;

DO $billing_gate$
DECLARE
  actor_id CONSTANT UUID := '11111111-1111-4111-8111-111111111111';
  organization_id CONSTANT UUID := '22222222-2222-4222-8222-222222222222';
  result JSONB;
BEGIN
  BEGIN
    PERFORM public.create_self_service_payment_order(
      organization_id,
      actor_id,
      'ecpay',
      'test',
      'basic',
      398,
      'MGATEBADPRICE001',
      'migration-gate-bad-price-0001',
      '{"merchant_id":"3002607"}'::jsonb
    );

    INSERT INTO billing_gate_capture (check_name, passed, value)
    VALUES ('wrong_price_rejected', FALSE, NULL);
  EXCEPTION
    WHEN OTHERS THEN
      INSERT INTO billing_gate_capture (check_name, passed, value)
      VALUES (
        'wrong_price_rejected',
        POSITION('amount_twd does not match the server price' IN SQLERRM) > 0,
        jsonb_build_object('error', SQLERRM)
      );
  END;

  result := public.create_self_service_payment_order(
    organization_id,
    actor_id,
    'ecpay',
    'test',
    'basic',
    399,
    'MGATEBASIC001',
    'migration-gate-basic-order-0001',
    '{"merchant_id":"3002607"}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('basic_order', (result ->> 'amount_twd')::INTEGER = 399, result);

  result := public.create_self_service_payment_order(
    organization_id,
    actor_id,
    'ecpay',
    'test',
    'basic',
    399,
    'MGATEIGNORED002',
    'migration-gate-basic-order-0001',
    '{"merchant_id":"3002607"}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  SELECT
    'basic_order_retry',
    (result ->> 'id') = (value ->> 'id'),
    result
  FROM billing_gate_capture
  WHERE check_name = 'basic_order';

  result := public.create_self_service_payment_order(
    organization_id,
    actor_id,
    'ecpay',
    'test',
    'growth',
    699,
    'MGATEGROWTH001',
    'migration-gate-growth-order-0001',
    '{"merchant_id":"3002607"}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('growth_order', (result ->> 'amount_twd')::INTEGER = 699, result);

  result := public.create_self_service_payment_order(
    organization_id,
    actor_id,
    'ecpay',
    'test',
    'basic',
    399,
    'MGATESIM001',
    'migration-gate-simulated-order-0001',
    '{"merchant_id":"3002607"}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('simulated_order', TRUE, result);

  result := public.create_self_service_payment_order(
    organization_id,
    actor_id,
    'ecpay',
    'test',
    'basic',
    399,
    'MGATEMISMATCH001',
    'migration-gate-mismatch-order-0001',
    '{"merchant_id":"3002607"}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('mismatch_order', TRUE, result);

  result := public.process_ecpay_payment_notification(
    'MGATESIM001',
    'evt-migration-simulated-001',
    'TGSIM001',
    '3002607',
    'test',
    399,
    1,
    'Succeeded',
    TRUE,
    NOW(),
    '{}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES (
    'simulated_result',
    result ->> 'status' = 'ignored' AND result ->> 'reason' = 'simulate_paid',
    result
  );

  INSERT INTO billing_gate_capture (check_name, passed, value)
  SELECT
    'simulated_no_activation',
    organization.status = 'suspended'
      AND subscription.status = 'suspended'
      AND NOT EXISTS (
        SELECT 1
        FROM public.subscription_periods
        WHERE payment_order_id = (
          SELECT (value ->> 'id')::UUID
          FROM billing_gate_capture
          WHERE check_name = 'simulated_order'
        )
      ),
    NULL
  FROM public.organizations AS organization
  JOIN public.subscriptions AS subscription
    ON subscription.org_id = organization.id
  WHERE organization.id = organization_id;

  result := public.process_ecpay_payment_notification(
    'MGATEMISMATCH001',
    'evt-migration-mismatch-001',
    'TGMISMATCH001',
    '3002607',
    'test',
    400,
    1,
    'Succeeded',
    FALSE,
    NOW(),
    '{}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES (
    'mismatch_result',
    result ->> 'status' = 'failed' AND result ->> 'reason' = 'amount_mismatch',
    result
  );

  INSERT INTO billing_gate_capture (check_name, passed, value)
  SELECT
    'mismatch_no_activation',
    organization.status = 'suspended'
      AND subscription.status = 'suspended'
      AND payment_order.status = 'failed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.subscription_periods
        WHERE payment_order_id = payment_order.id
      ),
    NULL
  FROM public.organizations AS organization
  JOIN public.subscriptions AS subscription
    ON subscription.org_id = organization.id
  JOIN public.payment_orders AS payment_order
    ON payment_order.org_id = organization.id
  WHERE organization.id = organization_id
    AND payment_order.id = (
      SELECT (value ->> 'id')::UUID
      FROM billing_gate_capture
      WHERE check_name = 'mismatch_order'
    );

  result := public.process_ecpay_payment_notification(
    'MGATEBASIC001',
    'evt-migration-success-001',
    'TGSUCCESS001',
    '3002607',
    'test',
    399,
    1,
    'Succeeded',
    FALSE,
    NOW(),
    '{}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('success_result', result ->> 'status' = 'processed', result);

  result := public.process_ecpay_payment_notification(
    'MGATEBASIC001',
    'evt-migration-success-001',
    'TGSUCCESS001',
    '3002607',
    'test',
    399,
    1,
    'Succeeded',
    FALSE,
    NOW(),
    '{}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('duplicate_same_event', result ->> 'status' = 'duplicate', result);

  result := public.process_ecpay_payment_notification(
    'MGATEBASIC001',
    'evt-migration-success-retry-002',
    'TGSUCCESS001',
    '3002607',
    'test',
    399,
    1,
    'Succeeded',
    FALSE,
    NOW(),
    '{}'::jsonb
  );
  INSERT INTO billing_gate_capture (check_name, passed, value)
  VALUES ('duplicate_new_event', result ->> 'status' = 'duplicate', result);
END
$billing_gate$;

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'wrong_price_rejected'),
  '046 rejects a Basic checkout whose amount is not the server price'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'basic_order'),
  '046 enforces the Basic server price at NT$399'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'growth_order'),
  '046 enforces the Growth server price at NT$699'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'basic_order_retry'),
  '046 reuses the same payment order for a checkout idempotency retry'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'simulated_result'),
  '046 ignores SimulatePaid notifications'
);

SELECT extensions.ok(
  (
    SELECT passed
    FROM billing_gate_capture
    WHERE check_name = 'simulated_no_activation'
  ),
  'SimulatePaid does not activate the workspace or create a paid period'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'mismatch_result'),
  '046 rejects a successful notification whose amount is wrong'
);

SELECT extensions.ok(
  (
    SELECT passed
    FROM billing_gate_capture
    WHERE check_name = 'mismatch_no_activation'
  ),
  'an amount mismatch cannot activate the workspace or create a paid period'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'success_result'),
  '046 processes a valid verified payment'
);

SELECT extensions.ok(
  (
    SELECT organization.status = 'active'
      AND organization.plan = 'basic'
      AND organization.suspension_source IS NULL
      AND subscription.status = 'active'
      AND subscription.plan = 'basic'
      AND subscription.current_period_end > subscription.current_period_start
    FROM public.organizations AS organization
    JOIN public.subscriptions AS subscription
      ON subscription.org_id = organization.id
    WHERE organization.id = '22222222-2222-4222-8222-222222222222'
  ),
  'a valid payment atomically activates the organization and subscription'
);

SELECT extensions.ok(
  (
    SELECT COUNT(*) = 1
    FROM public.subscription_periods
    WHERE payment_order_id = (
      SELECT (value ->> 'id')::UUID
      FROM billing_gate_capture
      WHERE check_name = 'basic_order'
    )
  ),
  'a valid payment creates exactly one subscription period'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'duplicate_same_event'),
  '046 treats a repeated provider event as a duplicate'
);

SELECT extensions.ok(
  (SELECT passed FROM billing_gate_capture WHERE check_name = 'duplicate_new_event'),
  '046 treats a new callback event for an already-paid order as a duplicate'
);

SELECT extensions.ok(
  (
    SELECT COUNT(*) = 1
    FROM public.subscription_periods
    WHERE payment_order_id = (
      SELECT (value ->> 'id')::UUID
      FROM billing_gate_capture
      WHERE check_name = 'basic_order'
    )
  ),
  'provider retries never append another subscription period'
);

SELECT * FROM extensions.finish();

ROLLBACK;
