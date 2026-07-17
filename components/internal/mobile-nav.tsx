'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  InternalNavLink,
  type InternalIconName,
} from '@/components/internal/nav-link';

interface MobileNavItem {
  href: string;
  label: string;
  description: string;
  iconName: InternalIconName;
  exact?: boolean;
}

function isItemActive(pathname: string, item: MobileNavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function InternalMobileNav({ items }: { items: readonly MobileNavItem[] }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const activeItem = items.find((item) => isItemActive(pathname, item));

  return (
    <div className="rounded-lg border bg-white p-3 lg:hidden">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between"
        aria-expanded={open}
        aria-controls="internal-mobile-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
          管理選單
          {activeItem ? <span className="text-muted-foreground">· {activeItem.label}</span> : null}
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Button>
      {open ? (
        <nav id="internal-mobile-navigation" className="mt-2 grid gap-1 border-t pt-2" aria-label="商業營運後台行動版選單">
          {items.map((item) => (
            <InternalNavLink key={item.href} {...item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>
      ) : null}
    </div>
  );
}
