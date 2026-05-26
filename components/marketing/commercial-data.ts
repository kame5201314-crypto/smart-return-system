import { SAAS_PLAN_DEFINITIONS, type SaaSPlanCode } from '@/lib/config/saas-plans';

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
    summary: '剛開始想把退貨從 Excel、LINE、平台後台搬到同一個地方的小型品牌。',
    bestFor: '每月 50–500 筆退貨、1–3 人團隊',
    cta: '14 天免費試用',
    features: ['3 人團隊', '每月 500 筆退貨', 'AI 退貨原因分析 5 次/月', '蝦皮退貨匯入', 'Email 支援'],
  },
  growth: {
    summary: '客服、倉庫、營運要看同一份資料，靠 AI 找出每月的退貨地雷。',
    bestFor: '多人協作、多通路經營的成長型電商',
    cta: '14 天免費試用',
    featured: true,
    features: ['10 人團隊', '每月 2,000 筆退貨', 'AI 退貨原因分析 30 次/月', '進階分析儀表板', '蝦皮 + 官網 + momo'],
  },
  pro: {
    summary: '高退貨量、多平台、多倉庫團隊，需要清楚分權與完整數據。',
    bestFor: '月退貨 2,000+ 筆、有營運主管與倉管團隊',
    cta: '14 天免費試用',
    features: ['30 人團隊', '每月 8,000 筆退貨', 'AI 退貨原因分析 100 次/月', '進階分析儀表板', '優先支援'],
  },
  enterprise: {
    summary: '集團 / 多品牌 / 客製需求，需要合約、SLA 與客製權限。',
    bestFor: '大型品牌、集團、多倉或客製整合',
    cta: '洽談企業方案',
    features: ['席次依需求', '退貨量依需求', 'AI 額度依需求', '專屬 SLA 與導入顧問', '客製權限矩陣'],
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

