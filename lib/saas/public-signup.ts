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
      statusLabel: '公開註冊開放',
      headline: '開始 14 天免卡試用',
      description:
        '公開註冊開放後，系統會先建立 Basic 試用申請；正式建立 org、Owner 與 trial 仍需通過 SaaS DB guard。',
      primaryCtaLabel: '開始試用',
      secondaryCtaLabel: '查看價格',
    };
  }

  return {
    mode: 'closed_beta',
    isPublicSignupEnabled: false,
    statusLabel: '封閉 Beta',
    headline: '目前採邀請制開通',
    description:
      '公開註冊預設關閉。Beta 期間先由平台管理員確認需求、建立 org、指定 Owner，並開通 14 天試用。',
    primaryCtaLabel: '聯絡 Beta 導入',
    secondaryCtaLabel: '查看價格',
  };
}
