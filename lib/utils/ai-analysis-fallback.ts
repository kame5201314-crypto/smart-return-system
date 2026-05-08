import type {
  AIAnalysisPromptPayload,
  PromptCountRow,
} from '@/lib/utils/ai-analysis-prompt';

export interface LocalAIAnalysisResponsePayload {
  summary: string;
  pain_points: Array<{
    issue: string;
    frequency: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    affected_products: string[];
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }>;
  sku_analysis: Array<{
    sku_group: string;
    sku: string;
    product_name: string;
    return_count: number;
    return_rate?: string;
    main_issues: string[];
    suggestion: string;
    variants: Array<{
      product_name: string;
      sku: string;
      return_count: number;
      main_issues: string[];
      suggestion: string;
    }>;
  }>;
  channel_analysis: Array<{
    channel: string;
    return_count: number;
    common_issues: string[];
  }>;
}

const UNKNOWN_ISSUE = '待確認退貨原因';
const MAX_ISSUE_TEXT_LENGTH = 80;

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized === '-' || normalized === '無' || normalized === 'N/A') {
    return null;
  }

  return normalized.length > MAX_ISSUE_TEXT_LENGTH
    ? `${normalized.slice(0, MAX_ISSUE_TEXT_LENGTH - 3)}...`
    : normalized;
}

function mergeCountRows(rows: PromptCountRow[]): PromptCountRow[] {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const label = cleanLabel(row.label);
    if (!label) return;

    const count = Number.isFinite(row.count) && row.count > 0 ? row.count : 0;
    if (count <= 0) return;

    counts.set(label, (counts.get(label) || 0) + count);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'zh-Hant');
    });
}

function getSeverity(count: number, total: number): 'high' | 'medium' | 'low' {
  if (total <= 0) {
    return 'low';
  }

  const ratio = count / total;
  if (count >= 10 || ratio >= 0.2) return 'high';
  if (count >= 3 || ratio >= 0.08) return 'medium';
  return 'low';
}

function rowsToIssueList(rows: PromptCountRow[], limit = 3): string[] {
  const issues = mergeCountRows(rows)
    .slice(0, limit)
    .map((row) => row.label);

  return issues.length > 0 ? issues : [UNKNOWN_ISSUE];
}

function buildSuggestion(issues: string[], skuGroup?: string): string {
  const joined = issues.join('、');
  const target = skuGroup ? `${skuGroup} ` : '';

  if (/尺寸|太大|太小|鬆|緊|不合|夾|卡/i.test(joined)) {
    return `${target}優先檢查尺寸標示、適用型號與結構公差，必要時調整版型或補充尺寸警示。`;
  }

  if (/品質|損|壞|故障|不能使用|變形|刮|破|瑕疵/i.test(joined)) {
    return `${target}加強出貨前抽檢與供應商品質回饋，針對重複瑕疵建立改善追蹤。`;
  }

  if (/包裝|原包裝|外盒|盒/i.test(joined)) {
    return `${target}重新檢查商品頁退貨規範與包裝提醒，降低因包裝條件不清造成的退貨。`;
  }

  if (/不需要|買錯|訂錯|誤購/i.test(joined)) {
    return `${target}優化商品標題、主圖規格與下單前提醒，減少誤購與需求不符。`;
  }

  if (issues.includes(UNKNOWN_ISSUE)) {
    return `${target}補齊退貨原因與驗貨備註，累積足夠文字後再判斷商品改善方向。`;
  }

  return `${target}針對「${joined}」整理客服、買家備註與驗貨紀錄，確認是否需要調整商品頁或供應鏈。`;
}

function issueRowsFromPayload(payload: AIAnalysisPromptPayload): PromptCountRow[] {
  return mergeCountRows([
    ...payload.official_summary.reason_category_counts,
    ...payload.official_summary.reason_detail_counts,
    ...payload.official_summary.item_reason_counts,
    ...payload.shopee_summary.return_reason_counts,
    ...payload.shopee_summary.buyer_note_samples,
    ...payload.shopee_summary.return_reason_note_samples,
  ]);
}

function groupIssueRows(group: AIAnalysisPromptPayload['sku_groups'][number]) {
  return mergeCountRows([
    ...group.reason_summaries,
    ...group.buyer_note_summaries,
    ...group.return_reason_note_summaries,
  ]);
}

function variantIssueRows(
  variant: AIAnalysisPromptPayload['sku_groups'][number]['variants'][number]
) {
  return mergeCountRows([
    ...variant.reason_summaries,
    ...variant.buyer_note_summaries,
    ...variant.return_reason_note_summaries,
  ]);
}

function findAffectedProducts(
  payload: AIAnalysisPromptPayload,
  issue: string
): string[] {
  const exactIssue = issue.toLowerCase();

  const matched = payload.sku_groups
    .filter((group) => {
      const text = [
        ...group.reason_summaries,
        ...group.buyer_note_summaries,
        ...group.return_reason_note_summaries,
      ]
        .map((row) => row.label)
        .join(' ')
        .toLowerCase();

      return text.includes(exactIssue);
    })
    .slice(0, 4)
    .map((group) => `${group.sku_group} ${group.product_name}`.trim());

  if (matched.length > 0) {
    return matched;
  }

  return payload.sku_groups
    .slice(0, 3)
    .map((group) => `${group.sku_group} ${group.product_name}`.trim());
}

function normalizeChannelLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'shopee') return '蝦皮';
  if (normalized === 'mall') return '商城';
  if (normalized === 'official') return '官網';
  return value.trim() || '未分類';
}

function buildChannelAnalysis(payload: AIAnalysisPromptPayload) {
  const channelRows = mergeCountRows([
    ...payload.official_summary.channel_counts,
    ...payload.shopee_summary.platform_counts,
  ]);
  const globalIssues = issueRowsFromPayload(payload).slice(0, 3).map((row) => row.label);

  return channelRows.map((row) => ({
    channel: normalizeChannelLabel(row.label),
    return_count: row.count,
    common_issues: globalIssues.length > 0 ? globalIssues : [UNKNOWN_ISSUE],
  }));
}

function buildSkuAnalysis(payload: AIAnalysisPromptPayload) {
  const totalReturns =
    payload.dataset_counts.official_returns + payload.dataset_counts.shopee_returns;

  return payload.sku_groups.slice(0, 20).map((group) => {
    const groupIssues = rowsToIssueList(groupIssueRows(group));

    return {
      sku_group: group.sku_group,
      sku: group.sku_group,
      product_name: group.product_name || '-',
      return_count: group.return_count,
      return_rate:
        totalReturns > 0
          ? `${((group.return_count / totalReturns) * 100).toFixed(1)}%`
          : undefined,
      main_issues: groupIssues,
      suggestion: buildSuggestion(groupIssues, group.sku_group),
      variants: group.variants.map((variant) => {
        const issues = rowsToIssueList(variantIssueRows(variant));

        return {
          product_name: variant.product_name || '-',
          sku: variant.sku,
          return_count: variant.return_count,
          main_issues: issues,
          suggestion: buildSuggestion(issues, variant.sku),
        };
      }),
    };
  });
}

export function buildLocalAIAnalysisFallback(
  payload: AIAnalysisPromptPayload
): LocalAIAnalysisResponsePayload {
  const totalReturns =
    payload.dataset_counts.official_returns + payload.dataset_counts.shopee_returns;
  const issueRows = issueRowsFromPayload(payload);
  const topSkuGroup = payload.sku_groups[0];
  const topIssues = issueRows.slice(0, 5);

  const painPoints =
    topIssues.length > 0
      ? topIssues.map((row) => ({
          issue: row.label,
          frequency: getSeverity(row.count, totalReturns),
          impact: getSeverity(row.count, totalReturns),
          affected_products: findAffectedProducts(payload, row.label),
        }))
      : [
          {
            issue: UNKNOWN_ISSUE,
            frequency: 'low' as const,
            impact: 'low' as const,
            affected_products: payload.sku_groups
              .slice(0, 3)
              .map((group) => `${group.sku_group} ${group.product_name}`.trim()),
          },
        ];

  const recommendations = [
    ...(topSkuGroup
      ? [
          {
            title: `優先處理 ${topSkuGroup.sku_group} 退貨集中問題`,
            description: `${topSkuGroup.product_name} 退貨 ${topSkuGroup.return_count} 件，請先比對商品頁規格、買家備註與驗貨原因。`,
            priority: 'high' as const,
            category: 'product',
          },
        ]
      : []),
    {
      title: '補齊買家備註與退貨原因備註',
      description: '本地備援分析已納入買家備註、退貨原因與退貨原因備註；請持續讓驗貨人員補充原因，降低未知問題比例。',
      priority: 'medium' as const,
      category: 'data_quality',
    },
    ...(topIssues[0]
      ? [
          {
            title: `針對「${topIssues[0].label}」建立改善追蹤`,
            description: buildSuggestion([topIssues[0].label]),
            priority: getSeverity(topIssues[0].count, totalReturns),
            category: 'operations',
          },
        ]
      : []),
  ];

  return {
    summary: `${payload.period} 共分析 ${totalReturns} 筆退貨資料（官網 ${payload.dataset_counts.official_returns} 筆、蝦皮/商城 ${payload.dataset_counts.shopee_returns} 筆），因 AI 服務暫時無法產生內容，已改用文字統計備援報告。`,
    pain_points: painPoints,
    recommendations,
    sku_analysis: buildSkuAnalysis(payload),
    channel_analysis: buildChannelAnalysis(payload),
  };
}
