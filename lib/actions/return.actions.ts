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
    const supabase = await createClient();

    let query = supabase
      .from('return_requests')
      .select(`
        *,
        order:orders (
          order_number,
          customer_name,
          channel_source
        ),
        return_items (
          id,
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
    const newStatus =
      validated.result === 'failed' ? 'abnormal_disputed' : 'refund_processing';

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
 * Get return request detail by ID (for admin)
 */
export async function getReturnRequestDetail(id: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
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
          order_date
        ),
        customer:customers (
          id,
          name,
          phone,
          email
        ),
        return_items (
          id,
          sku,
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
          checklist,
          notes,
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
