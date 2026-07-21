import type { ReactNode } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InternalNavLink } from '@/components/internal/nav-link';
import { leavePlatformAdmin } from '@/lib/actions/auth';

const internalNav = [
  {
    href: '/internal',
    label: '總覽',
    iconName: 'layoutDashboard',
    exact: true,
  },
  {
    href: '/internal/orgs',
    label: '租戶管理',
    iconName: 'building',
  },
] as const;

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-neutral-950 text-white">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <p className="text-lg font-semibold">商業營運後台</p>
          </div>
          <form action={leavePlatformAdmin}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">離開管理後台</span>
              <span className="sm:hidden">離開</span>
            </Button>
          </form>
        </div>
        <div className="border-t">
          <nav
            className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8"
            aria-label="商業營運後台選單"
          >
            {internalNav.map((item) => (
              <InternalNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                iconName={item.iconName}
                exact={'exact' in item ? item.exact : undefined}
                variant="tab"
              />
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
