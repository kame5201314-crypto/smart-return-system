import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, LayoutDashboard, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InternalNavLink } from '@/components/internal/nav-link';

const internalNav = [
  {
    href: '/internal',
    label: 'Dashboard',
    description: 'MRR、試用追蹤、需關注事項',
    iconName: 'layoutDashboard',
    exact: true,
  },
  {
    href: '/internal/orgs',
    label: 'Organizations',
    description: '租戶、方案與狀態',
    iconName: 'building',
  },
  {
    href: '/internal/billing/events',
    label: 'Billing Events',
    description: '金流事件與重送檢查',
    iconName: 'fileClock',
  },
] as const;

export default function InternalLayout({ children }: { children: ReactNode }) {
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
                <h1 className="text-lg font-semibold">Platform Admin</h1>
                <Badge variant="outline">SaaS 營運專用</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                查看所有租戶的訂閱、用量、健康度與金流事件；不顯示任何客戶的退貨資料明細。
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/analytics">
              <ArrowLeft className="size-4" />
              切換到商家工作台
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="h-fit rounded-lg border bg-white p-3">
          <div className="mb-3 flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutDashboard className="size-4" />
            Internal Console
          </div>
          <nav className="grid gap-1">
            {internalNav.map((item) => (
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
