import { z } from 'zod';
import { IMAGE_UPLOAD_CONFIG, RETURN_POLICY } from '@/config/constants';

// Customer login validation
export const customerLoginSchema = z.object({
  orderNumber: z
    .string()
    .min(1, '請輸入訂單編號')
    .max(100, '訂單編號過長'),
  phone: z
    .string()
    .min(1, '請輸入手機號碼')
    .regex(/^09\d{8}$/, '請輸入有效的手機號碼格式 (09xxxxxxxx)'),
});

export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

// Return item selection
export const returnItemSchema = z.object({
  orderItemId: z.string().uuid('無效的商品ID'),
  quantity: z.number().min(1, '數量至少為1'),
  reason: z.string().min(1, '請選擇退貨原因'),
});

// Return application validation
export const returnApplySchema = z.object({
  orderId: z.string().uuid('無效的訂單ID'),
  reasonCategory: z.string().min(1, '請選擇退貨原因分類'),
  reasonDetail: z
    .string()
    .min(10, '請詳細說明退貨原因 (至少10字)')
    .max(1000, '說明過長'),
  returnShippingMethod: z.enum(['self_ship', 'convenience_store', 'company_pickup'], {
    message: '請選擇退回方式',
  }),
  selectedItems: z
    .array(returnItemSchema)
    .min(1, '請選擇至少一項要退貨的商品'),
});

export type ReturnApplyInput = z.infer<typeof returnApplySchema>;

// Image upload validation (for individual file)
export const imageUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => file.size <= IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES,
      `檔案大小不得超過 ${IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB`
    )
    .refine(
      (file) => IMAGE_UPLOAD_CONFIG.ACCEPTED_TYPES.includes(file.type as typeof IMAGE_UPLOAD_CONFIG.ACCEPTED_TYPES[number]),
      '僅接受 JPG, PNG, WebP, HEIC 格式'
    ),
  imageType: z.enum(['shipping_label', 'product_damage', 'outer_box', 'inspection', 'other']),
});

// Multiple images validation (3-5 required)
export const imagesValidationSchema = z
  .array(imageUploadSchema)
  .min(IMAGE_UPLOAD_CONFIG.MIN_REQUIRED, `請上傳至少 ${IMAGE_UPLOAD_CONFIG.MIN_REQUIRED} 張照片`)
  .max(IMAGE_UPLOAD_CONFIG.MAX_ALLOWED, `最多上傳 ${IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張照片`);

// Inspection form validation
export const inspectionSchema = z.object({
  returnRequestId: z.string().uuid('無效的退貨單ID'),
  result: z.enum(['passed', 'failed'], {
    message: '請選擇驗貨結果',
  }),
  conditionGrade: z.enum(['A', 'B', 'C', 'D', 'F']).optional(),
  checklist: z.object({
    packaging_intact: z.boolean().nullable(),
    product_intact: z.boolean().nullable(),
    accessories_complete: z.boolean().nullable(),
    matches_photos: z.boolean().nullable(),
    resellable: z.boolean().nullable(),
  }),
  notes: z.string().max(2000, '備註過長').optional(),
  inspectorComment: z.string().max(2000, '評語過長').optional(),
});

export type InspectionInput = z.infer<typeof inspectionSchema>;

// Admin status update validation
export const statusUpdateSchema = z.object({
  returnRequestId: z.string().uuid('無效的退貨單ID'),
  newStatus: z.enum([
    'pending_review',
    'approved_waiting_shipping',
    'shipping_in_transit',
    'received_inspecting',
    'abnormal_disputed',
    'refund_processing',
    'completed',
  ]),
  notes: z.string().max(2000).optional(),
  trackingNumber: z.string().max(100).optional(),
  logisticsCompany: z.string().max(100).optional(),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

// Refund processing validation
export const refundProcessSchema = z.object({
  returnRequestId: z.string().uuid('無效的退貨單ID'),
  refundType: z.enum(['original_payment', 'store_credit', 'bank_transfer']),
  refundAmount: z.number().min(0, '退款金額不得為負數'),
  notes: z.string().max(2000).optional(),
});

export type RefundProcessInput = z.infer<typeof refundProcessSchema>;

// Helper: Check if order is within return deadline
export function isWithinReturnDeadline(deliveredAt: string | null): boolean {
  if (!deliveredAt) return false;

  const deliveryDate = new Date(deliveredAt);
  const deadline = new Date(deliveryDate);
  deadline.setDate(deadline.getDate() + RETURN_POLICY.APPLICATION_DEADLINE_DAYS);

  return new Date() <= deadline;
}

// Helper: Get remaining days for return application
export function getRemainingDays(deliveredAt: string | null): number {
  if (!deliveredAt) return 0;

  const deliveryDate = new Date(deliveredAt);
  const deadline = new Date(deliveryDate);
  deadline.setDate(deadline.getDate() + RETURN_POLICY.APPLICATION_DEADLINE_DAYS);

  const remaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, remaining);
}
