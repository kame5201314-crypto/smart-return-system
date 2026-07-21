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
  description?: string;
  iconName: InternalIconName;
  exact?: boolean;
  onNavigate?: () => void;
  variant?: 'menu' | 'tab';
}

export function InternalNavLink({
  href,
  label,
  description,
  iconName,
  exact,
  onNavigate,
  variant = 'menu',
}: InternalNavLinkProps) {
  const pathname = usePathname() ?? '';
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  const Icon = ICON_MAP[iconName];

  if (variant === 'tab') {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
          isActive
            ? 'border-neutral-950 text-neutral-950'
            : 'border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-950'
        }`}
      >
        <Icon className={`size-4 ${isActive ? 'text-emerald-700' : 'text-neutral-500'}`} aria-hidden="true" />
        {label}
      </Link>
    );
  }

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
      {description ? (
        <span
          className={`mt-1 block text-xs ${
            isActive ? 'text-neutral-300' : 'text-muted-foreground'
          }`}
        >
          {description}
        </span>
      ) : null}
    </Link>
  );
}
