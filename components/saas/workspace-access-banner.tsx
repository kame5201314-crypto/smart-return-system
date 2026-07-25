import { WorkspaceAccessBannerContent } from '@/components/saas/workspace-access-banner-content';
import { getOrgContext } from '@/lib/saas/org-context';
import {
  createSettingsBillingDataRepository,
  type SettingsBillingQueryClient,
} from '@/lib/saas/settings-billing-data';
import {
  buildWorkspaceAccessNotice,
  resolveWorkspaceAccessSuspensionSource,
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
    const repository = createSettingsBillingDataRepository(
      client as unknown as SettingsBillingQueryClient
    );
    const suspensionSource = await resolveWorkspaceAccessSuspensionSource({
      contextSuspensionSource: context.suspensionSource,
      loadSuspensionSource: () => repository.getSuspensionSource?.({ orgId: context.orgId }),
    });
    return buildWorkspaceAccessNotice({
      status: context.orgStatus,
      suspensionSource,
    });
  } catch {
    return null;
  }
}

export async function WorkspaceAccessBanner() {
  const notice = await loadWorkspaceAccessNotice();
  if (!notice) return null;

  return <WorkspaceAccessBannerContent notice={notice} />;
}
