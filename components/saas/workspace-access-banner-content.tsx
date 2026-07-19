'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { WorkspaceAccessNotice } from '@/lib/saas/workspace-access-notice';

export function WorkspaceAccessBannerContent({ notice }: { notice: WorkspaceAccessNotice }) {
  const pathname = usePathname();

  if (pathname === '/settings/billing' || pathname.startsWith('/settings/billing/')) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-semibold">{notice.title}</p>
            <p className="mt-0.5 text-sm text-amber-900">{notice.message}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="w-fit shrink-0 bg-white">
          <Link href="/settings/billing#plans">升級方案</Link>
        </Button>
      </div>
    </div>
  );
}
