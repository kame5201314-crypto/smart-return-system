import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getOrgContext } from '@/lib/saas/org-context';
import {
  buildWorkspaceAccessNotice,
  type WorkspaceAccessNotice,
} from '@/lib/saas/workspace-access-notice';
import { createClient } from '@/lib/supabase/server';

async function loadWorkspaceAccessNotice(): Promise<WorkspaceAccessNotice | null> {
  try {
    const context = await getOrgContext();
    if (context.orgStatus !== 'suspended') {
      return buildWorkspaceAccessNotice({
        status: context.orgStatus,
      });
    }

    const client = await createClient();
    const { data } = await client
      .from('subscriptions')
      .select('trial_end')
      .eq('org_id', context.orgId)
      .maybeSingle();
    const row = data as unknown as { trial_end?: unknown } | null;
    const trialEnd = row && typeof row.trial_end === 'string' ? row.trial_end : null;
    return buildWorkspaceAccessNotice({
      status: context.orgStatus,
      trialEnd,
    });
  } catch {
    return null;
  }
}

export async function WorkspaceAccessBanner() {
  const notice = await loadWorkspaceAccessNotice();
  if (!notice) return null;

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
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="bg-white">
            <Link href="/pricing" target="_blank">升級方案</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/contact">聯絡客服</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
