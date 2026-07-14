import type { ReactNode } from 'react';
import { LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InternalNavLink } from '@/components/internal/nav-link';
import { signOut } from '@/lib/actions/auth';
import { resolvePlatformAdminFeatureFlags } from '@/lib/saas/platform-admin';

const internalNav = [
  {
    href: '/internal',
    label: '總覽',
    description: '待處理事項與租戶概況',
    iconName: 'layoutDashboard',
    exact: true,
  },
  {
    href: '/internal/orgs',
    label: '租戶管理',
    description: '租戶、方案與狀態',
    iconName: 'building',
  },
  {
    href: '/internal/leads',
    label: '試用申請',
    description: '新名單與聯絡進度',
    iconName: 'inbox',
    requiresLeadCapture: true,
  },
] as const;

export default function InternalLayout({ children }: { children: ReactNode }) {
  const featureFlags = resolvePlatformAdminFeatureFlags();
  const visibleNav = internalNav.filter(
    (item) => !('requiresLeadCapture' in item) || featureFlags.public_lead_capture
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-neutral-950 text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">商業營運後台</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                查看租戶狀態、用量與需跟進事項；不顯示任何客戶的退貨明細。
              </p>
            </div>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" />
              登出並切換至商家帳號
            </Button>
          </form>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="h-fit rounded-lg border bg-white p-3">
          <div className="mb-3 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutDashboard className="size-4" />
            管理選單
          </div>
          <nav className="grid gap-1">
            {visibleNav.map((item) => (
              <InternalNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                description={item.description}
                iconName={item.iconName}
                exact={'exact' in item ? item.exact : undefined}
              />
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
