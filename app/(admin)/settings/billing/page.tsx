import {
  BillingPlanSelector,
  type BillingPaymentQueryState,
} from '@/components/saas/billing-plan-selector';
import { BillingSummary } from '@/components/saas/billing-summary';
import { PageHeader } from '@/components/saas/page-header';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';
import { loadBillingSettingsView } from '@/lib/saas/settings-live-data';

interface BillingSettingsPageProps {
  searchParams?: Promise<{
    payment?: string | string[];
    plan?: string | string[];
  }>;
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() ? first.trim().toLowerCase() : null;
}

function normalizePaymentState(value: string | string[] | undefined): BillingPaymentQueryState | null {
  const normalized = firstQueryValue(value);
  return normalized === 'success' ||
    normalized === 'pending' ||
    normalized === 'failed' ||
    normalized === 'cancelled'
    ? normalized
    : null;
}

function normalizeRequestedPlan(value: string | string[] | undefined): SaaSPlanCode | null {
  const normalized = firstQueryValue(value);
  return normalized === 'basic' || normalized === 'growth' || normalized === 'enterprise'
    ? normalized
    : null;
}

export default async function BillingSettingsPage(
  { searchParams }: BillingSettingsPageProps = {}
) {
  const [result, params] = await Promise.all([
    loadBillingSettingsView(),
    searchParams ?? Promise.resolve({ payment: undefined, plan: undefined }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="帳務與訂閱"
        description="查看目前方案與使用期限，並在此選擇方案付款。"
      />

      {result.state === 'ready' ? (
        <>
          <BillingSummary data={result.data} />
          <BillingPlanSelector
            data={result.data}
            paymentState={normalizePaymentState(params.payment)}
            requestedPlan={normalizeRequestedPlan(params.plan)}
          />
        </>
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
