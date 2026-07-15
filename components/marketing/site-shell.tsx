import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, PackageCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { legalNavItems, publicNavItems } from '@/components/marketing/commercial-data';
import { MarketingMobileNav } from '@/components/marketing/mobile-nav';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1">
            <MarketingMobileNav
              publicNavItems={publicNavItems}
              legalNavItems={legalNavItems}
            />
            <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md pr-2 text-sm font-semibold">
              <span className="flex size-9 items-center justify-center rounded-md bg-neutral-950 text-white">
                <PackageCheck className="size-5" />
              </span>
              <span>Smart Return</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="主要導覽">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden h-11 sm:inline-flex">
              <Link href="/login">登入</Link>
            </Button>
            <Button asChild size="sm" className="h-11">
              <Link href="/signup">
                免費試用 3 天
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-16 md:pb-0">{children}</main>

      <footer className="border-t border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-8 items-center justify-center rounded-md bg-white text-neutral-950">
                <PackageCheck className="size-4" />
              </span>
              Smart Return
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-neutral-300">
              專為台灣電商品牌設計的退貨管理系統。把蝦皮、官網、momo
              的退貨集中處理，客服、倉庫、營運看同一份資料。
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold">網站</div>
            <div className="mt-3 grid">
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold">法務</div>
            <div className="mt-3 grid">
              {legalNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-neutral-400">
          Copyright 2026 Smart Return. All rights reserved.
        </div>
      </footer>

      {/* Sticky mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Button asChild className="h-11 flex-1">
            <Link href="/signup">
              免費試用 3 天
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="default" className="h-11">
            <Link href="/contact">Demo</Link>
          </Button>
        </div>
      </div>
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
