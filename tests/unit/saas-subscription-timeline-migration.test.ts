import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/050_saas_subscription_timeline_consistency.sql'),
  'utf8'
);

describe('SaaS subscription timeline consistency migration', () => {
  it('keeps an early renewal from moving the entitlement start into the future', () => {
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.keep_current_subscription_period_start()'
    );
    expect(source).toContain("NEW.status = 'active'");
    expect(source).toContain('NEW.current_period_start > NOW()');
    expect(source).toContain('period.period_start <= NOW()');
    expect(source).toContain('period.period_end > NOW()');
    expect(source).toContain('NEW.current_period_start := covering_period_start');
  });

  it('contains a bounded backfill and keeps the trigger service-role only', () => {
    expect(source).toContain('subscription.current_period_start > NOW()');
    expect(source).toContain('corrected.covering_period_start IS NOT NULL');
    expect(source).toContain(
      'BEFORE INSERT OR UPDATE OF status, current_period_start, current_period_end'
    );
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.keep_current_subscription_period_start()'
    );
    expect(source).toContain('TO service_role');
  });
});
