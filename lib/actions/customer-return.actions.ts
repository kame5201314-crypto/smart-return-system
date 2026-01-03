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
  returnReason: string;
  productSuggestion?: string;
}

/**
 * Submit customer return request from the simplified portal form
 * This creates all necessary records in one transaction
 */
export async function submitCustomerReturn(
  formData: CustomerReturnFormData,
  imageFiles: { name: string; type: string; base64: string }[]
): Promise<ApiResponse<{ requestNumber: string }>> {
  try {
    const adminClient = createAdminClient();

    // 1. Find or create customer
    let customerId: string | null = null;

    const { data: existingCustomer } = await adminClient
      .from('customers')
      .select('id')
      .eq('phone', formData.phone)
      .single() as { data: { id: string } | null; error: Error | null };

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await adminClient
        .from('customers')
        .insert({
          phone: formData.phone,
          name: formData.ordererName,
        } as never)
        .select('id')
        .single() as { data: { id: string } | null; error: Error | null };

      if (customerError) {
        console.error('Create customer error:', customerError);
      } else if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // 2. Find or create order
    let orderId: string | null = null;

    // Check if order exists
    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('id')
      .eq('order_number', formData.orderNumber)
      .single() as { data: { id: string } | null; error: Error | null };

    if (existingOrder) {
      orderId = existingOrder.id;
    } else {
      // Create order record for tracking
      const channelMap: Record<string, string> = {
        shopee: 'shopee',
        ruten: 'other',
        official: 'official',
        momo: 'momo',
        pchome: 'other',
        other: 'other',
      };

      const { data: newOrder, error: orderError } = await adminClient
        .from('orders')
        .insert({
          order_number: formData.orderNumber,
          customer_id: customerId,
          customer_phone: formData.phone,
          customer_name: formData.ordererName,
          channel_source: channelMap[formData.channelSource] || 'other',
          status: 'delivered',
          metadata: {
            account_id: formData.accountId,
            receiver_name: formData.receiverName,
            source_channel_raw: formData.channelSource,
          },
        } as never)
        .select('id')
        .single() as { data: { id: string } | null; error: Error | null };

      if (orderError) {
        console.error('Create order error:', orderError);
        return { success: false, error: '建立訂單記錄失敗' };
      }

      if (newOrder) {
        orderId = newOrder.id;
      }
    }

    if (!orderId) {
      return { success: false, error: '無法建立訂單記錄' };
    }

    // 3. Create return request
    const { data: returnRequest, error: returnError } = await adminClient
      .from('return_requests')
      .insert({
        order_id: orderId,
        customer_id: customerId,
        channel_source: formData.channelSource as 'shopee' | 'official' | 'momo' | 'dealer' | 'other',
        status: 'pending_review',
        reason_category: '客戶自助申請',
        reason_detail: formData.returnReason,
        review_notes: formData.productSuggestion || null,
      } as never)
      .select('id, request_number')
      .single() as { data: { id: string; request_number: string } | null; error: Error | null };

    if (returnError || !returnRequest) {
      console.error('Create return request error:', returnError);
      return { success: false, error: '建立退貨申請失敗' };
    }

    // 4. Upload images to Supabase Storage and create records
    const uploadedImages: { url: string; storagePath: string }[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
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
        // Continue with other images even if one fails
        continue;
      }

      // Get public URL
      const { data: urlData } = adminClient.storage
        .from('return-images')
        .getPublicUrl(fileName);

      uploadedImages.push({
        url: urlData.publicUrl,
        storagePath: fileName,
      });
    }

    // 5. Create image records in database
    if (uploadedImages.length > 0) {
      const imageRecords = uploadedImages.map((img) => ({
        return_request_id: returnRequest.id,
        image_url: img.url,
        storage_path: img.storagePath,
        image_type: 'product_damage' as const,
        uploaded_by: 'customer' as const,
      }));

      await adminClient.from('return_images').insert(imageRecords as never);
    }

    // 6. Create a return item record (generic since we don't have specific product info)
    await adminClient.from('return_items').insert({
      return_request_id: returnRequest.id,
      product_name: `訂單 ${formData.orderNumber} 商品`,
      quantity: 1,
      reason: formData.returnReason,
    } as never);

    // 7. Log activity
    await adminClient.from('activity_logs').insert({
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
        reason: formData.returnReason,
        images_count: uploadedImages.length,
      },
    } as never);

    return {
      success: true,
      data: { requestNumber: returnRequest.request_number },
      message: '退貨申請已成功送出',
    };
  } catch (error) {
    console.error('Submit customer return error:', error);
    return { success: false, error: '系統錯誤，請稍後再試' };
  }
}

/**
 * Search return requests by phone number
 */
export async function searchReturnsByPhone(phone: string) {
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
        order:orders!inner (
          order_number,
          customer_phone,
          customer_name
        )
      `)
      .eq('orders.customer_phone', phone)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Search returns by phone error:', error);
      return { success: false, error: '查詢失敗' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Search returns by phone error:', error);
    return { success: false, error: '系統錯誤' };
  }
}

/**
 * Search return request by request number
 */
export async function searchReturnByNumber(requestNumber: string) {
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
        refunded_at,
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
      .single();

    if (error || !data) {
      return { success: false, error: '找不到此退貨單號' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Search return by number error:', error);
    return { success: false, error: '系統錯誤' };
  }
}
