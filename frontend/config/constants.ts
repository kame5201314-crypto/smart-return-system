/**
 * 商務邏輯配置
 * 所有可調整的業務參數都集中在此處
 */

// 預設組織 ID（多租戶架構）
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

// AI 檢查配置
export const AI_CONFIG = {
  // 信心分數門檻
  CONFIDENCE_THRESHOLD: {
    HIGH: 90,      // 高信心：自動通過
    MEDIUM: 70,    // 中信心：需人工複核
    LOW: 50,       // 低信心：標記為可疑
  },
  // 每次批次處理的最大檔案數
  BATCH_SIZE: 10,
  // API 逾時設定（毫秒）
  TIMEOUT: 120000,
} as const

// 素材狀態配置
export const ASSET_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  NEEDS_REVIEW: 'needs_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT_TO_VENDOR: 'sent_to_vendor',
} as const

export const ASSET_STATUS_LABELS: Record<string, string> = {
  pending: '待檢查',
  processing: 'AI 處理中',
  needs_review: '需人工複核',
  approved: '已通過',
  rejected: '已退回',
  sent_to_vendor: '已發送給外包',
}

export const ASSET_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  sent_to_vendor: 'bg-purple-100 text-purple-800',
}

// 標註類型配置
export const ANNOTATION_TYPES = {
  TYPO: 'typo',
  SPEC_ERROR: 'spec_error',
  PRICE_ERROR: 'price_error',
  BRAND_VIOLATION: 'brand_violation',
  FORBIDDEN_WORD: 'forbidden_word',
  SUGGESTION: 'suggestion',
} as const

export const ANNOTATION_TYPE_LABELS: Record<string, string> = {
  typo: '錯別字',
  spec_error: '規格錯誤',
  price_error: '價格錯誤',
  brand_violation: '品牌違規',
  forbidden_word: '禁用詞彙',
  suggestion: 'AI 建議',
}

export const SEVERITY_LEVELS = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const

export const SEVERITY_LABELS: Record<string, string> = {
  error: '錯誤',
  warning: '警告',
  info: '建議',
}

export const SEVERITY_COLORS: Record<string, string> = {
  error: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
}

// 外包商評等配置
export const VENDOR_RATING = {
  EXCELLENT: { min: 4.5, label: '優秀', color: 'text-green-600' },
  GOOD: { min: 3.5, label: '良好', color: 'text-blue-600' },
  AVERAGE: { min: 2.5, label: '普通', color: 'text-yellow-600' },
  POOR: { min: 0, label: '待改進', color: 'text-red-600' },
} as const

// 雲端同步配置
export const CLOUD_SYNC = {
  DEFAULT_INTERVAL_MINUTES: 30,
  MIN_INTERVAL_MINUTES: 5,
  MAX_INTERVAL_MINUTES: 1440, // 24 小時
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  SUPPORTED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
  MAX_FILE_SIZE_MB: 500,
} as const

// 分頁配置
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const

// 侵權監控配置（infringement_system）
export const INFRINGEMENT_CONFIG = {
  // 掃描頻率（小時）
  SCAN_INTERVAL_HOURS: 24,
  // 支援的平台
  PLATFORMS: ['shopee', 'momo', 'pchome', 'yahoo', 'ruten'],
  // 相似度門檻
  SIMILARITY_THRESHOLD: 85,
} as const

// 營運指標配置（ops_metrics）
export const METRICS_CONFIG = {
  // 資料更新頻率（分鐘）
  REFRESH_INTERVAL_MINUTES: 15,
  // KPI 目標
  TARGETS: {
    ERROR_RATE: 5, // 錯誤率目標 < 5%
    REVIEW_TIME_HOURS: 24, // 審核時間目標 < 24 小時
    VENDOR_RATING: 4.0, // 外包商平均評分目標
  },
} as const

// 通用錯誤訊息（前端顯示用，不暴露技術細節）
export const ERROR_MESSAGES = {
  GENERIC: '操作失敗，請稍後再試',
  NETWORK: '網路連線異常，請檢查網路狀態',
  UNAUTHORIZED: '登入已過期，請重新登入',
  FORBIDDEN: '您沒有執行此操作的權限',
  NOT_FOUND: '找不到請求的資源',
  VALIDATION: '輸入資料格式不正確',
  FILE_TOO_LARGE: '檔案大小超過限制',
  UNSUPPORTED_FILE: '不支援的檔案格式',
} as const
