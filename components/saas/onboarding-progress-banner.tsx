import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';

import { loadSaaSOnboardingView } from '@/lib/saas/onboarding-live-data';

export async function OnboardingProgressBanner() {
  const result = await loadSaaSOnboardingView();

  if (result.state !== 'ready') {
    return null;
  }

  if (result.data.org.onboardingCompletedAt !== null) {
    return null;
  }

  const { summary } = result.data;
  const remainingSteps = Math.max(0, summary.totalSteps - summary.completedSteps);
  const percent = Math.max(0, Math.min(100, summary.percentComplete));

  return (
    <Link
      href="/onboarding"
      className="group mb-4 block rounded-lg border border-cyan-200 bg-cyan-50/60 p-3 transition-colors hover:bg-cyan-100/60"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-cyan-950">
              工作區設定 {percent}% 完成
            </span>
            <span className="text-xs text-cyan-700">
              還有 {remainingSteps} 個步驟
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cyan-100">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`工作區設定完成 ${percent}%`}
            />
          </div>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-cyan-700 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
