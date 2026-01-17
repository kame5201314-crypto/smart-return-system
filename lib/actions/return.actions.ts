'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  customerLoginSchema,
  returnApplySchema,
  statusUpdateSchema,
  inspectionSchema,
  isWithinReturnDeadline,
  type CustomerLoginInput,
  type ReturnApplyInput,
  type StatusUpdateInput,
  type InspectionInput,
} from '@/lib/validations/return.schema';
import { CHANNELS, ERROR_MESSAGES } from '@/config/constants';
import type { ApiResponse, CustomerSession, ReturnRequestWithRelations } from '@/types';

/**
 * Customer login with order number + phone
 */
export async function customerLogin(
  input: CustomerLoginInput
): Promise<ApiResponse<CustomerSession>> {
  try {
    const validated = customerLoginSchema.parse(input);
    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_phone, customer_name, channel_source, delivered_at')
      .eq('order_number', validated.orderNumber)
      .eq('customer_phone', validated.phone)
      .single() as { data: { id: string; order_number: string; customer_phone: string; customer_name: string | null; channel_source: string | null; delivered_at: string | null } | null; error: Error | null };

    if (error || !order) {
      return { success: false, error: '訂單編號或手機號碼不正確' };
    }

    const channel = Object.values(CHANNELS).find((c) => c.key === order.channel_source);
    const canApplyReturn = channel?.canApplyReturn ?? true;
    const isReturnEligible = isWithinReturnDeadline(order.delivered_at);

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        phone: order.customer_phone,
        customerName: order.customer_name,
        channelSource: order.channel_source,
        canApplyReturn,
        deliveredAt: order.delivered_at,
        isReturnEligible,
      },
    };
  } catch (error) {
    console.error('Customer login error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Get order details with items for return application
 */
export async function getOrderForReturn(orderId: string) {
  try {
    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          sku,
          product_name,
          quantity,
          unit_price
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    return { success: true, data: order };
  } catch (error) {
    console.error('Get order error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Submit return application
 */
export async function submitReturnApplication(
  input: ReturnApplyInput,
  imageUrls: { url: string; type: string; storagePath: string }[]
): Promise<ApiResponse<{ requestNumber: string }>> {
  try {
    const validated = returnApplySchema.parse(input);

    if (imageUrls.length < 3 || imageUrls.length > 5) {
      return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_IMAGES };
    }

    const adminClient = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, channel_source, customer_id, delivered_at')
      .eq('id', validated.orderId)
      .single() as { data: { id: string; channel_source: string | null; customer_id: string | null; delivered_at: string | null } | null; error: Error | null };

    if (orderError || !order) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    // Check if shopee order
    if (order.channel_source === 'shopee') {
      return { success: false, error: ERROR_MESSAGES.SHOPEE_REDIRECT };
    }

    // Check return deadline
    if (!isWithinReturnDeadline(order.delivered_at)) {
      return { success: false, error: ERROR_MESSAGES.RETURN_EXPIRED };
    }

    // Create return request
    const insertData = {
      order_id: validated.orderId,
      customer_id: order.customer_id,
      channel_source: order.channel_source,
      reason_category: validated.reasonCategory,
      reason_detail: validated.reasonDetail,
      return_shipping_method: validated.returnShippingMethod,
      status: 'pending_review',
    };
    const { data: returnRequest, error: insertError } = await adminClient
      .from('return_requests')
      .insert(insertData as never)
      .select('id, request_number')
      .single() as { data: { id: string; request_number: string } | null; error: Error | null };

    if (insertError || !returnRequest) {
      console.error('Insert return request error:', insertError);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Insert return items
    const returnItems = validated.selectedItems.map((item) => ({
      return_request_id: returnRequest.id,
      order_item_id: item.orderItemId,
      product_name: '', // Will be filled from order_items
      quantity: item.quantity,
      reason: item.reason,
    }));

    await adminClient.from('return_items').insert(returnItems as never);

    // Insert images
    const images = imageUrls.map((img) => ({
      return_request_id: returnRequest.id,
      image_url: img.url,
      storage_path: img.storagePath,
      image_type: img.type,
      uploaded_by: 'customer' as const,
    }));

    await adminClient.from('return_images').insert(images as never);

    // Log activity
    await adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: returnRequest.id,
      action: 'created',
      actor_type: 'customer',
      description: `退貨申請已建立: ${returnRequest.request_number}`,
    } as never);

    return {
      success: true,
      data: { requestNumber: returnRequest.request_number },
    };
  } catch (error) {
    console.error('Submit return application error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Get return request status for customer tracking
 */
export async function getReturnStatus(
  requestNumber: string,
  phone: string
): Promise<ApiResponse<ReturnRequestWithRelations>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('return_requests')
      .select(`
        *,
        order:orders!inner (
          order_number,
          customer_phone,
          channel_source
        ),
        return_items (
          id,
          product_name,
          quantity,
          reason
        ),
        return_images (
          id,
          image_url,
          image_type
        )
      `)
      .eq('request_number', requestNumber)
      .single() as { data: ReturnRequestWithRelations & { order?: { customer_phone?: string } } | null; error: Error | null };

    if (error || !data) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    // Verify phone matches
    if (data.order?.customer_phone !== phone) {
      return { success: false, error: ERROR_MESSAGES.UNAUTHORIZED };
    }

    return { success: true, data: data as ReturnRequestWithRelations };
  } catch (error) {
    console.error('Get return status error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Admin: Get all return requests with filters
 */
export async function getReturnRequests(filters?: {
  status?: string;
  channelSource?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  try {
    // Use admin client to bypass RLS (admin page doesn't have user auth)
    const adminClient = createAdminClient();

    let query = adminClient
      .from('return_requests')
      .select(`
        *,
        order:orders (
          order_number,
          customer_name,
          customer_phone,
          channel_source
        ),
        return_items (
          id,
          product_name,
          product_sku,
          quantity
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.channelSource) {
      query = query.eq('channel_source', filters.channelSource);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get return requests error:', error);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Get return requests error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Admin: Update return request status
 */
export async function updateReturnStatus(
  input: StatusUpdateInput,
  userId: string
): Promise<ApiResponse> {
  try {
    const validated = statusUpdateSchema.parse(input);
    const adminClient = createAdminClient();

    // Get current status
    const { data: current, error: fetchError } = await adminClient
      .from('return_requests')
      .select('status')
      .eq('id', validated.returnRequestId)
      .single() as { data: { status: string } | null; error: Error | null };

    if (fetchError || !current) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    const updateData: Record<string, unknown> = {
      status: validated.newStatus,
    };

    // Set timestamps based on new status
    const now = new Date().toISOString();
    switch (validated.newStatus) {
      case 'approved_waiting_shipping':
        updateData.approved_at = now;
        updateData.reviewed_by = userId;
        break;
      case 'shipping_in_transit':
        updateData.shipped_at = now;
        if (validated.trackingNumber) {
          updateData.tracking_number = validated.trackingNumber;
        }
        if (validated.logisticsCompany) {
          updateData.logistics_company = validated.logisticsCompany;
        }
        break;
      case 'received_inspecting':
        updateData.received_at = now;
        break;
      case 'refund_processing':
        updateData.inspected_at = now;
        break;
      case 'completed':
        updateData.closed_at = now;
        break;
      case 'abnormal_disputed':
        updateData.dispute_notes = validated.notes;
        break;
    }

    if (validated.notes) {
      updateData.review_notes = validated.notes;
    }

    const { error: updateError } = await adminClient
      .from('return_requests')
      .update(updateData as never)
      .eq('id', validated.returnRequestId);

    if (updateError) {
      console.error('Update return status error:', updateError);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Log activity
    await adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: validated.returnRequestId,
      action: 'status_changed',
      actor_type: 'user',
      actor_id: userId,
      old_value: { status: current.status },
      new_value: { status: validated.newStatus },
      description: `狀態更新: ${current.status} → ${validated.newStatus}`,
    } as never);

    return { success: true, message: '狀態更新成功' };
  } catch (error) {
    console.error('Update return status error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Admin: Submit inspection result
 */
export async function submitInspection(
  input: InspectionInput,
  userId: string
): Promise<ApiResponse> {
  try {
    const validated = inspectionSchema.parse(input);
    const adminClient = createAdminClient();

    // Insert inspection record
    const { error: inspectError } = await adminClient
      .from('inspection_records')
      .insert({
        return_request_id: validated.returnRequestId,
        inspector_id: userId,
        result: validated.result,
        condition_grade: validated.conditionGrade,
        checklist: validated.checklist,
        notes: validated.notes,
        inspector_comment: validated.inspectorComment,
      } as never);

    if (inspectError) {
      console.error('Insert inspection error:', inspectError);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Update return request status
    // passed -> completed (直接結案), failed -> abnormal_disputed (驗收異常)
    const newStatus =
      validated.result === 'failed' ? 'abnormal_disputed' : 'completed';

    await adminClient
      .from('return_requests')
      .update({
        status: newStatus,
        inspected_at: new Date().toISOString(),
        inspected_by: userId,
        inspection_notes: validated.notes,
      } as never)
      .eq('id', validated.returnRequestId);

    // Log activity
    await adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: validated.returnRequestId,
      action: 'inspected',
      actor_type: 'user',
      actor_id: userId,
      new_value: {
        result: validated.result,
        grade: validated.conditionGrade,
      },
      description: `驗貨完成: ${validated.result} (等級 ${validated.conditionGrade})`,
    } as never);

    return { success: true, message: '驗貨結果已提交' };
  } catch (error) {
    console.error('Submit inspection error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Update return request info (product name, SKU, refund amount)
 */
export async function updateReturnInfo(
  returnRequestId: string,
  data: {
    productName?: string;
    productSku?: string;
    refundAmount?: number;
  }
): Promise<ApiResponse> {
  try {
    const adminClient = createAdminClient();

    // Update refund amount in return_requests
    if (data.refundAmount !== undefined) {
      const { error: requestError } = await adminClient
        .from('return_requests')
        .update({ refund_amount: data.refundAmount } as never)
        .eq('id', returnRequestId);

      if (requestError) {
        console.error('Update return request error:', requestError);
        return { success: false, error: ERROR_MESSAGES.GENERIC };
      }
    }

    // Update product info in return_items
    if (data.productName !== undefined || data.productSku !== undefined) {
      const itemUpdateData: Record<string, unknown> = {};
      if (data.productName !== undefined) {
        itemUpdateData.product_name = data.productName;
      }
      if (data.productSku !== undefined) {
        itemUpdateData.product_sku = data.productSku;
      }

      const { error: itemError } = await adminClient
        .from('return_items')
        .update(itemUpdateData as never)
        .eq('return_request_id', returnRequestId);

      if (itemError) {
        console.error('Update return items error:', itemError);
        return { success: false, error: ERROR_MESSAGES.GENERIC };
      }
    }

    return { success: true, message: '資訊更新成功' };
  } catch (error) {
    console.error('Update return info error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Get return request detail by ID (for admin)
 */
export async function getReturnRequestDetail(id: string) {
  try {
    // Use admin client to bypass RLS (admin page doesn't have user auth)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('return_requests')
      .select(`
        *,
        order:orders (
          id,
          order_number,
          customer_name,
          customer_phone,
          channel_source,
          total_amount,
          created_at
        ),
        customer:customers (
          id,
          name,
          phone,
          email
        ),
        return_items (
          id,
          product_sku,
          product_name,
          quantity,
          unit_price,
          reason
        ),
        return_images (
          id,
          image_url,
          image_type,
          uploaded_by,
          created_at
        ),
        inspection_records (
          id,
          result,
          condition_grade,
          inspector_comment,
          inspected_at
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Get return request detail error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Admin: Process refund for a return request
 */
export async function processRefund(
  returnRequestId: string,
  refundData: {
    refundType: 'full' | 'partial' | 'store_credit';
    refundAmount: number;
    refundMethod: 'original_payment' | 'bank_transfer' | 'store_credit';
    notes?: string;
  },
  userId: string
): Promise<ApiResponse<{ refundNumber: string }>> {
  try {
    const adminClient = createAdminClient();

    // Get return request
    const { data: returnRequest, error: fetchError } = await adminClient
      .from('return_requests')
      .select('id, request_number, status, order_id')
      .eq('id', returnRequestId)
      .single() as { data: { id: string; request_number: string; status: string; order_id: string } | null; error: Error | null };

    if (fetchError || !returnRequest) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    // Verify status is refund_processing
    if (returnRequest.status !== 'refund_processing') {
      return { success: false, error: '此退貨申請目前無法進行退款' };
    }

    // Generate refund number
    const refundNumber = `RF${Date.now().toString(36).toUpperCase()}`;

    // Update return request with refund info
    const { error: updateError } = await adminClient
      .from('return_requests')
      .update({
        status: 'completed',
        refund_type: refundData.refundType,
        refund_amount: refundData.refundAmount,
        refund_method: refundData.refundMethod,
        refund_number: refundNumber,
        refund_notes: refundData.notes,
        refund_processed_at: new Date().toISOString(),
        refund_processed_by: userId,
        closed_at: new Date().toISOString(),
      } as never)
      .eq('id', returnRequestId);

    if (updateError) {
      console.error('Update refund error:', updateError);
      return { success: false, error: '退款處理失敗' };
    }

    // Log activity
    await adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: returnRequestId,
      action: 'refunded',
      actor_type: 'user',
      actor_id: userId,
      new_value: {
        refund_type: refundData.refundType,
        refund_amount: refundData.refundAmount,
        refund_method: refundData.refundMethod,
        refund_number: refundNumber,
      },
      description: `退款完成: ${refundNumber} (${refundData.refundAmount} 元)`,
    } as never);

    return {
      success: true,
      data: { refundNumber },
      message: '退款處理完成',
    };
  } catch (error) {
    console.error('Process refund error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Get return statistics for dashboard
 */
export async function getReturnStatistics() {
  try {
    // Use admin client to bypass RLS (admin page doesn't have user auth)
    const adminClient = createAdminClient();

    // Get counts by status
    const { data: returns, error } = await adminClient
      .from('return_requests')
      .select('status, refund_amount');

    if (error) {
      console.error('Get statistics error:', error);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    const stats = {
      total: returns?.length || 0,
      pending: returns?.filter((r: { status: string }) => r.status === 'pending_review').length || 0,
      processing: returns?.filter((r: { status: string }) =>
        ['approved_waiting_shipping', 'shipping_in_transit', 'received_inspecting', 'refund_processing'].includes(r.status)
      ).length || 0,
      completed: returns?.filter((r: { status: string }) => r.status === 'completed').length || 0,
      abnormal: returns?.filter((r: { status: string }) => r.status === 'abnormal_disputed').length || 0,
      totalRefundAmount: returns?.reduce((sum: number, r: { refund_amount?: number }) => sum + (r.refund_amount || 0), 0) || 0,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Get statistics error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Export returns to Excel format (returns data for client-side XLSX generation)
 */
export async function getReturnsForExport(filters?: {
  status?: string;
  channelSource?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  try {
    // Use admin client to bypass RLS (admin page doesn't have user auth)
    const adminClient = createAdminClient();

    let query = adminClient
      .from('return_requests')
      .select(`
        id,
        request_number,
        status,
        channel_source,
        reason_category,
        reason_detail,
        refund_amount,
        refund_type,
        refund_method,
        created_at,
        approved_at,
        received_at,
        refund_processed_at,
        closed_at,
        order:orders (
          order_number,
          customer_name,
          customer_phone,
          total_amount
        ),
        return_items (
          product_name,
          quantity
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.channelSource) {
      query = query.eq('channel_source', filters.channelSource);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get returns for export error:', error);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Transform data for Excel export
    const exportData = data?.map((r: Record<string, unknown>) => ({
      '申請編號': r.request_number,
      '訂單編號': (r.order as Record<string, unknown>)?.order_number,
      '客戶姓名': (r.order as Record<string, unknown>)?.customer_name,
      '客戶電話': (r.order as Record<string, unknown>)?.customer_phone,
      '通路來源': r.channel_source,
      '狀態': r.status,
      '退貨原因': r.reason_category,
      '原因說明': r.reason_detail,
      '商品': (r.return_items as Array<{ product_name: string; quantity: number }>)?.map(i => `${i.product_name} x${i.quantity}`).join(', '),
      '退款金額': r.refund_amount,
      '退款方式': r.refund_method,
      '申請時間': r.created_at,
      '核准時間': r.approved_at,
      '收貨時間': r.received_at,
      '退款時間': r.refund_processed_at,
      '結案時間': r.closed_at,
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error('Get returns for export error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}
