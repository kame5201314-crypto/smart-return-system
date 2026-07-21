import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MarketingShell } from '@/components/marketing/site-shell';

describe('MarketingShell product name', () => {
  afterEach(cleanup);

  it('uses the unified product name in the public header and footer', () => {
    render(
      <MarketingShell>
        <div>頁面內容</div>
      </MarketingShell>
    );

    expect(screen.getAllByText('AI退貨管理系統')).toHaveLength(2);
    expect(screen.getByText(/Copyright 2026 AI退貨管理系統/)).toBeInTheDocument();
    expect(screen.queryByText('Smart Return')).not.toBeInTheDocument();
  });
});
