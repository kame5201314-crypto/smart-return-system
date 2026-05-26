import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import {
  Building2,
  Check,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Package,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/saas/page-header';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { OnboardingCompleteButton } from '@/components/saas/onboarding-complete-button';
import { loadSaaSOnboardingView } from '@/lib/saas/onboarding-live-data';
import type {
  SaaSOnboardingStepId,
  SaaSOnboardingStepStatus,
  SaaSOnboardingView,
} from '@/lib/saas/onboarding';

type StepMeta = {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  cta?: {
    label: string;
    href: string;
  };
};

const STEP_META: Record<SaaSOnboardingStepId, StepMeta> = {
  organization_profile: {
    title: '組織資料',
    description: '確認你的工作區資料，再邀請夥伴加入。',
    icon: Building2,
    cta: { label: '前往設定', href: '/settings/billing' },
  },
  return_policy: {
    title: '退貨政策',
    description: '設定團隊與退貨頁面使用的基本退貨政策。',
    icon: FileText,
    cta: { label: '前往設定', href: '/settings' },
  },
  team_setup: {
    title: '邀請團隊',
    description: '邀請至少一位夥伴加入，或保留一個待接受的邀請。',
    icon: UsersRound,
    cta: { label: '邀請成員', href: '/settings/team' },
  },
  first_return: {
    title: '第一筆退貨',
    description: '建立或匯入第一筆退貨單，熟悉退貨處理流程。',
    icon: Package,
    cta: { label: '前往退貨管理', href: '/returns' },
  },
  ai_review: {
    title: 'AI 分析',
    description: '執行第一次 AI 退貨分析，驗證主要工作流程。',
    icon: Sparkles,
    cta: { label: '前往 AI 分析', href: '/analytics/ai-report' },
  },
  complete: {
    title: '完成設定',
    description: '完成上述所有步驟後，標記設定指引為完成。',
    icon: Trophy,
  },
};

const STATUS_LABEL: Record<SaaSOnboardingStepStatus, string> = {
  complete: '已完成',
  current: '進行中',
  pending: '尚未開始',
  blocked: '尚未開放',
};

type StatusStyle = {
  ring: string;
  card: string;
  label: string;
};

function statusStyle(status: SaaSOnboardingStepStatus): StatusStyle {
  if (status === 'complete') {
    return {
      ring: 'bg-emerald-500 text-white',
      card: 'border-emerald-200 bg-emerald-50/40',
      label: 'text-emerald-700',
    };
  }
  if (status === 'current') {
    return {
      ring: 'bg-cyan-500 text-white',
      card: 'border-cyan-300 bg-cyan-50/40',
      label: 'text-cyan-700',
    };
  }
  if (status === 'blocked') {
    return {
      ring: 'bg-neutral-200 text-neutral-400',
      card: 'border-neutral-200 bg-neutral-50',
      label: 'text-muted-foreground',
    };
  }
  return {
    ring: 'bg-neutral-100 text-neutral-400',
    card: '',
    label: 'text-muted-foreground',
  };
}

function statusIcon(status: SaaSOnboardingStepStatus) {
  if (status === 'complete') return Check;
  if (status === 'current') return Clock;
  return Circle;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function NextStepCard({ data }: { data: SaaSOnboardingView }) {
  if (data.org.onboardingCompletedAt !== null) return null;

  const currentStepId = data.summary.currentStepId;
  if (!currentStepId) return null;

  const meta = STEP_META[currentStepId];
  if (!meta) return null;

  const Icon = meta.icon;
  const isFinalCompleteStep = currentStepId === 'complete';

  return (
    <Card className="rounded-lg border-cyan-300 bg-gradient-to-r from-cyan-50 to-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                下一步
              </p>
              <h2 className="mt-1 text-xl font-bold text-cyan-950">{meta.title}</h2>
              <p className="mt-1 text-sm text-cyan-900">{meta.description}</p>
            </div>
          </div>
          <div className="shrink-0">
            {isFinalCompleteStep ? (
              <OnboardingCompleteButton
                disabled={!data.actions.canComplete}
                disabledReason={data.actions.disabledReason}
              />
            ) : meta.cta ? (
              <Button asChild size="lg">
                <Link href={meta.cta.href}>
                  {meta.cta.label}
                  <ChevronRight className="size-5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingContent({ data }: { data: SaaSOnboardingView }) {
  const isComplete = data.org.onboardingCompletedAt !== null;
  const progressPercent = Math.max(0, Math.min(100, data.summary.percentComplete));

  return (
    <>
      <NextStepCard data={data} />

      <Card
        className={`rounded-lg ${isComplete ? 'border-emerald-300 bg-emerald-50/40' : ''}`}
      >
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isComplete ? <Trophy className="size-5 text-emerald-600" /> : null}
                {isComplete ? '設定已完成！' : '進度'}
              </CardTitle>
              <CardDescription>
                {isComplete
                  ? `完成於 ${formatDate(data.org.onboardingCompletedAt)}`
                  : `${data.summary.completedSteps} / ${data.summary.totalSteps} 個步驟完成`}
              </CardDescription>
            </div>
            <div className="text-3xl font-bold text-emerald-700">
              {progressPercent}%
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`設定指引完成 ${progressPercent}%`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <ol className="space-y-3">
        {data.steps.map((step, index) => {
          const meta = STEP_META[step.id];
          const classes = statusStyle(step.status);
          const StatusIcon = statusIcon(step.status);
          const Icon = meta.icon;
          const isCompleteStep = step.id === 'complete';
          const showCompleteButton = isCompleteStep && step.status !== 'complete';
          const showCtaButton =
            !isCompleteStep && meta.cta && step.status !== 'complete';

          return (
            <li key={step.id}>
              <Card className={`rounded-lg ${classes.card}`}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${classes.ring}`}
                  >
                    <StatusIcon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="font-semibold">
                        {index + 1}. {meta.title}
                      </span>
                      <span className={`text-xs ${classes.label}`}>
                        · {STATUS_LABEL[step.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {showCompleteButton ? (
                      <OnboardingCompleteButton
                        disabled={!data.actions.canComplete}
                        disabledReason={data.actions.disabledReason}
                      />
                    ) : showCtaButton && meta.cta ? (
                      <Button
                        asChild
                        variant={step.status === 'current' ? 'default' : 'outline'}
                        size="sm"
                      >
                        <Link href={meta.cta.href}>
                          {meta.cta.label}
                          <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    ) : step.status === 'complete' ? (
                      <span className="text-sm font-medium text-emerald-700">
                        已完成
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default async function OnboardingPage() {
  const result = await loadSaaSOnboardingView();

  return (
    <div className="space-y-6">
      <PageHeader
        title="設定指引"
        description="完成以下步驟，協助你的團隊更快上手。"
      />

      {result.state === 'ready' ? (
        <OnboardingContent data={result.data} />
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
