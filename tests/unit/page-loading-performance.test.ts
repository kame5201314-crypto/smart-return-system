import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('page-loading performance contracts', () => {
  it('loads the Supabase browser SDK only after a verified signup action starts', () => {
    const source = readProjectFile('components/auth/verified-signup-form.tsx');

    expect(source).not.toContain("import { createClient } from '@/lib/supabase/client'");
    expect(source).toContain("await import('@/lib/supabase/client')");
    expect(source).toContain('await createVerifiedSignupClient()');
  });

  it('loads optional Auth providers only when their flows need them', () => {
    const loginSource = readProjectFile('components/auth/login-page-content.tsx');
    const signupSource = readProjectFile('components/auth/verified-signup-form.tsx');
    const recoverySource = readProjectFile('components/auth/password-recovery-form.tsx');
    const turnstileSource = readProjectFile('components/auth/auth-turnstile.tsx');

    for (const source of [loginSource, signupSource, recoverySource]) {
      expect(source).not.toContain("from '@marsidev/react-turnstile'");
      expect(source).toContain("from '@/components/auth/auth-turnstile'");
    }

    expect(turnstileSource).toContain("import dynamic from 'next/dynamic'");
    expect(turnstileSource).toContain("import('@marsidev/react-turnstile')");
    expect(turnstileSource).toContain('ssr: false');
    expect(recoverySource).not.toContain(
      "import { createClient } from '@/lib/supabase/client'"
    );
    expect(recoverySource).toContain("await import('@/lib/supabase/client')");
    expect(recoverySource).toContain('await createPasswordRecoveryClient()');
  });

  it('keeps Recharts out of the analytics page entry bundle', () => {
    const pageSource = readProjectFile('app/(admin)/analytics/page.tsx');
    const chartSource = readProjectFile('components/analytics/return-analytics-charts.tsx');

    expect(pageSource).not.toContain("from 'recharts'");
    expect(pageSource).toContain("import dynamic from 'next/dynamic'");
    expect(pageSource).toContain("import('@/components/analytics/return-analytics-charts')");
    expect(chartSource).toContain("from 'recharts'");
  });

  it('settles both analytics data requests before the first completed render', () => {
    const source = readProjectFile('app/(admin)/analytics/page.tsx');

    expect(source).toContain('await Promise.allSettled([');
    expect(source).toContain('getReturnRequests()');
    expect(source).toContain('getShopeeReturns()');
    expect(source.indexOf('setLoading(false)')).toBeGreaterThan(
      source.indexOf('await Promise.allSettled([')
    );
  });
});
