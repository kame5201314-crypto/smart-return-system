import { BackupSettingsClient } from '@/components/saas/backup-settings-client';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { getOrgContext, SaaSOrgContextError } from '@/lib/saas/org-context';
import type { GatedState } from '@/lib/saas/ui-backend-contracts';

function mapBackupAccessError(error: SaaSOrgContextError): GatedState {
  if (error.code === 'subscription_inactive') {
    return {
      reason: 'billing_required',
      message: error.message,
    };
  }

  return {
    reason: 'role_required',
    message: error.message,
  };
}

async function loadBackupAccess(): Promise<
  | { allowed: true }
  | { allowed: false; variant: 'gated'; gated: GatedState }
  | { allowed: false; variant: 'error'; message: string }
> {
  try {
    await getOrgContext({
      requirements: {
        roles: ['owner', 'admin'],
        exportable: true,
      },
    });

    return { allowed: true };
  } catch (error) {
    if (error instanceof SaaSOrgContextError) {
      return {
        allowed: false,
        variant: 'gated',
        gated: mapBackupAccessError(error),
      };
    }

    return {
      allowed: false,
      variant: 'error',
      message: error instanceof Error ? error.message : '資料備份權限檢查失敗',
    };
  }
}

export default async function BackupPage() {
  const access = await loadBackupAccess();

  if (access.allowed) {
    return <BackupSettingsClient />;
  }

  if (access.variant === 'gated') {
    return <SettingsStateCard variant="gated" gated={access.gated} />;
  }

  return <SettingsStateCard variant="error" message={access.message} />;
}
