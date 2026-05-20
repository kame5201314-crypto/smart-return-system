import Link from 'next/link';
import { ArrowRight, BarChart3, PackageCheck, Sparkles, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';

const currentPlan = SAAS_PLAN_DEFINITIONS.growth;
const usageCards = [
  {
    label: '退貨量',
    used: 1320,
    limit: currentPlan.monthlyReturnSoftLimit || 0,
    helper: '軟限制：超量提醒，不阻擋作業。',
    icon: PackageCheck,
  },
  {
    label: 'AI 文字分析',
    used: 21,
    limit: currentPlan.aiMonthlyLimit || 0,
    helper: '硬限制：100% 後停止新增 AI 分析。',
    icon: Sparkles,
  },
  {
    label: '成員席次',
    used: 7,
    limit: currentPlan.seatLimit || 0,
    helper: 'Owner / Admin 可管理邀請。',
    icon: BarChart3,
  },
] as const;

function percent(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function UsageSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">用量與額度</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Growth 方案示意資料。正式資料會從 org.plan、ai_usage_events 與退貨表月度統計讀取。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings/billing">
            管理訂閱
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {usageCards.map((item) => {
          const Icon = item.icon;
          const value = percent(item.used, item.limit);
          return (
            <Card key={item.label} className="rounded-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant={value >= 100 ? 'destructive' : value >= 80 ? 'secondary' : 'outline'}>
                    {value}%
                  </Badge>
                </div>
                <CardTitle className="text-base">{item.label}</CardTitle>
                <CardDescription>{item.helper}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex items-end justify-between">
                  <div className="text-2xl font-semibold text-gray-950">
                    {item.used.toLocaleString('zh-TW')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    / {item.limit.toLocaleString('zh-TW')}
                  </div>
                </div>
                <Progress value={value} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-700" />
              升級提示規則
            </CardTitle>
            <CardDescription>避免退貨旺季直接阻擋作業。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>退貨量達 80%：顯示黃色提醒。</p>
            <p>退貨量達 100%：顯示紅色提醒，但不阻擋新增退貨。</p>
            <p>連續 2 個月超量：標記 organizations.upgrade_suggested_at。</p>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-cyan-700" />
              AI 額度規則
            </CardTitle>
            <CardDescription>成本安全優先於流量成長。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {[
              ['計數來源', 'ai_usage_events 以 org_id + feature + report_period 統計。'],
              ['快取命中', '相同 fingerprint 命中快取不扣額度。'],
              ['圖片 AI', 'ENABLE_IMAGE_AI=false 時全域停用。'],
              ['Enterprise', 'aiMonthlyLimit=null，依合約處理。'],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-md border p-3">
                <div className="font-medium text-gray-950">{label}</div>
                <div className="mt-1 text-muted-foreground">{detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
