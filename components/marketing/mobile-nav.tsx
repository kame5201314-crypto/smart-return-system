'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface NavItem {
  label: string;
  href: string;
}

interface MarketingMobileNavProps {
  publicNavItems: ReadonlyArray<NavItem>;
  legalNavItems: ReadonlyArray<NavItem>;
}

export function MarketingMobileNav({
  publicNavItems,
  legalNavItems,
}: MarketingMobileNavProps) {
  const [open, setOpen] = useState(false);

  function handleNavigate() {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="開啟導覽選單"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 sm:w-80">
        <SheetHeader>
          <SheetTitle>導覽</SheetTitle>
        </SheetHeader>

        <nav className="mt-6 grid gap-1" aria-label="主要導覽">
          {publicNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigate}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 border-t border-neutral-200 pt-6">
          <div className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            法務
          </div>
          <nav className="mt-2 grid gap-1" aria-label="法務文件">
            {legalNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigate}
                className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-6">
          <Link
            href="/login"
            onClick={handleNavigate}
            className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
          >
            登入
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
