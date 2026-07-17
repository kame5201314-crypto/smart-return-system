import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UsageProgress } from '@/components/saas/usage-progress';

describe('UsageProgress', () => {
  afterEach(cleanup);

  it('exposes exact usage context to assistive technology', () => {
    render(
      <UsageProgress
        value={80}
        aria-label="測試租戶 AI 額度使用率"
        aria-valuetext="已使用 4 / 5，80%"
      />
    );

    expect(screen.getByRole('progressbar', { name: '測試租戶 AI 額度使用率' }))
      .toHaveAttribute('aria-valuetext', '已使用 4 / 5，80%');
  });
});
