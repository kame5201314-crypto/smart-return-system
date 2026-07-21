import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ManualBetaOrgForm } from '@/components/internal/manual-beta-org-form';

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMocks,
}));

function input(id: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!element) throw new Error(`Missing input #${id}`);
  return element;
}

function openForm() {
  render(<ManualBetaOrgForm />);
  fireEvent.click(screen.getByRole('button', { name: '手動開通' }));
}

describe('ManualBetaOrgForm', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    navigationMocks.push.mockReset();
  });

  it('keeps the generated slug in sync until an operator edits it', () => {
    openForm();

    fireEvent.change(input('manual-beta-org-name'), { target: { value: 'Demo Store' } });
    expect(input('manual-beta-slug')).toHaveValue('demo-store');

    fireEvent.change(input('manual-beta-org-name'), { target: { value: 'Demo Store Taiwan' } });
    expect(input('manual-beta-slug')).toHaveValue('demo-store-taiwan');

    fireEvent.change(input('manual-beta-slug'), { target: { value: 'custom-store' } });
    fireEvent.change(input('manual-beta-org-name'), { target: { value: 'Renamed Store' } });
    expect(input('manual-beta-slug')).toHaveValue('custom-store');
  });

  it('navigates to the organization detail and resets slug tracking after provisioning', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({
        success: true,
        data: { orgId: 'org/one' },
      }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    openForm();

    fireEvent.change(input('manual-beta-org-name'), { target: { value: 'Demo Store' } });
    fireEvent.change(input('manual-beta-slug'), { target: { value: 'custom-store' } });
    fireEvent.change(input('manual-beta-owner-email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(input('manual-beta-trial-end'), { target: { value: '2026-06-04' } });
    fireEvent.click(screen.getByRole('button', { name: '建立租戶' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      slug: 'custom-store',
      trialEnd: '2026-06-04',
    });
    await waitFor(() => {
      expect(navigationMocks.push).toHaveBeenCalledWith('/internal/orgs/org%2Fone');
    });

    fireEvent.click(screen.getByRole('button', { name: '手動開通' }));
    fireEvent.change(input('manual-beta-org-name'), { target: { value: 'Next Store' } });
    expect(input('manual-beta-slug')).toHaveValue('next-store');
  });

  it('does not navigate when a successful response omits the organization id', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    openForm();

    fireEvent.change(input('manual-beta-org-name'), { target: { value: 'Demo Store' } });
    fireEvent.change(input('manual-beta-owner-email'), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '建立租戶' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '建立租戶' })).not.toBeDisabled();
    });
    expect(navigationMocks.push).not.toHaveBeenCalled();
  });
});
