import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
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
    showEmailWhenUnavailable,
    initialPlan,
    googleSignupHref,
  }: {
    emailEnabled: boolean;
    phoneEnabled: boolean;
    showEmailWhenUnavailable?: boolean;
    initialPlan: string;
    googleSignupHref?: string;
  }) => (
    <div
      data-testid="verified-signup-form"
      data-email-enabled={String(emailEnabled)}
      data-phone-enabled={String(phoneEnabled)}
      data-show-email-when-unavailable={String(showEmailWhenUnavailable)}
      data-plan={initialPlan}
      data-google-signup-href={googleSignupHref}
    >
      {googleSignupHref ? (
        <a href={googleSignupHref} data-testid="google-signup-option">
          <span data-testid="google-sign-in-icon" />
          使用 Google 繼續
        </a>
      ) : null}
    </div>
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

  it('retains the Email/password registration shell with Google below and preserves a growth selection', async () => {
    signupMocks.flags.google_auth = true;
    signupMocks.flags.google_trial_signup = true;

    await renderSignup('growth');

    expect(screen.getByRole('heading', { name: '建立帳號' })).toBeInTheDocument();
    expect(screen.getByText(/任何電子信箱（不限定 Gmail）/)).toBeInTheDocument();
    const verifiedForm = screen.getByTestId('verified-signup-form');
    const googleLink = screen.getByRole('link', { name: '使用 Google 繼續' });
    expect(googleLink).toHaveAttribute('href', '/auth/google?plan=growth');
    expect(within(googleLink).getByTestId('google-sign-in-icon')).toBeInTheDocument();
    expect(verifiedForm).toHaveAttribute('data-email-enabled', 'false');
    expect(verifiedForm).toHaveAttribute('data-phone-enabled', 'false');
    expect(verifiedForm).toHaveAttribute('data-show-email-when-unavailable', 'true');
    expect(
      verifiedForm.compareDocumentPosition(googleLink)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText('或使用 Google 快速註冊')).not.toBeInTheDocument();
    expect(screen.getByTestId('lead-capture-form')).toHaveAttribute('data-plan', 'growth');
    expect(screen.getByTestId('signup-support-details')).not.toHaveAttribute('open');
    expect(screen.queryByText('清楚告訴你接下來 4 步。')).not.toBeInTheDocument();
  });

  it('places verified signup before Google and preserves the selected plan for both paths', async () => {
    signupMocks.flags.google_auth = true;
    signupMocks.flags.google_trial_signup = true;
    signupMocks.verified.emailEnabled = true;
    signupMocks.verified.phoneEnabled = true;
    signupMocks.verified.turnstileSiteKey = 'site-key';

    await renderSignup('growth');

    const verifiedForm = screen.getByTestId('verified-signup-form');
    const googleLink = screen.getByRole('link', { name: '使用 Google 繼續' });

    expect(screen.getByText(/先完成手機號碼或電子信箱驗證/))
      .toBeInTheDocument();
    expect(verifiedForm).toHaveAttribute('data-plan', 'growth');
    expect(verifiedForm).toHaveAttribute('data-show-email-when-unavailable', 'false');
    expect(googleLink).toHaveAttribute('href', '/auth/google?plan=growth');
    expect(
      verifiedForm.compareDocumentPosition(googleLink)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(googleLink).getByTestId('google-sign-in-icon')).toBeInTheDocument();
  });

  it('renders only the enabled Email verification channel', async () => {
    signupMocks.verified.emailEnabled = true;
    signupMocks.verified.turnstileSiteKey = 'site-key';

    await renderSignup('basic');

    expect(screen.getByText(/先完成電子信箱驗證/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 繼續' }))
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

    expect(screen.getByText(/手機驗證註冊目前可用；電子信箱註冊準備中/))
      .toBeInTheDocument();
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-email-enabled', 'false');
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-phone-enabled', 'true');
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-show-email-when-unavailable', 'true');
    expect(screen.getByTestId('verified-signup-form')).toHaveAttribute('data-plan', 'growth');
  });

  it('falls back to the application flow when every self-service method is closed', async () => {
    await renderSignup();

    expect(screen.getByRole('heading', { name: '建立帳號' })).toBeInTheDocument();
    expect(screen.getByText('請先送出申請。')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 繼續' }))
      .not.toBeInTheDocument();
    expect(screen.getByTestId('verified-signup-form'))
      .toHaveAttribute('data-show-email-when-unavailable', 'true');
    expect(screen.getByTestId('verified-signup-form'))
      .not.toHaveAttribute('data-google-signup-href');
    expect(screen.getByText(/信箱驗證啟用前，請先留下申請資料/)).toBeInTheDocument();
    expect(screen.getByTestId('lead-capture-form')).toBeInTheDocument();
  });
});
