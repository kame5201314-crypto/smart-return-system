import { AlertCircle, Inbox, Lock } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { GatedState } from '@/lib/saas/ui-backend-contracts';

interface SettingsStateCardProps {
  variant: 'gated' | 'empty' | 'error';
  message?: string;
  gated?: GatedState;
}

const GATED_TITLE: Record<GatedState['reason'], string> = {
  feature_disabled: '功能尚未開放',
  plan_required: '方案不符',
  role_required: '權限不足',
  billing_required: '需先處理帳務',
  not_configured: '尚未設定',
};

// Shared non-ready state card for SaaS settings pages backed by
// SettingsLiveDataResult (gated / empty / error).
export function SettingsStateCard({ variant, message, gated }: SettingsStateCardProps) {
  const config =
    variant === 'gated'
      ? {
          Icon: Lock,
          tone: 'text-amber-600',
          bg: 'bg-amber-50',
          title: gated ? GATED_TITLE[gated.reason] : '無法存取',
          body: gated?.message,
        }
      : variant === 'empty'
        ? {
            Icon: Inbox,
            tone: 'text-muted-foreground',
            bg: 'bg-muted',
            title: '目前沒有資料',
            body: message,
          }
        : {
            Icon: AlertCircle,
            tone: 'text-red-600',
            bg: 'bg-red-50',
            title: '載入失敗',
            body: message,
          };

  const { Icon } = config;

  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className={`flex size-14 items-center justify-center rounded-full ${config.bg}`}>
          <Icon className={`size-7 ${config.tone}`} aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{config.title}</p>
          {config.body ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{config.body}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
