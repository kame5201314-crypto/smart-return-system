import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signupMocks = vi.hoisted(() => ({
  verified: {
    emailEnabled: false,
    phoneEnabled: false,
    turnstileSiteKey: '',
  },
}));

vi.mock('@/lib/auth/verified-signup', () => ({
  resolveVerifiedSignupAvailability: () => signupMocks.verified,
  normalizeEmailIdentifier: (value: string) => value.trim().toLowerCase(),
  normalizeTaiwanPhoneIdentifier: (value: string) => value,
}));

vi.mock('@/components/auth/verified-signup-form', () => ({
  VerifiedSignupForm: ({
    emailEnabled,
    phoneEnabled,
    showEmailWhenUnavailable,
    initialVerification,
    initialPlan,
    turnstileSiteKey,
  }: {
    emailEnabled: boolean;
    phoneEnabled: boolean;
    showEmailWhenUnavailable?: boolean;
    initialVerification?: { channel: string; identifier: string };
    initialPlan: string;
    turnstileSiteKey: string;
  }) => (
    <div
      data-testid="verified-signup-form"
      data-email-enabled={String(emailEnabled)}
      data-phone-enabled={String(phoneEnabled)}
      data-show-email-when-unavailable={String(showEmailWhenUnavailable)}
      data-initial-verification={initialVerification
        ? `${initialVerification.channel}:${initialVerification.identifier}`
        : ''}
      data-plan={initialPlan}
      data-turnstile-site-key={turnstileSiteKey}
    />
  ),
}));

import SignupPage from '@/app/signup/page';

async function renderSignup(params: {
  plan?: string;
  verify?: string;
  identifier?: string;
} = {}) {
  const searchParams = Promise.resolve(params);
  render(await SignupPage({ searchParams }));
}

describe('SignupPage', () => {
  beforeEach(() => {
    signupMocks.verified.emailEnabled = false;
    signupMocks.verified.phoneEnabled = false;
    signupMocks.verified.turnstileSiteKey = '';
  });

  afterEach(() => cleanup());

  it('renders only the requested account-registration form and preserves the selected plan', async () => {
    await renderSignup({ plan: 'growth' });

    expect(screen.getByRole('heading', { name: '建立帳號' })).toBeInTheDocument();
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-plan', 'growth');
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-show-email-when-unavailable', 'true');
    expect(screen.queryByText(/Beta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/準備中/)).not.toBeInTheDocument();
    expect(screen.queryByText(/申請資料/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('lead-capture-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('signup-support-details')).not.toBeInTheDocument();
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
  });

  it('passes the live Email, phone, and CAPTCHA availability into the same form', async () => {
    signupMocks.verified.emailEnabled = true;
    signupMocks.verified.phoneEnabled = true;
    signupMocks.verified.turnstileSiteKey = 'site-key';

    await renderSignup({ plan: 'basic' });

    const form = screen.getByTestId('verified-signup-form');
    expect(form).toHaveAttribute('data-email-enabled', 'true');
    expect(form).toHaveAttribute('data-phone-enabled', 'true');
    expect(form).toHaveAttribute('data-turnstile-site-key', 'site-key');
  });

  it('opens the durable Email verification step for an unconfirmed login', async () => {
    signupMocks.verified.emailEnabled = true;
    signupMocks.verified.turnstileSiteKey = 'site-key';

    await renderSignup({
      verify: 'email',
      identifier: ' Pending@Example.com ',
    });

    expect(screen.getByRole('heading', { name: '完成帳號驗證' })).toBeInTheDocument();
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-initial-verification', 'email:pending@example.com');
  });

  it('falls back unsupported plan values to Basic without changing the registration layout', async () => {
    await renderSignup({ plan: 'unsupported' });

    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-plan', 'basic');
    expect(screen.getByRole('heading', { name: '建立帳號' })).toBeInTheDocument();
  });
});
