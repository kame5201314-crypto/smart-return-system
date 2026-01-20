/**
 * Smart Return System - Business Logic Constants
 * All business rules and configurations are centralized here
 */

// =====================================================
// Return Status Machine (7 Stages - Andy's Version)
// =====================================================
export const RETURN_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED_WAITING_SHIPPING: 'approved_waiting_shipping',
  SHIPPING_IN_TRANSIT: 'shipping_in_transit',
  RECEIVED_INSPECTING: 'received_inspecting',
  ABNORMAL_DISPUTED: 'abnormal_disputed',
  REFUND_PROCESSING: 'refund_processing',
  COMPLETED: 'completed',
} as const;

export const RETURN_STATUS_LABELS: Record<string, string> = {
  [RETURN_STATUS.PENDING_REVIEW]: '待審核',
  [RETURN_STATUS.APPROVED_WAITING_SHIPPING]: '審核通過，待寄回',
  [RETURN_STATUS.SHIPPING_IN_TRANSIT]: '退貨運輸中',
  [RETURN_STATUS.RECEIVED_INSPECTING]: '倉庫驗收中',
  [RETURN_STATUS.ABNORMAL_DISPUTED]: '異常/爭議',
  [RETURN_STATUS.REFUND_PROCESSING]: '退款處理中',
  [RETURN_STATUS.COMPLETED]: '已結案',
};

export const RETURN_STATUS_COLORS: Record<string, string> = {
  [RETURN_STATUS.PENDING_REVIEW]: 'bg-yellow-100 text-yellow-800',
  [RETURN_STATUS.APPROVED_WAITING_SHIPPING]: 'bg-blue-100 text-blue-800',
  [RETURN_STATUS.SHIPPING_IN_TRANSIT]: 'bg-purple-100 text-purple-800',
  [RETURN_STATUS.RECEIVED_INSPECTING]: 'bg-orange-100 text-orange-800',
  [RETURN_STATUS.ABNORMAL_DISPUTED]: 'bg-red-100 text-red-800',
  [RETURN_STATUS.REFUND_PROCESSING]: 'bg-indigo-100 text-indigo-800',
  [RETURN_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
};

// Status flow order for progress display
export const RETURN_STATUS_ORDER = [
  RETURN_STATUS.PENDING_REVIEW,
  RETURN_STATUS.APPROVED_WAITING_SHIPPING,
  RETURN_STATUS.SHIPPING_IN_TRANSIT,
  RETURN_STATUS.RECEIVED_INSPECTING,
  RETURN_STATUS.REFUND_PROCESSING,
  RETURN_STATUS.COMPLETED,
] as const;

// =====================================================
// Channel Sources
// =====================================================
export const CHANNELS = {
  OFFICIAL: { key: 'official', label: '官網', canApplyReturn: true },
  SHOPEE: { key: 'shopee', label: '蝦皮', canApplyReturn: false },
  SHOPEE_MALL: { key: 'shopee_mall', label: '蝦皮商城', canApplyReturn: false },
  OTHER: { key: 'other', label: '其他', canApplyReturn: true },
} as const;

export const CHANNEL_LIST = Object.values(CHANNELS);

// =====================================================
// Logistics Tracking Links
// =====================================================
export const LOGISTICS_PROVIDERS = [
  { key: '711', label: '7-11 交貨便', url: 'https://eservice.7-11.com.tw/e-tracking/search.aspx', icon: '🏪' },
  { key: 'family', label: '全家店到店', url: 'https://fmec.famiport.com.tw/FP_Entrance/QueryBox', icon: '🏬' },
  { key: 'hct', label: '新竹物流', url: 'https://www.hct.com.tw/search/searchgoods_n.aspx', icon: '🚛' },
  { key: 'post', label: '中華郵政', url: 'https://postserv.post.gov.tw/pstmail/main_mail.html', icon: '📮' },
  { key: 'tcat', label: '黑貓宅急便', url: 'https://www.t-cat.com.tw/inquire/trace.aspx', icon: '🐱' },
] as const;

// =====================================================
// Refund Types (Strategy: Guide to store credit)
// =====================================================
export const REFUND_TYPES = {
  ORIGINAL_PAYMENT: { key: 'original_payment', label: '原路退刷' },
  STORE_CREDIT: { key: 'store_credit', label: '轉為購物金', recommended: true },
  BANK_TRANSFER: { key: 'bank_transfer', label: '銀行轉帳' },
  PENDING: { key: 'pending', label: '待決定' },
} as const;

// =====================================================
// Return Shipping Methods
// =====================================================
export const RETURN_SHIPPING_METHODS = {
  SELF_SHIP: { key: 'self_ship', label: '客戶自行寄回', description: '請將商品寄至指定地址' },
  CONVENIENCE_STORE: { key: 'convenience_store', label: '超商交貨便', description: '至超商寄送，免運費' },
  COMPANY_PICKUP: { key: 'company_pickup', label: '公司派車回收', description: '我們將安排取件' },
} as const;

// =====================================================
// Return Reasons
// =====================================================
export const RETURN_REASONS = {
  QUALITY_ISSUE: { key: 'quality_issue', label: '品質問題', aiTag: 'product_quality' },
  WRONG_ITEM: { key: 'wrong_item', label: '商品錯誤', aiTag: 'fulfillment_error' },
  DAMAGED_IN_TRANSIT: { key: 'damaged_in_transit', label: '運送損壞', aiTag: 'logistics_damage' },
  NOT_AS_DESCRIBED: { key: 'not_as_described', label: '與描述不符', aiTag: 'listing_mismatch' },
  CHANGE_OF_MIND: { key: 'change_of_mind', label: '改變心意', aiTag: 'customer_preference' },
  INSTALLATION_ISSUE: { key: 'installation_issue', label: '安裝問題', aiTag: 'user_education' },
  DEFECTIVE: { key: 'defective', label: '商品故障', aiTag: 'product_defect' },
  SIZE_NOT_FIT: { key: 'size_not_fit', label: '尺寸不合', aiTag: 'size_mismatch' },
  PRODUCT_ISSUE: { key: 'product_issue', label: '產品問題', aiTag: 'product_issue' },
  OTHER: { key: 'other', label: '其他', aiTag: 'other' },
} as const;

export const RETURN_REASON_LIST = Object.values(RETURN_REASONS);

// =====================================================
// Image Upload Rules (Andy's Requirement: 3-5 photos)
// =====================================================
export const IMAGE_UPLOAD_CONFIG = {
  MIN_REQUIRED: 3,
  MAX_ALLOWED: 5,
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  ACCEPTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
} as const;

export const REQUIRED_IMAGE_TYPES = [
  { type: 'shipping_label', label: '物流面單', required: true },
  { type: 'product_damage', label: '商品狀況', required: true },
  { type: 'outer_box', label: '外箱狀況', required: true },
] as const;

// =====================================================
// Return Policy Settings
// =====================================================
export const RETURN_POLICY = {
  // Return application deadline (days after delivery)
  APPLICATION_DEADLINE_DAYS: 7,

  // Inspection time limit (days after receiving)
  INSPECTION_DEADLINE_DAYS: 3,

  // Refund processing time limit (days after inspection passed)
  REFUND_DEADLINE_DAYS: 7,
} as const;

// =====================================================
// Inspection Grades
// =====================================================
export const INSPECTION_GRADES = {
  A: { key: 'A', label: '完好如新', description: '可直接重新銷售', resellable: true },
  B: { key: 'B', label: '輕微使用痕跡', description: '清潔後可銷售', resellable: true },
  C: { key: 'C', label: '明顯使用痕跡', description: '需折價銷售', resellable: true },
  D: { key: 'D', label: '功能受損', description: '需維修', resellable: false },
  F: { key: 'F', label: '無法使用', description: '報廢處理', resellable: false },
} as const;

// =====================================================
// Inspection Checklist
// =====================================================
export const INSPECTION_CHECKLIST = [
  { key: 'packaging_intact', label: '包裝完整' },
  { key: 'product_intact', label: '商品完好' },
  { key: 'accessories_complete', label: '配件齊全' },
  { key: 'matches_photos', label: '與上傳照片相符' },
  { key: 'resellable', label: '可重新銷售' },
] as const;

// =====================================================
// User Roles
// =====================================================
export const USER_ROLES = {
  ADMIN: { key: 'admin', label: '管理員', permissions: ['*'] },
  STAFF: { key: 'staff', label: '員工', permissions: ['view', 'edit', 'inspect'] },
} as const;

// =====================================================
// Kanban Board Configuration
// =====================================================
export const KANBAN_COLUMNS = [
  {
    id: 'pending_inspection',
    title: '待驗收',
    color: 'border-yellow-400',
    statuses: [
      RETURN_STATUS.PENDING_REVIEW,
      RETURN_STATUS.APPROVED_WAITING_SHIPPING,
      RETURN_STATUS.SHIPPING_IN_TRANSIT,
      RETURN_STATUS.RECEIVED_INSPECTING,
      RETURN_STATUS.REFUND_PROCESSING
    ]
  },
  {
    id: RETURN_STATUS.COMPLETED,
    title: '已結案',
    color: 'border-green-400',
    statuses: [RETURN_STATUS.COMPLETED]
  },
  {
    id: RETURN_STATUS.ABNORMAL_DISPUTED,
    title: '驗收異常',
    color: 'border-red-400',
    statuses: [RETURN_STATUS.ABNORMAL_DISPUTED]
  },
];

// =====================================================
// AI Analysis Configuration
// =====================================================
export const AI_ANALYSIS_CONFIG = {
  // Fields to include in AI prompt
  PROMPT_FIELDS: ['product_name', 'reason_category', 'reason_detail', 'inspection_notes', 'channel_source'],

  // Report sections
  REPORT_SECTIONS: [
    { key: 'pain_points', label: '核心痛點診斷' },
    { key: 'recommendations', label: '優化建議' },
    { key: 'sku_analysis', label: 'SKU 分析' },
    { key: 'channel_analysis', label: '通路分析' },
    { key: 'trend_analysis', label: '趨勢分析' },
  ],
} as const;

// =====================================================
// Navigation Configuration
// =====================================================
export const ADMIN_NAV_ITEMS = [
  { href: '/dashboard', label: '總覽', icon: 'LayoutDashboard' },
  { href: '/returns', label: '退貨管理', icon: 'Package' },
  { href: '/orders', label: '訂單查詢', icon: 'ShoppingCart' },
  { href: '/analytics', label: '數據中心', icon: 'BarChart3' },
  { href: '/analytics/ai-report', label: 'AI 分析', icon: 'Brain' },
  { href: '/settings', label: '系統設定', icon: 'Settings' },
] as const;

// =====================================================
// Error Messages (Generic - No sensitive info)
// =====================================================
export const ERROR_MESSAGES = {
  GENERIC: '操作失敗，請稍後再試',
  UNAUTHORIZED: '請先登入',
  FORBIDDEN: '您沒有權限執行此操作',
  NOT_FOUND: '找不到相關資料',
  VALIDATION: '請檢查輸入資料',
  UPLOAD_FAILED: '檔案上傳失敗',
  SHOPEE_REDIRECT: '蝦皮訂單請至蝦皮 App 處理退貨',
  RETURN_EXPIRED: '已超過退貨申請期限',
  INSUFFICIENT_IMAGES: `請上傳 ${IMAGE_UPLOAD_CONFIG.MIN_REQUIRED}-${IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張照片`,
} as const;
