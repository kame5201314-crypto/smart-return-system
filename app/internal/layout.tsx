import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, Building2, FileClock, LayoutDashboard, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const internalNav = [
  {
    href: '/internal/orgs',
    label: 'Organizations',
    description: '租戶、方案與狀態',
    icon: Building2,
  },
  {
    href: '/internal/billing/events',
    label: 'Billing Events',
    description: '金流事件與重送檢查',
    icon: FileClock,
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
                <Badge variant="outline">SaaS only</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                商業版平台管理骨架，正式資料寫入需等 service role route 與 SaaS RLS 通過後再開啟。
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <ArrowLeft className="size-4" />
              返回商家設定
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
            {internalNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm transition-colors hover:bg-neutral-100"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4 text-emerald-700" />
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
