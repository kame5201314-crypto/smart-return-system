import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrgOperationsNoteForm } from '@/components/internal/org-operations-note-form';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('OrgOperationsNoteForm', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    refresh.mockReset();
  });

  it('submits a structured customer follow-up record', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OrgOperationsNoteForm orgId="11111111-1111-4111-8111-111111111111" orgName="測試租戶" />);
    fireEvent.click(screen.getByRole('button', { name: '新增營運紀錄' }));
    fireEvent.change(screen.getByLabelText('紀錄類型'), { target: { value: 'follow_up' } });
    fireEvent.change(screen.getByLabelText('紀錄內容'), { target: { value: '下週確認成長版方案' } });
    fireEvent.change(screen.getByLabelText('下次跟進時間（選填）'), { target: { value: '2026-07-20T10:30' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      noteType: 'follow_up',
      note: '下週確認成長版方案',
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
