import type { ReactNode } from 'react';
import { Info, TriangleAlert } from 'lucide-react';

// MOCK: presentation-only banner used by SaaS pages that still render demo data.
// Replace nothing here when wiring real data — keep the banner until the page reads from Supabase.

interface DemoDataBannerProps {
  children?: ReactNode;
  tone?: 'info' | 'warning';
}

export function DemoDataBanner({ children, tone = 'info' }: DemoDataBannerProps) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-cyan-200 bg-cyan-50 text-cyan-900';
  const Icon = tone === 'warning' ? TriangleAlert : Info;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-sm ${toneClass}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="leading-6">
        {children ?? (
          <>
            <span className="font-medium">示意資料</span>
            ：此頁目前顯示 demo 內容，正式資料將於後端串接完成後接入。
          </>
        )}
      </div>
    </div>
  );
}
