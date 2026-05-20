import { SAAS_PLAN_DEFINITIONS, type SaaSPlanCode } from '@/lib/config/saas-plans';

export const publicNavItems = [
  { label: '功能', href: '/features/returns' },
  { label: 'AI 分析', href: '/features/ai' },
  { label: '資安', href: '/features/security' },
  { label: '方案', href: '/pricing' },
  { label: '聯絡', href: '/contact' },
] as const;

export const legalNavItems = [
  { label: '服務條款', href: '/legal/terms' },
  { label: '隱私權政策', href: '/legal/privacy' },
  { label: '退費政策', href: '/legal/refund' },
] as const;

export const planOrder: SaaSPlanCode[] = ['basic', 'growth', 'pro', 'enterprise'];

export const planCopy: Record<
  SaaSPlanCode,
  {
    summary: string;
    bestFor: string;
    cta: string;
    featured?: boolean;
    features: string[];
  }
> = {
  basic: {
    summary: '小型品牌先把退貨流程集中管理。',
    bestFor: '每日 10 到 20 筆退貨',
    cta: '申請 Basic 試用',
    features: ['3 個成員席次', '500 筆退貨/月軟限制', '5 次 AI 分析/月', 'Email 支援 8 小時內回覆'],
  },
  growth: {
    summary: '客服、倉庫、主管一起處理退貨。',
    bestFor: '正在成長的電商品牌',
    cta: '申請 Growth 試用',
    featured: true,
    features: ['10 個成員席次', '2,000 筆退貨/月軟限制', '30 次 AI 分析/月', '進階分析權限'],
  },
  pro: {
    summary: '高退貨量品牌與多部門協作。',
    bestFor: '多渠道與高峰期營運',
    cta: '申請 Pro 試用',
    features: ['30 個成員席次', '8,000 筆退貨/月軟限制', '100 次 AI 分析/月', 'Stage 4+ API 權限'],
  },
  enterprise: {
    summary: '客製權限、SLA 與導入服務。',
    bestFor: '跨品牌或企業級流程',
    cta: '洽談 Enterprise',
    features: ['席次依合約', '退貨量依合約', 'AI 額度依合約', '專屬 SLA 與導入協助'],
  },
};

export function getPlanPriceLabel(code: SaaSPlanCode): string {
  const price = SAAS_PLAN_DEFINITIONS[code].monthlyPriceTwd;
  if (price === null) return '專案報價';
  return `NT$ ${price.toLocaleString('zh-TW')}`;
}

export function getPlanMetricLabel(code: SaaSPlanCode, key: 'seat' | 'returns' | 'ai'): string {
  const plan = SAAS_PLAN_DEFINITIONS[code];
  if (key === 'seat') return plan.seatLimit === null ? '依合約' : `${plan.seatLimit} 人`;
  if (key === 'returns') {
    return plan.monthlyReturnSoftLimit === null
      ? '依合約'
      : `${plan.monthlyReturnSoftLimit.toLocaleString('zh-TW')} 筆/月`;
  }
  return plan.aiMonthlyLimit === null ? '依合約' : `${plan.aiMonthlyLimit} 次/月`;
}

export const workflowHighlights = [
  {
    title: '退貨集中作業',
    body: '把申請、審核、收貨、驗貨、退款集中到同一個流程，客服與倉庫看到同一份狀態。',
  },
  {
    title: 'AI 文字分析',
    body: '每月固定額度，針對退貨原因與客服備註做文字分析；圖片 AI 預設關閉。',
  },
  {
    title: '多租戶隔離',
    body: '以 org_id、RLS、getOrgContext() 管控租戶資料，不讓客戶資料跨組織讀取。',
  },
  {
    title: '訂閱制準備',
    body: '保留 ECPay 定期定額、電子發票、狀態機與用量限制，先用封閉 Beta 手動開通。',
  },
] as const;

export const launchStages = [
  {
    stage: 'Stage 1',
    title: '封閉 Beta',
    items: ['手動開通 org', 'org_id + RLS', '邀請成員', 'AI 額度硬上限'],
  },
  {
    stage: 'Stage 2',
    title: '付費 Beta',
    items: ['ECPay 定期定額', '電子發票', 'past_due / suspended', '帳務通知'],
  },
  {
    stage: 'Stage 3',
    title: '公開註冊',
    items: ['14 天免卡試用', 'onboarding', '公開 pricing', '法務頁面'],
  },
] as const;
