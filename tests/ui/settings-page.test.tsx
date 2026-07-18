import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/saas/org-context', () => ({
  getOrgContext: () => Promise.resolve({ role: 'owner' }),
}));

import SettingsPage from '@/app/(admin)/settings/page';

describe('SettingsPage', () => {
  afterEach(() => cleanup());

  it('keeps advanced usage and team settings hidden from the settings hub', async () => {
    render(await SettingsPage());

    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
    expect(screen.getByText('帳務與訂閱')).toBeInTheDocument();
    expect(screen.getByText('資料與備份')).toBeInTheDocument();
    expect(screen.queryByText('用量與額度')).not.toBeInTheDocument();
    expect(screen.queryByText('團隊與角色')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /用量與額度/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /團隊與角色/ })).not.toBeInTheDocument();
  });
});
