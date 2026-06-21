'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';
import {
  getExtensionFromMimeType,
  validateImageBlob,
  verifyUploadSessionToken,
  UPLOAD_MAX_FILE_SIZE_BYTES,
} from '@/lib/upload/security';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import { resolvePortalOrg } from '@/lib/saas/portal-tenant';
import {
  attachReturnImageSignedUrls,
  createReturnImageSignedUrl,
} from '@/lib/storage/return-images';

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

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
// Coarse per-IP cap to bound unauthenticated organization lookups before the
// finer (org, phone, IP) portal-search check can run.
const PORTAL_SEARCH_IP_RATE_LIMIT = 30;

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

function isMissingColumnError(error: unknown, table: string, column: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes(`column ${table}.${column} does not exist`)
    || message.includes(`column ${table}_1.${column} does not exist`)
    || message.includes(`column ${table}_2.${column} does not exist`)
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

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

interface UploadSessionInput {
  draftId: string;
  sessionToken: string;
}

interface PreUploadedImageInput {
  publicUrl: string;
  storagePath: string;
}

interface Base64ImageInput {
  name: string;
  type: string;
  base64: string;
}

interface PreparedImageRecord {
  url: string;
  storagePath: string;
  imageType: 'shipping_label' | 'product_damage';
}

function isPreUploadedImageArray(
  imageFiles: Base64ImageInput[] | PreUploadedImageInput[]
): imageFiles is PreUploadedImageInput[] {
  return imageFiles.length > 0 && 'publicUrl' in imageFiles[0];
}

function inferImageTypeFromPath(storagePath: string): 'shipping_label' | 'product_damage' {
  return storagePath.includes('/shipping-labels/') ? 'shipping_label' : 'product_damage';
}

function getValidationTypeLabel(code?: string): string {
  if (!code) {
    return '未知';
  }
  if (code.includes('SIZE') || code.includes('LARGE')) {
    return '大小';
  }
  if (code.includes('CONTENT')) {
    return '內容';
  }
  if (code.includes('TYPE')) {
    return '類型';
  }
  return '格式';
}

async function withRetry<T>(
  task: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 250
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Operation failed');
}

async function validatePreUploadedImages(
  adminClient: ReturnType<typeof createAdminClient>,
  images: PreUploadedImageInput[],
  draftId: string,
  orgId: string
): Promise<{ success: true } | { success: false; error: string }> {
  // Only accept objects staged under this tenant's org-scoped draft prefix. A
  // non-org-prefixed or cross-tenant staging path is rejected.
  const requiredPrefix = `staging/${orgId}/${draftId}/`;

  for (const [index, image] of images.entries()) {
    if (!image.storagePath || typeof image.storagePath !== 'string') {
      return {
        success: false,
        error: `第 ${index + 1} 張圖片驗證失敗（路徑）：缺少 storagePath`,
      };
    }

    if (!image.storagePath.startsWith(requiredPrefix)) {
      return {
        success: false,
        error: `第 ${index + 1} 張圖片驗證失敗（來源）：圖片不屬於本次上傳草稿`,
      };
    }

    // Reject path-traversal segments so isolation does not rely on how the
    // storage backend happens to treat `..` in object keys.
    if (image.storagePath.includes('..') || image.storagePath.includes('\\')) {
      return {
        success: false,
        error: `第 ${index + 1} 張圖片驗證失敗（路徑）：路徑格式不正確`,
      };
    }

    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from('return-images')
      .download(image.storagePath);

    if (downloadError || !fileBlob) {
      return {
        success: false,
        error: `第 ${index + 1} 張圖片驗證失敗（讀取）：${downloadError?.message || '找不到檔案'}`,
      };
    }

    const validation = await validateImageBlob(fileBlob, UPLOAD_MAX_FILE_SIZE_BYTES);
    if (!validation.ok) {
      return {
        success: false,
        error: `第 ${index + 1} 張圖片驗證失敗（${getValidationTypeLabel(validation.code)}）：${validation.reason || '不符合上傳規範'}`,
      };
    }
  }

  return { success: true };
}

/**
 * Submit customer return request from portal form
 * - Pre-uploaded image flow: verify session + validate staged files, then move to final path after request is created.
 * - Legacy base64 flow: keep compatibility and upload with short retry.
 */
export async function submitCustomerReturn(
  formData: CustomerReturnFormData,
  imageFiles: Base64ImageInput[] | PreUploadedImageInput[],
  uploadSession?: UploadSessionInput,
  orgSlug?: string
): Promise<ApiResponse<{ requestNumber: string }>> {
  try {
    const validationResult = customerReturnSchema.safeParse(formData);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues[0]?.message || '輸入資料格式錯誤';
      return { success: false, error: errorMessage };
    }

    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for')?.split(',')[0]
      || headersList.get('x-real-ip')
      || 'unknown';

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

    // Tenant is identified by the store's org slug from the portal URL, never by
    // a client-supplied org id nor by a cross-tenant global order search. Fail
    // closed when the slug is missing or unknown.
    const portalOrg = await resolvePortalOrg(orgSlug);
    if (!portalOrg) {
      return { success: false, error: '查無此商店，請使用商店提供的退貨連結' };
    }
    const orgId = portalOrg.orgId;

    let orderResult;
    try {
      orderResult = await adminClient
        .from('orders')
        .select('id, org_id, customer_id, metadata')
        .eq('org_id', orgId)
        .eq('order_number', formData.orderNumber)
        .eq('customer_phone', formData.phone)
        .limit(2)
        .then((res) => res as {
          data: {
            id: string;
            org_id?: string | null;
            customer_id?: string | null;
            metadata?: unknown;
          }[] | null;
          error: Error | null;
        });
    } catch {
      return { success: false, error: '資料庫連線失敗，請稍後再試' };
    }

    if (orderResult.error) {
      return { success: false, error: '查詢訂單資料失敗，請稍後再試' };
    }

    const orderRows = orderResult.data || [];
    if (orderRows.length === 0) {
      return { success: false, error: '找不到符合的訂單資料，請確認訂單編號與手機或聯絡客服' };
    }

    const orderRow = orderRows[0];

    let customerId: string | null = orderRow.customer_id || null;
    const orderId: string = orderRow.id;

    if (!customerId) {
      const customerResult = await adminClient
        .from('customers')
        .select('id')
        .eq('org_id', orgId)
        .eq('phone', formData.phone)
        .single()
        .then((res) => res as { data: { id: string } | null; error: Error | null });

      customerId = customerResult.data?.id || null;
    }

    if (!customerId) {
      const { data: newCustomer, error: customerError } = await adminClient
        .from('customers')
        .insert({
          org_id: orgId,
          phone: formData.phone,
          name: formData.ordererName,
        } as never)
        .select('id')
        .single() as { data: { id: string } | null; error: Error | null };

      if (customerError) {
        return { success: false, error: '建立客戶資料失敗，請稍後再試' };
      }
      customerId = newCustomer?.id || null;
    }

    {
      const currentMetadata = toRecord(orderRow.metadata);
      const nextAccountId = formData.accountId.trim();

      if (nextAccountId && currentMetadata.account_id !== nextAccountId) {
        const mergedMetadata: Record<string, unknown> = {
          ...currentMetadata,
          account_id: nextAccountId,
        };

        if (typeof currentMetadata.source_channel_raw !== 'string' || !currentMetadata.source_channel_raw.trim()) {
          mergedMetadata.source_channel_raw = formData.channelSource;
        }

        const { error: updateOrderMetadataError } = await adminClient
          .from('orders')
          .update({ metadata: mergedMetadata } as never)
          .eq('org_id', orgId)
          .eq('id', orderId);

        if (updateOrderMetadataError) {
          return { success: false, error: '更新客戶帳號資料失敗，請稍後再試' };
        }
      }
    }

    const isPreUploaded = isPreUploadedImageArray(imageFiles);

    if (isPreUploaded) {
      if (!uploadSession?.draftId || !uploadSession?.sessionToken) {
        return { success: false, error: '上傳工作階段遺失，請重新上傳照片後再送出' };
      }

      const sessionVerification = verifyUploadSessionToken(uploadSession.sessionToken);
      if (!sessionVerification.valid || !sessionVerification.payload) {
        return { success: false, error: sessionVerification.error || '上傳工作階段已失效，請重新上傳照片' };
      }

      if (sessionVerification.payload.draftId !== uploadSession.draftId) {
        return { success: false, error: '上傳草稿與工作階段不一致，請重新上傳照片' };
      }

      // Defense-in-depth: assert the (HMAC-signed) upload token is bound to the
      // same tenant we resolved from the store slug, rather than relying solely
      // on the org-scoped staging-path check below.
      if ((sessionVerification.payload.orgId ?? '').trim() !== orgId) {
        return { success: false, error: '上傳工作階段與商店不一致，請重新上傳照片' };
      }

      const imageValidation = await validatePreUploadedImages(adminClient, imageFiles, uploadSession.draftId, orgId);
      if (!imageValidation.success) {
        return { success: false, error: imageValidation.error };
      }
    }

    const validChannelSource = ['shopee', 'official', 'momo', 'dealer', 'other'].includes(formData.channelSource)
      ? formData.channelSource
      : 'other';

    const validReasonCategories = [
      'quality_issue',
      'wrong_item',
      'damaged_in_transit',
      'not_as_described',
      'change_of_mind',
      'installation_issue',
      'defective',
      'size_not_fit',
      'other',
    ];
    const reasonCategory = validReasonCategories.includes(formData.reasonCategory || '')
      ? formData.reasonCategory
      : 'other';

    const { data: returnRequest, error: returnError } = await adminClient
      .from('return_requests')
      .insert({
        org_id: orgId,
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

    let uploadedImages: PreparedImageRecord[] = [];

    if (isPreUploaded) {
      const movedPaths: string[] = [];

      try {
        uploadedImages = await Promise.all(
          imageFiles.map(async (image, index) => {
            const { data: fileBlob, error: downloadError } = await adminClient.storage
              .from('return-images')
              .download(image.storagePath);

            if (downloadError || !fileBlob) {
              throw new Error(`第 ${index + 1} 張照片暫存檔遺失，請重新上傳`);
            }

            const validation = await validateImageBlob(fileBlob, UPLOAD_MAX_FILE_SIZE_BYTES);
            if (!validation.ok || !validation.detectedMime) {
              throw new Error(`第 ${index + 1} 張照片內容驗證失敗：${validation.reason || '格式不符合規範'}`);
            }

            const extension = getExtensionFromMimeType(validation.detectedMime);
            const targetPath = `returns/${orgId}/${returnRequest.id}/${Date.now()}_${index}_${crypto.randomUUID().slice(0, 8)}.${extension}`;

            await withRetry(async () => {
              const { error: moveError } = await adminClient.storage
                .from('return-images')
                .move(image.storagePath, targetPath);

              if (moveError) {
                throw new Error(moveError.message);
              }
            });

            movedPaths.push(targetPath);

            // Persist storage_path as the source of truth; store a short-lived
            // signed URL (not a permanent public URL) in image_url. Reads always
            // re-sign from storage_path, so the bucket can be made private.
            const signedUrl = await createReturnImageSignedUrl(targetPath);

            return {
              url: signedUrl ?? '',
              storagePath: targetPath,
              imageType: inferImageTypeFromPath(image.storagePath),
            } as PreparedImageRecord;
          })
        );
      } catch (error) {
        if (movedPaths.length > 0) {
          await adminClient.storage.from('return-images').remove(movedPaths);
        }
        await adminClient.from('return_requests').delete().eq('org_id', orgId).eq('id', returnRequest.id);

        return {
          success: false,
          error: error instanceof Error
            ? `上傳照片處理失敗：${error.message}`
            : '上傳照片處理失敗，請重新上傳後再送出',
        };
      }
    } else {
      const base64Images = imageFiles as Base64ImageInput[];

      const uploadPromises = base64Images.map(async (file, index) => {
        const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `returns/${orgId}/${returnRequest.id}/${Date.now()}_${index}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

        const base64Data = file.base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        await withRetry(async () => {
          const { error: uploadError } = await adminClient.storage
            .from('return-images')
            .upload(fileName, buffer, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }
        });

        // Persist storage_path as the source of truth; store a short-lived
        // signed URL (not a permanent public URL) in image_url. Reads always
        // re-sign from storage_path, so the bucket can be made private.
        const signedUrl = await createReturnImageSignedUrl(fileName);

        return {
          url: signedUrl ?? '',
          storagePath: fileName,
          imageType: 'product_damage' as const,
        };
      });

      uploadedImages = await Promise.all(uploadPromises);
    }

    const insertImagesPromise = uploadedImages.length > 0
      ? adminClient.from('return_images').insert(
          uploadedImages.map((img) => ({
            org_id: orgId,
            return_request_id: returnRequest.id,
            image_url: img.url,
            storage_path: img.storagePath,
            image_type: img.imageType,
            uploaded_by: 'customer' as const,
          })) as never
        )
      : Promise.resolve();

    const productName = formData.returnProducts && formData.returnProducts.length > 0
      ? formData.returnProducts.join(', ')
      : `訂單 ${formData.orderNumber} 商品`;

    const insertItemPromise = (async () => {
      const itemPayload: Record<string, unknown> = {
        org_id: orgId,
        return_request_id: returnRequest.id,
        product_name: productName,
        quantity: 1,
        reason: formData.returnReason,
        resolution_type: 'full',
      };

      const firstTry = await adminClient
        .from('return_items')
        .insert(itemPayload as never);
      if (!firstTry.error) {
        return firstTry;
      }

      if (!isMissingColumnError(firstTry.error, 'return_items', 'resolution_type')) {
        return firstTry;
      }

      await emitSchemaDriftAlert({
        source: 'customer-return.submitCustomerReturn.insertItem',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: firstTry.error.message,
        context: { returnRequestId: returnRequest.id },
      });

      const fallbackPayload = { ...itemPayload };
      delete fallbackPayload.resolution_type;
      return adminClient
        .from('return_items')
        .insert(fallbackPayload as never);
    })();

    const insertLogPromise = adminClient.from('activity_logs').insert({
      org_id: orgId,
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

    const [imagesResult, itemResult, logResult] = await Promise.allSettled([
      insertImagesPromise,
      insertItemPromise,
      insertLogPromise,
    ]);

    const failures: string[] = [];
    if (imagesResult.status === 'rejected' || (imagesResult.status === 'fulfilled' && (imagesResult.value as { error?: unknown })?.error)) {
      failures.push('圖片資料');
    }
    if (itemResult.status === 'rejected' || (itemResult.status === 'fulfilled' && (itemResult.value as { error?: unknown })?.error)) {
      failures.push('商品資料');
    }
    if (logResult.status === 'rejected' || (logResult.status === 'fulfilled' && (logResult.value as { error?: unknown })?.error)) {
      failures.push('活動紀錄');
    }

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

    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return { success: false, error: '資料庫表格尚未建立，請聯絡管理員' };
    }
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      return { success: false, error: '資料庫權限不足，請聯絡管理員' };
    }
    if (errorMessage.includes('Missing Supabase')) {
      return { success: false, error: '伺服器環境變數未設定，請聯絡管理員' };
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
    storage_path?: string | null;
    image_type: string | null;
  }[];
}

export interface PortalReturnQuery {
  orgSlug: string;
  phone: string;
  requestNumber: string;
}

/**
 * Secure portal lookup. Requires THREE matching factors:
 *   1. orgSlug resolves to a real org (tenant is fixed server-side),
 *   2. the request number exists within that org,
 *   3. the phone on the matched order matches.
 * Every query is org-scoped; images come back as short-lived signed URLs and
 * the order phone is never echoed back. Any mismatch returns a generic empty
 * result so the endpoint cannot enumerate returns across tenants.
 */
export async function searchReturnForPortal(
  query: PortalReturnQuery
): Promise<{ success: boolean; data?: ReturnListResult[]; error?: string }> {
  try {
    const phone = String(query?.phone ?? '').trim();
    const requestNumber = String(query?.requestNumber ?? '').trim();

    if (!/^09\d{8}$/.test(phone)) {
      return { success: false, error: '請輸入有效的手機號碼' };
    }
    if (!requestNumber) {
      return { success: false, error: '請輸入退貨單號' };
    }

    // Coarse per-IP throttle BEFORE the organizations lookup, so an unknown or
    // spammed slug cannot drive unlimited unauthenticated DB round-trips.
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for')?.split(',')[0]
      || headersList.get('x-real-ip')
      || 'unknown';
    const ipRateCheck = checkRateLimit(`portal-search-ip-${clientIP}`, PORTAL_SEARCH_IP_RATE_LIMIT);
    if (!ipRateCheck.allowed) {
      return { success: false, error: '查詢次數過多，請稍後再試' };
    }

    const org = await resolvePortalOrg(query?.orgSlug);
    if (!org) {
      return { success: false, error: '無效的商店連結，請使用商店提供的查詢連結' };
    }

    const rateCheck = checkRateLimit(`portal-search-${org.orgId}-${phone}-${clientIP}`);
    if (!rateCheck.allowed) {
      return { success: false, error: '查詢次數過多，請稍後再試' };
    }

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
        order:orders!inner (
          order_number,
          customer_name,
          customer_phone
        ),
        return_images (
          id,
          image_url,
          storage_path,
          image_type
        )
      `)
      .eq('org_id', org.orgId)
      .eq('request_number', requestNumber)
      .maybeSingle() as {
        data: (ReturnListResult & { order?: { customer_phone?: string | null } | null }) | null;
        error: Error | null;
      };

    if (error) {
      return { success: false, error: '查詢失敗，請稍後再試' };
    }

    // Second factor: the phone on the matched order must match. Return a generic
    // empty result for any mismatch (no enumeration signal).
    if (!data || (data.order?.customer_phone ?? '') !== phone) {
      return { success: true, data: [] };
    }

    // Serve images via short-lived signed URLs derived from storage_path.
    await attachReturnImageSignedUrls(data.return_images);

    // Never expose the order phone back to the client.
    const { order, ...rest } = data;
    const safeOrder = order
      ? { order_number: order.order_number, customer_name: order.customer_name }
      : null;

    return { success: true, data: [{ ...rest, order: safeOrder } as ReturnListResult] };
  } catch {
    return { success: false, error: '查詢失敗，請稍後再試' };
  }
}

/**
 * @deprecated Phone-only lookup leaked return PII within an org. Permanently
 * disabled and fail-closed. Use searchReturnForPortal({ orgSlug, phone,
 * requestNumber }) instead.
 */
export async function searchReturnsByPhone(phone: string): Promise<{ success: boolean; data?: ReturnListResult[]; error?: string }> {
  void phone;
  return {
    success: false,
    error: '此查詢方式已停用，請使用商店專屬退貨查詢連結（需退貨單號 + 手機號碼）',
  };
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
    storage_path?: string | null;
    image_type: string | null;
  }[];
}

/**
 * @deprecated Single-factor lookup by request number alone. Permanently
 * disabled and fail-closed. Use searchReturnForPortal({ orgSlug, phone,
 * requestNumber }) instead.
 */
export async function searchReturnByNumber(requestNumber: string): Promise<{ success: boolean; data?: ReturnSearchResult; error?: string }> {
  void requestNumber;
  return {
    success: false,
    error: '此查詢方式已停用，請使用商店專屬退貨查詢連結（需退貨單號 + 手機號碼）',
  };
}
