'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, FileClock, Inbox, LayoutDashboard } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type InternalIconName = 'building' | 'fileClock' | 'inbox' | 'layoutDashboard';

const ICON_MAP: Record<InternalIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  building: Building2,
  fileClock: FileClock,
  inbox: Inbox,
  layoutDashboard: LayoutDashboard,
};

export interface InternalNavLinkProps {
  href: string;
  label: string;
  description: string;
  iconName: InternalIconName;
  exact?: boolean;
  onNavigate?: () => void;
}

export function InternalNavLink({ href, label, description, iconName, exact, onNavigate }: InternalNavLinkProps) {
  const pathname = usePathname() ?? '';
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  const Icon = ICON_MAP[iconName];

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? 'bg-neutral-950 text-white'
          : 'text-neutral-900 hover:bg-neutral-100'
      }`}
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon
          className={`size-4 ${isActive ? 'text-emerald-300' : 'text-emerald-700'}`}
          aria-hidden="true"
        />
        {label}
      </span>
      <span
        className={`mt-1 block text-xs ${
          isActive ? 'text-neutral-300' : 'text-muted-foreground'
        }`}
      >
        {description}
      </span>
    </Link>
  );
}
