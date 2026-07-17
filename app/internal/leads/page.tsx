import { redirect } from 'next/navigation';

import {
  PlatformLeadsEmptyState,
  PlatformLeadsList,
} from '@/components/internal/platform-leads-list';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
} from '@/lib/saas/platform-admin';
import {
  createDefaultPlatformLeadRepository,
  PlatformLeadManagementError,
  type PlatformLeadRecord,
} from '@/lib/saas/platform-lead-management';

type LeadsPageResult =
  | { state: 'disabled' }
  | { state: 'ready'; leads: PlatformLeadRecord[] }
  | { state: 'gated'; message: string }
  | { state: 'error'; message: string };

async function loadLeadsPage(): Promise<LeadsPageResult> {
  try {
    const access = await requirePlatformAdminAccess({ requiredPermission: 'view_leads' });
    if (!access.featureFlags.public_lead_capture) {
      return { state: 'disabled' };
    }

    const leads = await createDefaultPlatformLeadRepository().listLeads();
    return { state: 'ready', leads };
  } catch (error) {
    if (error instanceof PlatformAdminAccessError && error.code === 'unauthenticated') {
      redirect('/admin/login?next=%2Finternal%2Fleads');
    }
    const message = error instanceof Error ? error.message : '試用申請載入失敗。';
    const gated = error instanceof PlatformAdminAccessError || error instanceof PlatformLeadManagementError;
    return { state: gated ? 'gated' : 'error', message };
  }
}

export default async function InternalLeadsPage() {
  const result = await loadLeadsPage();
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">試用申請</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          依新申請、已聯絡與人工開通進度管理名單；不會自動建立帳號或租戶。
        </p>
      </header>
      {result.state === 'disabled' ? (
        <SettingsStateCard
          variant="gated"
          gated={{ reason: 'feature_disabled', message: '名單功能尚未啟用，目前仍使用 LINE、複製內容或 Email 人工收件。' }}
        />
      ) : result.state === 'ready' ? (
        result.leads.length > 0 ? (
          <PlatformLeadsList leads={result.leads} />
        ) : (
          <PlatformLeadsEmptyState />
        )
      ) : result.state === 'gated' ? (
        <SettingsStateCard variant="gated" gated={{ reason: 'role_required', message: result.message }} />
      ) : (
        <SettingsStateCard variant="error" message={result.message} />
      )}
    </div>
  );
}
