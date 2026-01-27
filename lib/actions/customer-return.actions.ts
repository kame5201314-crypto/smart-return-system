'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

// ========== Zod 驗證 Schema ==========
const customerReturnSchema = z.object({
  channelSource: z.string().min(1, '請選擇購買通路').max(50),
  accountId: z.string().min(1, '請填寫帳號').max(100),
  orderNumber: z.string().min(1, '請填寫訂單編號').max(100),
  ordererName: z.string().min(1, '請填寫訂購人姓名').max(50),
  receiverName: z.string().max(50).optional(),
  phone: z.string().regex(/^09\d{8}$/, '請輸入有效的手機號碼'),
  returnProducts: z.array(z.string().max(100)).optional(),
  reasonCategory: z.string().max(50).optional(),
  returnReason: z.string().min(1, '請填寫退貨原因').max(2000),
  productSuggestion: z.string().max(2000).optional(),
});

// ========== 簡易速率限制 ==========
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 小時
const RATE_LIMIT_MAX_REQUESTS = 5; // 每小時最多 5 次提交

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

// 定期清理過期的速率限制記錄
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000); // 每 10 分鐘清理一次

export interface CustomerReturnFormData {
  channelSource: string;
  accountId: string;
  orderNumber: string;
  ordererName: string;
  receiverName?: string;
  phone: string;
  returnProducts?: string[];
  reasonCategory?: string;
  returnReason: string;
  productSuggestion?: string;
}

/**
 * Submit customer return request from the simplified portal form
 * Optimized for speed with parallel operations
 *
 * @param formData - Form data from the customer
 * @param imageFiles - Either base64 encoded images OR already uploaded image URLs
 */
export async function submitCustomerReturn(
  formData: CustomerReturnFormData,
  imageFiles: { name: string; type: string; base64: string }[] | { publicUrl: string; storagePath: string }[]
): Promise<ApiResponse<{ requestNumber: string }>> {
  try {
    // ========== 1. Zod 驗證 ==========
    const validationResult = customerReturnSchema.safeParse(formData);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues[0]?.message || '輸入資料格式錯誤';
      return { success: false, error: errorMessage };
    }

    // ========== 2. 速率限制 ==========
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for')?.split(',')[0] ||
                     headersList.get('x-real-ip') ||
                     'unknown';
    // 同時用 IP 和手機號碼做限制
    const rateLimitKey = `${clientIP}-${formData.phone}`;
    const rateCheck = checkRateLimit(rateLimitKey);

    if (!rateCheck.allowed) {
      return { success: false, error: '提交次數過多，請稍後再試（每小時最多 5 次）' };
    }

    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      return { success: false, error: '伺服器設定錯誤，請稍後再試' };
    }

    // 1. Find or create customer and order in parallel
    let customerResult, orderResult;
    try {
      [customerResult, orderResult] = await Promise.all([
        // Find existing customer
        adminClient
          .from('customers')
          .select('id')
          .eq('phone', formData.phone)
          .single()
          .then(res => res as { data: { id: string } | null; error: Error | null }),
        // Find existing order
        adminClient
          .from('orders')
          .select('id')
          .eq('order_number', formData.orderNumber)
          .single()
          .then(res => res as { data: { id: string } | null; error: Error | null }),
      ]);
    } catch {
      return { success: false, error: '資料庫連線失敗，請稍後再試' };
    }

    let customerId: string | null = customerResult.data?.id || null;
    let orderId: string | null = orderResult.data?.id || null;

    // Create customer if not exists
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await adminClient
        .from('customers')
        .insert({
          phone: formData.phone,
          name: formData.ordererName,
        } as never)
        .select('id')
        .single() as { data: { id: string } | null; error: Error | null };

      if (customerError) {
        return { success: false, error: '建立客戶記錄失敗，請稍後再試' };
      }
      customerId = newCustomer?.id || null;
    }

    // Create order if not exists
    if (!orderId) {
      const orderChannelSource = ['shopee', 'official', 'momo', 'dealer', 'other'].includes(formData.channelSource)
        ? formData.channelSource
        : 'other';

      const { data: newOrder, error: orderError } = await adminClient
        .from('orders')
        .insert({
          order_number: formData.orderNumber,
          customer_id: customerId,
          customer_phone: formData.phone,
          customer_name: formData.ordererName,
          channel_source: orderChannelSource,
          status: 'delivered',
          metadata: {
            account_id: formData.accountId,
            source_channel_raw: formData.channelSource,
          },
        } as never)
        .select('id')
        .single() as { data: { id: string } | null; error: Error | null };

      if (orderError || !newOrder) {
        return { success: false, error: `建立訂單記錄失敗: ${orderError?.message || '未知錯誤'}` };
      }
      orderId = newOrder.id;
    }

    // 2. Create return request
    const validChannelSource = ['shopee', 'official', 'momo', 'dealer', 'other'].includes(formData.channelSource)
      ? formData.channelSource
      : 'other';

    // Map reason category to valid database values
    const validReasonCategories = ['quality_issue', 'wrong_item', 'damaged_in_transit', 'not_as_described', 'change_of_mind', 'installation_issue', 'defective', 'size_not_fit', 'other'];
    const reasonCategory = validReasonCategories.includes(formData.reasonCategory || '')
      ? formData.reasonCategory
      : 'other';

    const { data: returnRequest, error: returnError } = await adminClient
      .from('return_requests')
      .insert({
        order_id: orderId,
        customer_id: customerId,
        channel_source: validChannelSource,
        status: 'pending_review',
        reason_category: reasonCategory,
        reason_detail: formData.returnReason,
        review_notes: formData.productSuggestion || null,
      } as never)
      .select('id, request_number')
      .single() as { data: { id: string; request_number: string } | null; error: Error | null };

    if (returnError || !returnRequest) {
      return { success: false, error: `建立退貨申請失敗: ${returnError?.message || '未知錯誤'}` };
    }

    // 3. Handle images - either already uploaded URLs or base64 data
    let uploadedImages: { url: string; storagePath: string }[] = [];

    // Check if images are already uploaded (have publicUrl) or need to be uploaded (have base64)
    const isPreUploaded = imageFiles.length > 0 && 'publicUrl' in imageFiles[0];

    if (isPreUploaded) {
      // Images are already uploaded to Supabase Storage
      uploadedImages = (imageFiles as { publicUrl: string; storagePath: string }[]).map((img) => ({
        url: img.publicUrl,
        storagePath: img.storagePath,
      }));
    } else {
      // Upload images in PARALLEL (legacy base64 method)
      const uploadPromises = (imageFiles as { name: string; type: string; base64: string }[]).map(async (file, i) => {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${returnRequest.id}/${Date.now()}_${i}.${fileExt}`;

        // Decode base64 to buffer
        const base64Data = file.base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Upload to Supabase Storage
        const { error: uploadError } = await adminClient.storage
          .from('return-images')
          .upload(fileName, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          return null;
        }

        // Get public URL
        const { data: urlData } = adminClient.storage
          .from('return-images')
          .getPublicUrl(fileName);

        return {
          url: urlData.publicUrl,
          storagePath: fileName,
        };
      });

      // Wait for all uploads to complete in parallel
      const uploadResults = await Promise.all(uploadPromises);
      uploadedImages = uploadResults.filter((img): img is { url: string; storagePath: string } => img !== null);
    }

    // 4. Create all remaining records in parallel
    // Image records
    const insertImagesPromise = uploadedImages.length > 0
      ? adminClient.from('return_images').insert(
          uploadedImages.map((img) => ({
            return_request_id: returnRequest.id,
            image_url: img.url,
            storage_path: img.storagePath,
            image_type: 'product_damage' as const,
            uploaded_by: 'customer' as const,
          })) as never
        )
      : Promise.resolve();

    // Return item record - use selected products or default to order number
    const productName = formData.returnProducts && formData.returnProducts.length > 0
      ? formData.returnProducts.join(', ')
      : `訂單 ${formData.orderNumber} 商品`;

    const insertItemPromise = adminClient.from('return_items').insert({
      return_request_id: returnRequest.id,
      product_name: productName,
      quantity: 1,
      reason: formData.returnReason,
    } as never);

    // Activity log
    const insertLogPromise = adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: returnRequest.id,
      action: 'created',
      actor_type: 'customer',
      description: `客戶自助退貨申請: ${returnRequest.request_number}`,
      new_value: {
        channel: formData.channelSource,
        order_number: formData.orderNumber,
        customer_name: formData.ordererName,
        phone: formData.phone,
        return_products: formData.returnProducts || [],
        reason: formData.returnReason,
        images_count: uploadedImages.length,
      },
    } as never);

    // Execute all DB operations in parallel with error tracking
    const [imagesResult, itemResult, logResult] = await Promise.allSettled([
      insertImagesPromise,
      insertItemPromise,
      insertLogPromise,
    ]);

    // Check for partial failures (non-critical, return_request already created)
    const failures: string[] = [];
    if (imagesResult.status === 'rejected' || (imagesResult.status === 'fulfilled' && (imagesResult.value as { error?: unknown })?.error)) {
      failures.push('圖片記錄');
    }
    if (itemResult.status === 'rejected' || (itemResult.status === 'fulfilled' && (itemResult.value as { error?: unknown })?.error)) {
      failures.push('商品記錄');
    }
    if (logResult.status === 'rejected' || (logResult.status === 'fulfilled' && (logResult.value as { error?: unknown })?.error)) {
      failures.push('活動記錄');
    }

    // Return success even with partial failures (main return_request was created)
    if (failures.length > 0) {
      console.error(`Partial insert failures for ${returnRequest.request_number}:`, failures);
      return {
        success: true,
        data: { requestNumber: returnRequest.request_number },
        message: `退貨申請已送出，但部分資料（${failures.join('、')}）可能未完整儲存`,
      };
    }

    return {
      success: true,
      data: { requestNumber: returnRequest.request_number },
      message: '退貨申請已成功送出',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';

    // Check for common database errors
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return { success: false, error: '資料庫表格尚未建立，請聯繫管理員' };
    }
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      return { success: false, error: '資料庫權限不足，請聯繫管理員' };
    }
    if (errorMessage.includes('Missing Supabase')) {
      return { success: false, error: '伺服器環境變數未設定，請聯繫管理員' };
    }
    return { success: false, error: '系統錯誤，請稍後再試' };
  }
}

interface ReturnListResult {
  id: string;
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_detail: string | null;
  created_at: string;
  approved_at?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  refund_processed_at?: string | null;
  closed_at?: string | null;
  order?: {
    order_number: string;
    customer_name: string | null;
  } | null;
  return_images?: {
    id: string;
    image_url: string;
    image_type: string | null;
  }[];
}

/**
 * Search return requests by phone number
 */
export async function searchReturnsByPhone(phone: string): Promise<{ success: boolean; data?: ReturnListResult[]; error?: string }> {
  try {
    const adminClient = createAdminClient();

    // First find orders with this phone number
    const { data: orders, error: ordersError } = await adminClient
      .from('orders')
      .select('id')
      .eq('customer_phone', phone) as { data: { id: string }[] | null; error: Error | null };

    if (ordersError || !orders || orders.length === 0) {
      return { success: true, data: [] };
    }

    const orderIds = orders.map(o => o.id);

    // Then find return requests for these orders
    const { data, error } = await adminClient
      .from('return_requests')
      .select(`
        id,
        request_number,
        status,
        channel_source,
        reason_detail,
        created_at,
        approved_at,
        shipped_at,
        received_at,
        refund_processed_at,
        closed_at,
        order:orders (
          order_number,
          customer_name
        ),
        return_images (
          id,
          image_url,
          image_type
        )
      `)
      .in('order_id', orderIds)
      .order('created_at', { ascending: false }) as { data: ReturnListResult[] | null; error: Error | null };

    if (error) {
      return { success: false, error: '查詢失敗' };
    }

    return { success: true, data: data || [] };
  } catch {
    return { success: false, error: '系統錯誤' };
  }
}

interface ReturnSearchResult {
  id: string;
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_detail: string | null;
  created_at: string;
  approved_at?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  refund_processed_at?: string | null;
  closed_at?: string | null;
  order?: {
    order_number: string;
    customer_name: string | null;
  } | null;
  return_images?: {
    id: string;
    image_url: string;
    image_type: string | null;
  }[];
}

/**
 * Search return request by request number
 */
export async function searchReturnByNumber(requestNumber: string): Promise<{ success: boolean; data?: ReturnSearchResult; error?: string }> {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('return_requests')
      .select(`
        id,
        request_number,
        status,
        channel_source,
        reason_detail,
        created_at,
        approved_at,
        shipped_at,
        received_at,
        refund_processed_at,
        closed_at,
        order:orders (
          order_number,
          customer_name
        ),
        return_images (
          id,
          image_url,
          image_type
        )
      `)
      .eq('request_number', requestNumber)
      .single() as { data: ReturnSearchResult | null; error: Error | null };

    if (error || !data) {
      return { success: false, error: '找不到此退貨單號' };
    }

    return { success: true, data };
  } catch {
    return { success: false, error: '系統錯誤' };
  }
}
