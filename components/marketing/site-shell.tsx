import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, PackageCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { legalNavItems, publicNavItems } from '@/components/marketing/commercial-data';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-9 items-center justify-center rounded-md bg-neutral-950 text-white">
              <PackageCheck className="size-5" />
            </span>
            <span>Smart Return SaaS</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="主要導覽">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">登入</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">
                申請試用
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-8 items-center justify-center rounded-md bg-white text-neutral-950">
                <PackageCheck className="size-4" />
              </span>
              Smart Return SaaS
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-neutral-300">
              面向台灣電商品牌的退貨管理 SaaS，協助客服、倉庫與營運團隊集中處理退貨、AI 分析與帳務控管。
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold">網站</div>
            <div className="mt-3 grid gap-2">
              {publicNavItems.map((item) => (
                <Link key={item.href} href={item.href} className="text-sm text-neutral-300 hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold">法務</div>
            <div className="mt-3 grid gap-2">
              {legalNavItems.map((item) => (
                <Link key={item.href} href={item.href} className="text-sm text-neutral-300 hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-neutral-400">
          Copyright 2026 Smart Return System. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-emerald-700">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-neutral-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-neutral-600">{description}</p>
      </div>
    </section>
  );
}
