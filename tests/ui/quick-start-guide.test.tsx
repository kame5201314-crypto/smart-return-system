import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuickStartGuide } from '@/components/saas/quick-start-guide';

describe('QuickStartGuide', () => {
  it('provides three direct actions for a new merchant', () => {
    render(<QuickStartGuide />);

    expect(screen.getByRole('heading', { name: '3 步開始使用 AI 退貨系統' }))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: /建立第一筆退貨/ }))
      .toHaveAttribute('href', '/returns');
    expect(screen.getByRole('link', { name: /匯入蝦皮退貨資料/ }))
      .toHaveAttribute('href', '/shopee-returns');
    expect(screen.getByRole('link', { name: /查看 AI 分析/ }))
      .toHaveAttribute('href', '/analytics/ai-report');
  });
});
