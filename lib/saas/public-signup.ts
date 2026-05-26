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
      statusLabel: '開放試用',
      headline: '立即開始 14 天免費試用',
      description:
        '不需信用卡。註冊後即可建立你的品牌帳號、邀請團隊、匯入第一批退貨資料。',
      primaryCtaLabel: '立即開始試用',
      secondaryCtaLabel: '查看價格',
    };
  }

  return {
    mode: 'closed_beta',
    isPublicSignupEnabled: false,
    statusLabel: 'Beta 期 · 限額導入',
    headline: '申請 Beta，14 天免費試用 + 免費協助導入',
    description:
      'Beta 期間我們手動為每家品牌開通帳號並協助匯入第一批退貨資料，確保你第一週就用得起來。前 5 家品牌享免費導入。',
    primaryCtaLabel: '申請 Beta 試用',
    secondaryCtaLabel: '查看價格',
  };
}
