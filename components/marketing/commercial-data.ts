import {
  SAAS_PLAN_DEFINITIONS,
  SAAS_SELF_SERVICE_PLAN_CODE,
  type SaaSPlanCode,
  type SelfServiceSaaSPlanCode,
} from '@/lib/config/saas-plans';

export const publicNavItems = [
  { label: '退貨流程', href: '/features/returns' },
  { label: 'AI 分析', href: '/features/ai' },
  { label: '安全隔離', href: '/features/security' },
  { label: '價格', href: '/pricing' },
  { label: '聯絡', href: '/contact' },
] as const;

export const legalNavItems = [
  { label: '服務條款', href: '/legal/terms' },
  { label: '隱私權政策', href: '/legal/privacy' },
  { label: '退費政策', href: '/legal/refund' },
] as const;

export const planOrder: readonly SelfServiceSaaSPlanCode[] = [
  SAAS_SELF_SERVICE_PLAN_CODE,
];

export const planCopy: Record<
  SelfServiceSaaSPlanCode,
  {
    summary: string;
    bestFor: string;
    cta: string;
    featured?: boolean;
    features: string[];
  }
> = {
  basic: {
    summary: '把 Excel、LINE、平台後台的退貨資料集中到同一個工作區，先把流程穩下來。',
    bestFor: '每月 30–300 筆退貨、1–3 人團隊',
    cta: '3 天免費試用',
    featured: true,
    features: ['3 人團隊', '每月 300 筆退貨', 'AI 退貨原因分析 10 次/月', '蝦皮退貨匯入', '基本數據與匯出'],
  },
};

export function getPlanPriceLabel(code: SaaSPlanCode): string {
  const price = SAAS_PLAN_DEFINITIONS[code].monthlyPriceTwd;
  if (price === null) return '客製報價';
  return `NT$ ${price.toLocaleString('zh-TW')}`;
}

export function getPlanMetricLabel(code: SaaSPlanCode, key: 'seat' | 'returns' | 'ai'): string {
  const plan = SAAS_PLAN_DEFINITIONS[code];
  if (key === 'seat') return plan.seatLimit === null ? '依合約' : `${plan.seatLimit} 位`;
  if (key === 'returns') {
    return plan.monthlyReturnSoftLimit === null
      ? '依合約'
      : `${plan.monthlyReturnSoftLimit.toLocaleString('zh-TW')} 筆/月`;
  }
  return plan.aiMonthlyLimit === null ? '依合約' : `${plan.aiMonthlyLimit} 次/月`;
}
