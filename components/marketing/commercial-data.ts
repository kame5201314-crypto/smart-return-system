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
    summary: '適合剛開始整理退貨流程的小型賣家，先把客服、倉庫與對帳資料集中起來。',
    bestFor: '每月約 10 到 20 個工作日都有退貨處理需求',
    cta: '開始 Basic 試用',
    features: ['3 位成員', '500 筆退貨/月軟上限', '5 次 AI 分析/月', 'Email 支援'],
  },
  growth: {
    summary: '適合成長中的電商品牌，讓客服、營運與倉庫用同一套退貨作業節奏。',
    bestFor: '多平台訂單與多人協作團隊',
    cta: '開始 Growth 試用',
    featured: true,
    features: ['10 位成員', '2,000 筆退貨/月軟上限', '30 次 AI 分析/月', '進階分析儀表板'],
  },
  pro: {
    summary: '適合退貨量較高、需要管理多平台與更完整分析的大型營運團隊。',
    bestFor: '高退貨量品牌、倉儲團隊、營運主管',
    cta: '開始 Pro 試用',
    features: ['30 位成員', '8,000 筆退貨/月軟上限', '100 次 AI 分析/月', 'Stage 4+ API 權限'],
  },
  enterprise: {
    summary: '適合需要合約條件、客製流程、SLA 與進階權限治理的企業客戶。',
    bestFor: '大型品牌、集團、多倉或客製整合',
    cta: '洽談 Enterprise',
    features: ['席次依合約', '退貨量依合約', 'AI 額度依合約', '專屬 SLA 與導入支援'],
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

export const workflowHighlights = [
  {
    title: '退貨資料集中',
    body: '把客服登記、平台退貨、檢查結果、退款狀態集中管理，減少 Excel 與訊息往返。',
  },
  {
    title: 'AI 文字分析',
    body: '退貨 AI 只分析文字資料，協助整理原因、SKU 與處理建議；圖片 AI 預設關閉。',
  },
  {
    title: '租戶資料隔離',
    body: '以 org_id、RLS 與 getOrgContext() 建立隔離邊界，避免不同客戶資料互相讀取。',
  },
  {
    title: '商業化控制',
    body: '方案、AI 額度、進階分析與平台管理都透過 feature flags 分階段開放。',
  },
] as const;

export const launchStages = [
  {
    stage: 'Stage 1',
    title: '手動 Beta',
    items: ['手動建立 org', 'org_id + RLS', '團隊邀請', 'AI 額度計數'],
  },
  {
    stage: 'Stage 2',
    title: '付費 Beta',
    items: ['ECPay 定期定額', '電子發票', 'past_due / suspended', '人工退費流程'],
  },
  {
    stage: 'Stage 3',
    title: '公開註冊',
    items: ['14 天免卡試用', 'onboarding', '公開 pricing', '法律頁與通知'],
  },
] as const;
