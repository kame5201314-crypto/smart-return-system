'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

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
 */
export async function submitCustomerReturn(
  formData: CustomerReturnFormData,
  imageFiles: { name: string; type: string; base64: string }[]
): Promise<ApiResponse<{ requestNumber: string }>> {
  try {
    const adminClient = createAdminClient();

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
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return { success: false, error: '資料庫連線失敗，請稍後再試' };
    }

    let customerId: string | null = customerResult.data?.id || null;
    let orderId: string | null = orderResult.data?.id || null;

    // Create customer if not exists
    if (!customerId) {
      const { data: newCustomer } = await adminClient
        .from('customers')
        .insert({
          phone: formData.phone,
          name: formData.ordererName,
        } as never)
        .select('id')
        .single() as { data: { id: string } | null; error: Error | null };
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

    // 3. Upload images in PARALLEL (major speed improvement)
    const uploadPromises = imageFiles.map(async (file, i) => {
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
        console.error('Upload image error:', uploadError);
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
    const uploadedImages = uploadResults.filter((img): img is { url: string; storagePath: string } => img !== null);

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

    // Execute all DB operations in parallel
    await Promise.all([insertImagesPromise, insertItemPromise, insertLogPromise]);

    return {
      success: true,
      data: { requestNumber: returnRequest.request_number },
      message: '退貨申請已成功送出',
    };
  } catch (error) {
    console.error('Submit customer return error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    // Check for common database errors
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return { success: false, error: '資料庫表格尚未建立，請聯繫管理員' };
    }
    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      return { success: false, error: '資料庫權限不足，請聯繫管理員' };
    }
    return { success: false, error: `系統錯誤: ${errorMessage}` };
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
        )
      `)
      .in('order_id', orderIds)
      .order('created_at', { ascending: false }) as { data: ReturnListResult[] | null; error: Error | null };

    if (error) {
      console.error('Search returns by phone error:', error);
      return { success: false, error: '查詢失敗' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Search returns by phone error:', error);
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
  } catch (error) {
    console.error('Search return by number error:', error);
    return { success: false, error: '系統錯誤' };
  }
}
