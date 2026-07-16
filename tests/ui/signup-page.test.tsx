import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signupMocks = vi.hoisted(() => ({
  flags: {
    google_auth: false,
    google_trial_signup: false,
    public_lead_capture: true,
  },
  verified: {
    emailEnabled: false,
    phoneEnabled: false,
    turnstileSiteKey: '',
  },
}));

vi.mock('@/lib/config/feature-flags', () => ({
  resolveSaaSFeatureFlags: () => signupMocks.flags,
}));

vi.mock('@/lib/auth/verified-signup', () => ({
  resolveVerifiedSignupAvailability: () => signupMocks.verified,
}));

vi.mock('@/lib/saas/public-signup', () => ({
  resolveSaaSPublicSignupState: () => ({
    statusLabel: '封閉測試',
    headline: '目前採申請制',
    description: '請先送出申請。',
  }),
}));

vi.mock('@/components/auth/verified-signup-form', () => ({
  VerifiedSignupForm: ({
    emailEnabled,
    phoneEnabled,
    initialPlan,
  }: {
    emailEnabled: boolean;
    phoneEnabled: boolean;
    initialPlan: string;
  }) => (
    <div
      data-testid="verified-signup-form"
      data-email-enabled={String(emailEnabled)}
      data-phone-enabled={String(phoneEnabled)}
      data-plan={initialPlan}
    />
  ),
}));

vi.mock('@/components/marketing/lead-capture-form', () => ({
  LeadCaptureForm: ({ initialPlan }: { initialPlan: string }) => (
    <div data-testid="lead-capture-form" data-plan={initialPlan} />
  ),
}));

import SignupPage from '@/app/signup/page';

async function renderSignup(plan?: string) {
  const searchParams = plan ? Promise.resolve({ plan }) : Promise.resolve({});
  render(await SignupPage({ searchParams }));
}

describe('SignupPage feature composition', () => {
  beforeEach(() => {
    signupMocks.flags.google_auth = false;
    signupMocks.flags.google_trial_signup = false;
    signupMocks.flags.public_lead_capture = true;
    signupMocks.verified.emailEnabled = false;
    signupMocks.verified.phoneEnabled = false;
    signupMocks.verified.turnstileSiteKey = '';
  });

  afterEach(() => cleanup());

  it('renders Google-only registration and preserves a growth selection', async () => {
    signupMocks.flags.google_auth = true;
    signupMocks.flags.google_trial_signup = true;

    await renderSignup('growth');

    expect(screen.getByRole('heading', { name: '建立帳號' })).toBeInTheDocument();
    expect(screen.getByText(/使用 Google 完成註冊/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '使用 Google 註冊或登入' }))
      .toHaveAttribute('href', '/auth/google?plan=growth');
    expect(screen.queryByTestId('verified-signup-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('lead-capture-form')).toHaveAttribute('data-plan', 'growth');
    expect(screen.getByTestId('signup-support-details')).not.toHaveAttribute('open');
    expect(screen.queryByText('清楚告訴你接下來 4 步。')).not.toBeInTheDocument();
  });

  it('renders only the enabled Email verification channel', async () => {
    signupMocks.verified.emailEnabled = true;
    signupMocks.verified.turnstileSiteKey = 'site-key';

    await renderSignup('basic');

    expect(screen.getByText(/使用 電子信箱驗證碼 完成註冊/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 註冊或登入' }))
      .not.toBeInTheDocument();
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-email-enabled', 'true');
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-phone-enabled', 'false');
  });

  it('renders only the enabled Taiwan phone verification channel', async () => {
    signupMocks.verified.phoneEnabled = true;
    signupMocks.verified.turnstileSiteKey = 'site-key';

    await renderSignup('growth');

    expect(screen.getByText(/使用 台灣手機驗證碼 完成註冊/)).toBeInTheDocument();
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-email-enabled', 'false');
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-phone-enabled', 'true');
    expect(screen.getByTestId('verified-signup-form')).toHaveAttribute('data-plan', 'growth');
  });

  it('falls back to the application flow when every self-service method is closed', async () => {
    await renderSignup();

    expect(screen.getByRole('heading', { name: '建立帳號' })).toBeInTheDocument();
    expect(screen.getByText('請先送出申請。')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 註冊或登入' }))
      .not.toBeInTheDocument();
    expect(screen.queryByTestId('verified-signup-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('lead-capture-form')).toBeInTheDocument();
  });
});
