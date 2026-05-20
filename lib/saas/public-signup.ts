import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

export type SaaSPublicSignupMode = 'closed_beta' | 'public_signup';

export interface SaaSPublicSignupState {
  mode: SaaSPublicSignupMode;
  isPublicSignupEnabled: boolean;
  statusLabel: string;
  headline: string;
  description: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
}

export function resolveSaaSPublicSignupState(
  env?: Record<string, string | undefined>
): SaaSPublicSignupState {
  const featureFlags = resolveSaaSFeatureFlags({
    env,
    orgPlan: 'basic',
  });

  if (featureFlags.public_signup) {
    return {
      mode: 'public_signup',
      isPublicSignupEnabled: true,
      statusLabel: '公開註冊開放中',
      headline: '建立 14 天試用申請',
      description:
        '公開註冊已開放時，使用者可送出 Basic 試用申請；建立 org、Owner 與 trial 仍必須通過 SaaS DB guard。',
      primaryCtaLabel: '送出試用申請',
      secondaryCtaLabel: '查看方案',
    };
  }

  return {
    mode: 'closed_beta',
    isPublicSignupEnabled: false,
    statusLabel: '封閉 Beta',
    headline: '目前採手動開通',
    description:
      '公開註冊預設關閉。Beta 期間先由平台管理員審核需求後手動建立 org、Owner、方案與 14 天試用。',
    primaryCtaLabel: '聯絡 Beta 開通',
    secondaryCtaLabel: '查看方案',
  };
}
