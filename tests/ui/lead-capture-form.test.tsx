import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LeadCaptureForm } from '@/components/marketing/lead-capture-form';

describe('LeadCaptureForm', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/signup?utm_source=facebook&utm_campaign=beta');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps manual contact channels available while lead capture is disabled', () => {
    render(
      <LeadCaptureForm
        variant="signup"
        contactEmail="hello@example.com"
        initialPlan="growth"
      />
    );

    expect(screen.queryByRole('button', { name: '送出申請' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '複製申請內容' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '用 Email 寄出' })).toBeInTheDocument();
    expect(screen.getByLabelText('希望方案')).toHaveValue('growth');

    fireEvent.change(screen.getByLabelText('LINE ID'), {
      target: { value: 'demo-store' },
    });
    expect(screen.getByLabelText('優先聯絡方式')).toHaveValue('line');
  });

  it('posts the selected plan, contact data, and whitelisted attribution when enabled', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ success: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <LeadCaptureForm
        variant="signup"
        contactEmail="hello@example.com"
        initialPlan="growth"
        leadCaptureEnabled
      />
    );

    fireEvent.change(screen.getByLabelText(/品牌名稱/), {
      target: { value: 'Demo Store' },
    });
    fireEvent.change(screen.getByLabelText(/聯絡人稱呼/), {
      target: { value: 'Owner' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '送出申請' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      companyName: 'Demo Store',
      contactName: 'Owner',
      email: 'owner@example.com',
      requestedPlan: 'growth',
      monthlyReturnBand: '30_100',
      privacyConsent: true,
      attribution: {
        utmSource: 'facebook',
        utmCampaign: 'beta',
        landingPath: '/signup',
      },
    });
    expect(await screen.findByText('申請已送出。我們會在 1 個工作天內與你聯絡。')).toBeInTheDocument();
  });
});
