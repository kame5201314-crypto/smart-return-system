import { ManualBetaOrgForm } from '@/components/internal/manual-beta-org-form';
import {
  PlatformOrganizationsExplorer,
  type PlatformOrganizationFilter,
} from '@/components/internal/platform-organizations-explorer';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import { loadPlatformOrganizationsView } from '@/lib/saas/platform-admin-live-data';

type InternalOrgsPageProps = {
  searchParams?: Promise<{ filter?: string | string[] }>;
};

function normalizeInitialFilter(value: string | string[] | undefined): PlatformOrganizationFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  switch (candidate) {
    case 'attention':
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'suspended':
    case 'healthy':
      return candidate;
    default:
      return 'all';
  }
}

export default async function InternalOrgsPage({ searchParams }: InternalOrgsPageProps) {
  const params = await (
    searchParams ?? Promise.resolve<{ filter?: string | string[] }>({})
  );
  const initialFilter = normalizeInitialFilter(params.filter);
  const result = await loadPlatformOrganizationsView();
  redirectUnauthenticatedPlatformAdminResult(result, '/internal/orgs');

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">租戶管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            搜尋、篩選並依優先級處理租戶狀態與試用進度。
          </p>
        </div>
        <ManualBetaOrgForm />
      </div>

      {result.state === 'ready' ? (
        <PlatformOrganizationsExplorer data={result.data} initialFilter={initialFilter} />
      ) : result.state === 'gated' ? (
        <SettingsStateCard variant="gated" gated={result.gated} />
      ) : result.state === 'empty' ? (
        <SettingsStateCard variant="empty" message={result.message} />
      ) : (
        <SettingsStateCard variant="error" message={result.message} />
      )}
    </div>
  );
}
