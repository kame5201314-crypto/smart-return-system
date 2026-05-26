import Link from 'next/link';
import { Building2, FileClock, LayoutDashboard, ShieldCheck } from 'lucide-react';

import { loadPlatformAdminModeView } from '@/lib/saas/platform-admin-mode';

const ROLE_LABEL = {
  owner: 'Owner',
  support: 'Support',
  billing: 'Billing',
} as const;

export async function PlatformAdminModeIndicator() {
  const view = await loadPlatformAdminModeView();

  if (view.state === 'hidden') {
    return null;
  }

  const roleLabel = ROLE_LABEL[view.platformRole];

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/95 px-3 py-2 text-xs text-white shadow-lg backdrop-blur">
        <ShieldCheck
          className="size-4 shrink-0 text-emerald-400"
          aria-hidden="true"
        />
        <span className="font-semibold whitespace-nowrap">Platform Admin</span>
        <span className="hidden text-neutral-500 sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="hidden text-neutral-300 sm:inline">{roleLabel}</span>
        {view.userEmail ? (
          <>
            <span
              className="hidden text-neutral-500 md:inline"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="hidden max-w-[220px] truncate text-neutral-400 md:inline">
              {view.userEmail}
            </span>
          </>
        ) : null}
        {view.internalEnabled ? (
          <div className="ml-1 flex items-center gap-1 border-l border-neutral-800 pl-2">
            <Link
              href={view.links.dashboard}
              className="rounded-full p-1.5 transition-colors hover:bg-neutral-800"
              title="平台總覽"
              aria-label="平台總覽"
            >
              <LayoutDashboard className="size-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={view.links.organizations}
              className="rounded-full p-1.5 transition-colors hover:bg-neutral-800"
              title="所有租戶"
              aria-label="所有租戶"
            >
              <Building2 className="size-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={view.links.billingEvents}
              className="rounded-full p-1.5 transition-colors hover:bg-neutral-800"
              title="金流事件"
              aria-label="金流事件"
            >
              <FileClock className="size-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={view.links.dashboard}
              className="ml-1 rounded-full bg-emerald-500 px-3 py-1 font-medium text-neutral-950 transition-colors hover:bg-emerald-400"
            >
              平台後台
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
