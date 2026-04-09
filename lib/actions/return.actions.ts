'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createUntypedAdminClient } from '@/lib/supabase/admin';
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
import { CHANNELS, ERROR_MESSAGES, RETURN_ITEM_RESOLUTION_TYPES } from '@/config/constants';
import type { ApiResponse, CustomerSession, ReturnRequestWithRelations } from '@/types';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import {
  applyFallbackResolutionTypeToItems,
  isReturnItemResolutionType,
  type ReturnItemResolutionType,
} from '@/lib/utils/resolution-fallback';

function mapChannelToPickupPlatform(channelSource: string | null): string {
  if (channelSource === 'official') return '官網';
  if (channelSource === 'shopee') return '蝦皮';
  if (channelSource === 'shopee_mall') return '商城';
  if (channelSource === 'momo') return 'MOMO';
  return '其他';
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

function getMissingColumnName(error: unknown, table: string): string | null {
  const rawMessage = getErrorMessage(error);
  const message = rawMessage.toLowerCase();
  if (!message) return null;

  const schemaCachePattern = new RegExp(`could not find the ['"]([^'"]+)['"] column of ['"]${table}['"] in the schema cache`);
  const schemaCacheMatch = message.match(schemaCachePattern);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const columnPatterns = [
    new RegExp(`column ${table}\\.([a-z0-9_]+) does not exist`),
    new RegExp(`column ${table}_[0-9]+\\.([a-z0-9_]+) does not exist`),
    new RegExp(`column ['"]?([a-z0-9_]+)['"]? does not exist`),
  ];

  for (const pattern of columnPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function isMissingColumnError(error: unknown, table: string, column: string): boolean {
  return getMissingColumnName(error, table) === column;
}

async function insertReturnItemsWithResolutionFallback(
  adminClient: ReturnType<typeof createAdminClient>,
  returnItems: Array<Record<string, unknown>>,
  source: string,
  context?: Record<string, unknown>
): Promise<{ error: Error | null; usedFallback: boolean }> {
  const { error } = await adminClient
    .from('return_items')
    .insert(returnItems as never) as { error: Error | null };

  if (!error) {
    return { error: null, usedFallback: false };
  }

  if (!isMissingColumnError(error, 'return_items', 'resolution_type')) {
    return { error, usedFallback: false };
  }

  await emitSchemaDriftAlert({
    source,
    table: 'return_items',
    column: 'resolution_type',
    errorMessage: error.message,
    context,
  });

  const fallbackRows = returnItems.map((item) => {
    const rowWithoutResolution = { ...item };
    delete rowWithoutResolution.resolution_type;
    return rowWithoutResolution;
  });

  const { error: fallbackError } = await adminClient
    .from('return_items')
    .insert(fallbackRows as never) as { error: Error | null };

  return { error: fallbackError, usedFallback: true };
}

async function ensureRoundTripPickupRecord(
  adminClient: ReturnType<typeof createAdminClient>,
  returnRequestId: string
): Promise<{ success: true; created: boolean; updated: boolean } | { success: false; error: string }> {
  const untypedAdminClient = createUntypedAdminClient();
  const { data: requestData, error: requestError } = await adminClient
    .from('return_requests')
    .select(`
      id,
      request_number,
      channel_source,
      tracking_number,
      order:orders (
        order_number,
        customer_name
      )
    `)
    .eq('id', returnRequestId)
    .single() as {
      data: {
        id: string;
        request_number: string;
        channel_source: string | null;
        tracking_number: string | null;
        order?: { order_number?: string | null; customer_name?: string | null } | null;
      } | null;
      error: Error | null;
    };

  if (requestError || !requestData) {
    return { success: false, error: `讀取退貨單失敗: ${requestError?.message || 'Not found'}` };
  }

  const orderNumber = requestData.order?.order_number?.trim() || requestData.request_number;
  const receiverInfo = requestData.order?.customer_name || null;

  const { data: existingRows, error: existingError } = await untypedAdminClient
    .from('pickup_records')
    .select('id, delivery_status, notes')
    .eq('order_number', orderNumber)
    .order('created_at', { ascending: false })
    .limit(1) as {
      data: Array<{ id: string; delivery_status: string; notes: string | null }> | null;
      error: Error | null;
    };

  if (existingError) {
    return { success: false, error: `查詢派車收件失敗: ${existingError.message}` };
  }

  const autoNote = `由退貨單 ${requestData.request_number} 設為來回件自動同步`;

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    if (existing.delivery_status === '來回件') {
      return { success: true, created: false, updated: false };
    }

    const mergedNotes = existing.notes?.includes(autoNote)
      ? existing.notes
      : [existing.notes?.trim(), autoNote].filter(Boolean).join(' ｜ ');

    const { error: updateError } = await untypedAdminClient
      .from('pickup_records')
      .update({
        delivery_status: '來回件',
        notes: mergedNotes || null,
        tracking_number: requestData.tracking_number || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', existing.id);

    if (updateError) {
      return { success: false, error: `更新派車收件失敗: ${updateError.message}` };
    }

    return { success: true, created: false, updated: true };
  }

  const { error: insertError } = await untypedAdminClient
    .from('pickup_records')
    .insert({
      process_date: new Date().toISOString().slice(0, 10),
      order_number: orderNumber,
      tracking_number: requestData.tracking_number || null,
      platform: mapChannelToPickupPlatform(requestData.channel_source),
      logistics_provider: '其他',
      delivery_status: '來回件',
      received_status: '未收到',
      notes: autoNote,
      receiver_info: receiverInfo,
      is_printed: false,
    } as never);

  if (insertError) {
    return { success: false, error: `建立派車收件失敗: ${insertError.message}` };
  }

  return { success: true, created: true, updated: false };
}

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
      resolution_type: 'full',
    }));

    const { error: itemInsertError } = await insertReturnItemsWithResolutionFallback(
      adminClient,
      returnItems as Array<Record<string, unknown>>,
      'return.actions.submitReturnApplication',
      { returnRequestId: returnRequest.id }
    );

    if (itemInsertError) {
      console.error('Insert return items error:', itemInsertError);
      await adminClient.from('return_requests').delete().eq('id', returnRequest.id);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Insert images
    const images = imageUrls.map((img) => ({
      return_request_id: returnRequest.id,
      image_url: img.url,
      storage_path: img.storagePath,
      image_type: img.type,
      uploaded_by: 'customer' as const,
    }));

    const { error: imageInsertError } = await adminClient
      .from('return_images')
      .insert(images as never);

    if (imageInsertError) {
      console.error('Insert return images error:', imageInsertError);
      await adminClient.from('return_items').delete().eq('return_request_id', returnRequest.id);
      await adminClient.from('return_requests').delete().eq('id', returnRequest.id);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Log activity
    const { error: logInsertError } = await adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: returnRequest.id,
      action: 'created',
      actor_type: 'customer',
      description: `退貨申請已建立: ${returnRequest.request_number}`,
    } as never);

    if (logInsertError) {
      console.error('Insert activity log error:', logInsertError);
      await adminClient.from('return_images').delete().eq('return_request_id', returnRequest.id);
      await adminClient.from('return_items').delete().eq('return_request_id', returnRequest.id);
      await adminClient.from('return_requests').delete().eq('id', returnRequest.id);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

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

    const selectWithResolution = `
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
        reason,
        resolution_type
      ),
      return_images (
        id,
        image_url,
        image_type
      )
    `;

    const selectWithoutResolution = `
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
    `;

    let { data, error } = await supabase
      .from('return_requests')
      .select(selectWithResolution)
      .eq('request_number', requestNumber)
      .single() as { data: ReturnRequestWithRelations & { order?: { customer_phone?: string } } | null; error: Error | null };

    let usedResolutionFallback = false;
    if (error && isMissingColumnError(error, 'return_items', 'resolution_type')) {
      await emitSchemaDriftAlert({
        source: 'return.actions.getReturnStatus',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: error.message,
        context: { requestNumber },
      });
      usedResolutionFallback = true;
      const retry = await supabase
        .from('return_requests')
        .select(selectWithoutResolution)
        .eq('request_number', requestNumber)
        .single() as { data: ReturnRequestWithRelations & { order?: { customer_phone?: string } } | null; error: Error | null };
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    if (usedResolutionFallback) {
      const row = data as unknown as Record<string, unknown>;
      row.return_items = applyFallbackResolutionTypeToItems(
        row.return_items as Array<Record<string, unknown>> | null | undefined,
        row.refund_method
      );
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

    const buildQuery = (includeResolutionType: boolean) => {
      const returnItemsSelect = includeResolutionType
        ? `
          id,
          product_name,
          product_sku,
          quantity,
          resolution_type
        `
        : `
          id,
          product_name,
          product_sku,
          quantity
        `;

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
            ${returnItemsSelect}
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

      return query;
    };

    let { data, error } = await buildQuery(true);
    let usedResolutionFallback = false;

    if (error && isMissingColumnError(error, 'return_items', 'resolution_type')) {
      await emitSchemaDriftAlert({
        source: 'return.actions.getReturnRequests',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: error.message,
      });
      usedResolutionFallback = true;
      const retry = await buildQuery(false);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Get return requests error:', error);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    if (usedResolutionFallback) {
      const normalizedData = ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        return_items: applyFallbackResolutionTypeToItems(
          row.return_items as Array<Record<string, unknown>> | null | undefined,
          row.refund_method
        ),
      }));
      return { success: true, data: normalizedData };
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

    const resultVariants = validated.result === 'passed'
      ? ['passed', 'pass']
      : validated.result === 'failed'
        ? ['failed', 'fail']
        : [validated.result];
    const payloadCandidates: Record<string, unknown>[] = [];

    // Build payload variants to handle schema/value differences across deployments.
    for (const resultValue of resultVariants) {
      const baseInspectionData: Record<string, unknown> = {
        return_request_id: validated.returnRequestId,
        result: resultValue,
        condition_grade: validated.conditionGrade || 'B',
        inspector_comment: validated.inspectorComment || validated.notes || '',
        inspected_at: new Date().toISOString(),
      };

      if (validated.notes) {
        baseInspectionData.notes = validated.notes;
      }

      if (validated.checklist) {
        baseInspectionData.checklist = validated.checklist;
      }

      for (const inspectorColumn of ['inspected_by', 'inspector_id']) {
        const payloadWithInspector = {
          ...baseInspectionData,
          [inspectorColumn]: userId,
        };
        payloadCandidates.push(payloadWithInspector);
      }
    }

    const uniquePayloads = payloadCandidates.filter((payload, index, arr) => (
      arr.findIndex((item) => JSON.stringify(item) === JSON.stringify(payload)) === index
    ));

    let inspectError: {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    } | null = null;
    let inserted = false;
    let inspectionRecordId: string | null = null;
    const pendingPayloads = [...uniquePayloads];
    const attemptedPayloads = new Set<string>();

    while (pendingPayloads.length > 0) {
      const payload = pendingPayloads.shift()!;
      const payloadKey = JSON.stringify(payload);
      if (attemptedPayloads.has(payloadKey)) {
        continue;
      }
      attemptedPayloads.add(payloadKey);

      const { data, error } = (await adminClient
        .from('inspection_records')
        .insert(payload as never)
        .select('id')
        .single()) as { data: { id: string } | null; error: {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        } | null };

      if (!error) {
        inserted = true;
        inspectError = null;
        inspectionRecordId = data?.id || null;
        break;
      }

      inspectError = error;
      const missingColumn = getMissingColumnName(error, 'inspection_records');
      const lowerMessage = (error.message || '').toLowerCase();
      const isSchemaMismatch =
        lowerMessage.includes('column') ||
        lowerMessage.includes('does not exist') ||
        lowerMessage.includes('schema cache');
      const isInspectorForeignKeyError =
        lowerMessage.includes('foreign key') &&
        (lowerMessage.includes('inspected_by') || lowerMessage.includes('inspector_id'));

      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        await emitSchemaDriftAlert({
          source: 'return.actions.submitInspection',
          table: 'inspection_records',
          column: missingColumn,
          errorMessage: error.message,
          context: {
            returnRequestId: validated.returnRequestId,
            result: validated.result,
          },
        });

        const payloadWithoutMissingColumn = { ...payload };
        delete payloadWithoutMissingColumn[missingColumn];

        const fallbackPayloadKey = JSON.stringify(payloadWithoutMissingColumn);
        if (fallbackPayloadKey !== payloadKey && !attemptedPayloads.has(fallbackPayloadKey)) {
          pendingPayloads.unshift(payloadWithoutMissingColumn);
          continue;
        }
      }

      // Some environments may not have the admin UUID in users table yet.
      if (isInspectorForeignKeyError) {
        const payloadWithoutInspector: Record<string, unknown> = { ...payload };
        if ('inspected_by' in payloadWithoutInspector) {
          payloadWithoutInspector.inspected_by = null;
        }
        if ('inspector_id' in payloadWithoutInspector) {
          payloadWithoutInspector.inspector_id = null;
        }

        const { data: fallbackData, error: fallbackError } = (await adminClient
          .from('inspection_records')
          .insert(payloadWithoutInspector as never)
          .select('id')
          .single()) as { data: { id: string } | null; error: {
            message?: string;
            code?: string;
            details?: string;
            hint?: string;
          } | null };

        if (!fallbackError) {
          inserted = true;
          inspectError = null;
          inspectionRecordId = fallbackData?.id || null;
          console.warn('Inserted inspection record without inspector id due FK mismatch');
          break;
        }

        inspectError = fallbackError;
      }

      if (!isSchemaMismatch && !isInspectorForeignKeyError) {
        break;
      }
    }

    if (!inserted || inspectError) {
      console.error('Insert inspection error:', inspectError);
      console.error('Inspection payloads tried:', uniquePayloads);
      const inspectionErrorMessage = inspectError?.message || ERROR_MESSAGES.GENERIC;
      const inspectionErrorMeta = [inspectError?.code, inspectError?.details, inspectError?.hint]
        .filter(Boolean)
        .join(' | ');
      const errorText = inspectionErrorMeta
        ? `驗貨記錄建立失敗 [inspect-save-v2]: ${inspectionErrorMessage} (${inspectionErrorMeta})`
        : `驗貨記錄建立失敗 [inspect-save-v2]: ${inspectionErrorMessage}`;
      return { success: false, error: errorText };
    }

    // Update return request status
    // passed -> completed (直接結案), failed -> abnormal_disputed (驗收異常)
    const newStatus =
      validated.result === 'failed' ? 'abnormal_disputed' : 'completed';

    const { error: statusUpdateError } = await adminClient
      .from('return_requests')
      .update({
        status: newStatus,
        closed_at: new Date().toISOString(),
      } as never)
      .eq('id', validated.returnRequestId);

    if (statusUpdateError) {
      console.error('Update return status after inspection error:', statusUpdateError);

      // Compensating rollback: avoid leaving an inspection record without the matching status update.
      if (inspectionRecordId) {
        const { error: rollbackError } = await adminClient
          .from('inspection_records')
          .delete()
          .eq('id', inspectionRecordId);

        if (rollbackError) {
          console.error('Rollback inspection record error:', rollbackError);
        }
      }

      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Log activity
    const { error: activityLogError } = await adminClient.from('activity_logs').insert({
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

    if (activityLogError) {
      console.error('Insert activity log (inspected) error:', activityLogError);
      // Not a critical path: status and inspection record are already written.
    }

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
    returnShippingMethod?: string;
    adminNote?: string;
    returnReasonNote?: string;
    invoiceStatus?: string;
    itemResolutionTypes?: Record<string, ReturnItemResolutionType | string>;
  }
): Promise<ApiResponse> {
  try {
    const adminClient = createAdminClient();
    let roundTripSyncMessage = '';

    // Update fields in return_requests
    const requestUpdateData: Record<string, unknown> = {};
    if (data.refundAmount !== undefined) {
      requestUpdateData.refund_amount = data.refundAmount;
    }
    if (data.returnShippingMethod !== undefined) {
      requestUpdateData.return_shipping_method = data.returnShippingMethod;
    }
    if (data.adminNote !== undefined) {
      requestUpdateData.admin_note = data.adminNote;
    }
    if (data.returnReasonNote !== undefined) {
      requestUpdateData.return_reason_note = data.returnReasonNote;
    }
    if (data.invoiceStatus !== undefined) {
      requestUpdateData.invoice_status = data.invoiceStatus;
    }

    if (Object.keys(requestUpdateData).length > 0) {
      const { error: requestError } = await adminClient
        .from('return_requests')
        .update(requestUpdateData as never)
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

    let resolutionFallbackMessage = '';

    // Update per-item handling mode (全額退款 / 部分退款 / 換貨 / 來回件)
    if (data.itemResolutionTypes && Object.keys(data.itemResolutionTypes).length > 0) {
      let shouldSyncRoundTripToPickup = false;
      const previousResolutionByItemId: Record<string, ReturnItemResolutionType> = {};
      let resolutionColumnUnavailable = false;
      let fallbackResolutionType: ReturnItemResolutionType | null = null;

      for (const [itemId, rawResolutionType] of Object.entries(data.itemResolutionTypes)) {
        if (!itemId || typeof rawResolutionType !== 'string') continue;
        if (!isReturnItemResolutionType(rawResolutionType)) continue;

        if (resolutionColumnUnavailable) {
          fallbackResolutionType = rawResolutionType;
          if (rawResolutionType === RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key) {
            shouldSyncRoundTripToPickup = true;
          }
          continue;
        }

        const { data: existingItem, error: existingItemError } = await adminClient
          .from('return_items')
          .select('resolution_type')
          .eq('id', itemId)
          .eq('return_request_id', returnRequestId)
          .single() as { data: { resolution_type?: string | null } | null; error: Error | null };

        if (existingItemError) {
          if (isMissingColumnError(existingItemError, 'return_items', 'resolution_type')) {
            await emitSchemaDriftAlert({
              source: 'return.actions.updateReturnInfo.readExistingResolution',
              table: 'return_items',
              column: 'resolution_type',
              errorMessage: existingItemError.message,
              context: { returnRequestId, itemId },
            });
            resolutionColumnUnavailable = true;
            fallbackResolutionType = rawResolutionType;
            if (rawResolutionType === RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key) {
              shouldSyncRoundTripToPickup = true;
            }
            continue;
          }

          console.error('Fetch existing return item resolution error:', existingItemError);
          return { success: false, error: `更新處理方式失敗: ${existingItemError.message}` };
        }

        if (!existingItem) {
          return { success: false, error: '更新處理方式失敗: 找不到退貨商品' };
        }

        previousResolutionByItemId[itemId] = isReturnItemResolutionType(existingItem.resolution_type || '')
          ? (existingItem.resolution_type as ReturnItemResolutionType)
          : RETURN_ITEM_RESOLUTION_TYPES.FULL.key;

        const { error: resolutionError } = await adminClient
          .from('return_items')
          .update({ resolution_type: rawResolutionType } as never)
          .eq('id', itemId)
          .eq('return_request_id', returnRequestId);

        if (resolutionError) {
          if (isMissingColumnError(resolutionError, 'return_items', 'resolution_type')) {
            await emitSchemaDriftAlert({
              source: 'return.actions.updateReturnInfo.writeResolution',
              table: 'return_items',
              column: 'resolution_type',
              errorMessage: resolutionError.message,
              context: { returnRequestId, itemId, nextResolutionType: rawResolutionType },
            });
            resolutionColumnUnavailable = true;
            fallbackResolutionType = rawResolutionType;
            if (rawResolutionType === RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key) {
              shouldSyncRoundTripToPickup = true;
            }
            continue;
          }

          console.error('Update return item resolution error:', resolutionError);
          return { success: false, error: `更新處理方式失敗: ${resolutionError.message}` };
        }

        if (rawResolutionType === RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key) {
          shouldSyncRoundTripToPickup = true;
        }
      }

      if (resolutionColumnUnavailable) {
        let savedToRequestLevel = false;
        if (fallbackResolutionType) {
          const { error: fallbackMethodError } = await adminClient
            .from('return_requests')
            .update({ refund_method: fallbackResolutionType } as never)
            .eq('id', returnRequestId);

          if (fallbackMethodError) {
            if (isMissingColumnError(fallbackMethodError, 'return_requests', 'refund_method')) {
              await emitSchemaDriftAlert({
                source: 'return.actions.updateReturnInfo.writeFallbackRefundMethod',
                table: 'return_requests',
                column: 'refund_method',
                errorMessage: fallbackMethodError.message,
                context: { returnRequestId, fallbackResolutionType },
              });
              console.warn('Fallback refund_method column not available, skipping request-level persistence');
            } else {
              console.error('Fallback update return refund_method error:', fallbackMethodError);
              return { success: false, error: `更新處理方式失敗: ${fallbackMethodError.message}` };
            }
          } else {
            savedToRequestLevel = true;
          }
        }

        if (shouldSyncRoundTripToPickup) {
          const pickupSyncResult = await ensureRoundTripPickupRecord(adminClient, returnRequestId);
          if (!pickupSyncResult.success) {
            return { success: false, error: `同步派車收件失敗: ${pickupSyncResult.error}` };
          }
          if (pickupSyncResult.created) {
            roundTripSyncMessage = '，已同步新增派車收件「來回件」';
          } else if (pickupSyncResult.updated) {
            roundTripSyncMessage = '，已同步更新派車收件為「來回件」';
          } else {
            roundTripSyncMessage = '，派車收件已是「來回件」';
          }
        }

        resolutionFallbackMessage = savedToRequestLevel
          ? '（資料庫尚未升級商品層級處理方式，已改存退貨單層級）'
          : '（資料庫尚未升級，處理方式本次僅暫時套用；請先套用 migration 以永久儲存）';
      } else if (shouldSyncRoundTripToPickup) {
        const pickupSyncResult = await ensureRoundTripPickupRecord(adminClient, returnRequestId);
        if (!pickupSyncResult.success) {
          // Best-effort rollback for resolution updates when pickup sync fails
          for (const [itemId, previousResolution] of Object.entries(previousResolutionByItemId)) {
            await adminClient
              .from('return_items')
              .update({ resolution_type: previousResolution } as never)
              .eq('id', itemId)
              .eq('return_request_id', returnRequestId);
          }
          return { success: false, error: `已更新處理方式，但同步派車收件失敗: ${pickupSyncResult.error}` };
        }
        if (pickupSyncResult.created) {
          roundTripSyncMessage = '，已同步新增派車收件「來回件」';
        } else if (pickupSyncResult.updated) {
          roundTripSyncMessage = '，已同步更新派車收件為「來回件」';
        } else {
          roundTripSyncMessage = '，派車收件已是「來回件」';
        }
      }
    }

    return { success: true, message: `資訊更新成功${roundTripSyncMessage}${resolutionFallbackMessage}` };
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

    const buildDetailQuery = (includeResolutionType: boolean) => {
      const returnItemsSelect = includeResolutionType
        ? `
          id,
          product_sku,
          product_name,
          quantity,
          unit_price,
          reason,
          resolution_type
        `
        : `
          id,
          product_sku,
          product_name,
          quantity,
          unit_price,
          reason
        `;

      return adminClient
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
            metadata,
            created_at
          ),
          customer:customers (
            id,
            name,
            phone,
            email
          ),
          return_items (
            ${returnItemsSelect}
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
    };

    let { data, error } = await buildDetailQuery(true);
    let usedResolutionFallback = false;
    if (error && isMissingColumnError(error, 'return_items', 'resolution_type')) {
      await emitSchemaDriftAlert({
        source: 'return.actions.getReturnRequestDetail',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: error.message,
        context: { id },
      });
      usedResolutionFallback = true;
      const retry = await buildDetailQuery(false);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Get return request detail error:', error.message, error.details, error.hint);
      return { success: false, error: `查詢失敗: ${error.message}` };
    }

    if (!data) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    if (usedResolutionFallback) {
      const row = data as unknown as Record<string, unknown>;
      row.return_items = applyFallbackResolutionTypeToItems(
        row.return_items as Array<Record<string, unknown>> | null | undefined,
        row.refund_method
      );
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
 * Admin: Delete return request and related data
 */
export async function deleteReturnRequest(
  returnRequestId: string,
  userId: string
): Promise<ApiResponse> {
  try {
    const adminClient = createAdminClient();

    // Get return request info for logging
    const { data: returnRequest, error: fetchError } = await adminClient
      .from('return_requests')
      .select('id, request_number')
      .eq('id', returnRequestId)
      .single() as { data: { id: string; request_number: string } | null; error: Error | null };

    if (fetchError || !returnRequest) {
      return { success: false, error: ERROR_MESSAGES.NOT_FOUND };
    }

    // Delete related data first (foreign key constraints)
    // Delete return images
    const { error: deleteImagesError } = await adminClient
      .from('return_images')
      .delete()
      .eq('return_request_id', returnRequestId);

    if (deleteImagesError) {
      console.error('Delete return_images error:', deleteImagesError);
      return { success: false, error: '刪除退貨圖片失敗' };
    }

    // Delete return items
    const { error: deleteItemsError } = await adminClient
      .from('return_items')
      .delete()
      .eq('return_request_id', returnRequestId);

    if (deleteItemsError) {
      console.error('Delete return_items error:', deleteItemsError);
      return { success: false, error: '刪除退貨商品失敗' };
    }

    // Delete inspection records
    const { error: deleteInspectionError } = await adminClient
      .from('inspection_records')
      .delete()
      .eq('return_request_id', returnRequestId);

    if (deleteInspectionError) {
      console.error('Delete inspection_records error:', deleteInspectionError);
      return { success: false, error: '刪除驗貨記錄失敗' };
    }

    // Delete activity logs related to this return request
    const { error: deleteLogsError } = await adminClient
      .from('activity_logs')
      .delete()
      .eq('entity_type', 'return_request')
      .eq('entity_id', returnRequestId);

    if (deleteLogsError) {
      console.error('Delete activity_logs error:', deleteLogsError);
      return { success: false, error: '刪除活動紀錄失敗' };
    }

    // Finally delete the return request itself
    const { error: deleteError } = await adminClient
      .from('return_requests')
      .delete()
      .eq('id', returnRequestId);

    if (deleteError) {
      console.error('Delete return request error:', deleteError);
      return { success: false, error: '刪除退貨單失敗' };
    }

    // Log deletion (to a general log, not entity-specific)
    console.log(`Return request ${returnRequest.request_number} deleted by user ${userId}`);

    return { success: true, message: '退貨單已刪除' };
  } catch (error) {
    console.error('Delete return request error:', error);
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

    const buildQuery = (includeResolutionType: boolean) => {
      const returnItemsSelect = includeResolutionType
        ? `
          product_name,
          quantity,
          resolution_type
        `
        : `
          product_name,
          quantity
        `;

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
            ${returnItemsSelect}
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

      return query;
    };

    let { data, error } = await buildQuery(true);
    let usedResolutionFallback = false;

    if (error && isMissingColumnError(error, 'return_items', 'resolution_type')) {
      await emitSchemaDriftAlert({
        source: 'return.actions.getReturnsForExport',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: error.message,
      });
      usedResolutionFallback = true;
      const retry = await buildQuery(false);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Get returns for export error:', error);
      return { success: false, error: ERROR_MESSAGES.GENERIC };
    }

    // Transform data for Excel export
    const exportData = data?.map((r: Record<string, unknown>) => {
      const itemResolutions = usedResolutionFallback
        ? applyFallbackResolutionTypeToItems(
            (r.return_items as Array<Record<string, unknown>> | null | undefined) || [],
            r.refund_method
          )
        : ((r.return_items as Array<{ resolution_type?: string | null }> | undefined) || []);
      const resolutionLabels = Array.from(
        new Set(
          itemResolutions
            .map((item) => {
              const key = item.resolution_type;
              const match = Object.values(RETURN_ITEM_RESOLUTION_TYPES).find((type) => type.key === key);
              return match?.label;
            })
            .filter(Boolean) as string[]
        )
      );
      const resolutionSummary = resolutionLabels.join('、') || RETURN_ITEM_RESOLUTION_TYPES.FULL.label;

      return {
        '申請編號': r.request_number,
        '訂單編號': (r.order as Record<string, unknown>)?.order_number,
        '客戶姓名': (r.order as Record<string, unknown>)?.customer_name,
        '客戶電話': (r.order as Record<string, unknown>)?.customer_phone,
        '通路來源': r.channel_source,
        '狀態': r.status,
        '退貨原因': r.reason_category,
        '原因說明': r.reason_detail,
        '商品': (r.return_items as Array<{ product_name: string; quantity: number }>)?.map((i) => `${i.product_name} x${i.quantity}`).join(', '),
        '處理方式': resolutionSummary,
        '退款金額': r.refund_amount,
        '退款方式(財務)': r.refund_method,
        '申請時間': r.created_at,
        '核准時間': r.approved_at,
        '收貨時間': r.received_at,
        '退款時間': r.refund_processed_at,
        '結案時間': r.closed_at,
      };
    });

    return { success: true, data: exportData };
  } catch (error) {
    console.error('Get returns for export error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}

/**
 * Admin: Manually create a return request
 */
export async function createManualReturnRequest(input: {
  customerName?: string;
  customerPhone?: string;
  orderNumber: string;
  channelSource: string;
  reasonCategory?: string;
  reasonDetail?: string;
  refundAmount?: number;
  items: {
    productName: string;
    productSku?: string;
    quantity: number;
    unitPrice?: number;
  }[];
}): Promise<ApiResponse<{ id: string; requestNumber: string }>> {
  try {
    const adminClient = createAdminClient();

    if (!input.orderNumber.trim()) {
      return { success: false, error: '請輸入訂單編號' };
    }
    if (!input.items || input.items.length === 0 || !input.items[0].productName.trim()) {
      return { success: false, error: '請至少輸入一項退貨商品' };
    }

    // Find or create customer
    let customerId: string | null = null;
    if (input.customerPhone?.trim()) {
      const { data: existingCustomer } = await adminClient
        .from('customers')
        .select('id')
        .eq('phone', input.customerPhone.trim())
        .single();

      if (existingCustomer) {
        customerId = (existingCustomer as { id: string }).id;
      } else {
        const { data: newCustomer, error: customerError } = await adminClient
          .from('customers')
          .insert({
            phone: input.customerPhone.trim(),
            name: input.customerName?.trim() || null,
          } as never)
          .select('id')
          .single();

        if (!customerError && newCustomer) {
          customerId = (newCustomer as { id: string }).id;
        }
      }
    }

    // Find or create order
    let orderId: string | null = null;
    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('id')
      .eq('order_number', input.orderNumber.trim())
      .single();

    if (existingOrder) {
      orderId = (existingOrder as { id: string }).id;
    } else {
      const { data: newOrder, error: orderError } = await adminClient
        .from('orders')
        .insert({
          order_number: input.orderNumber.trim(),
          channel_source: input.channelSource,
          customer_id: customerId,
          customer_phone: input.customerPhone?.trim() || null,
          customer_name: input.customerName?.trim() || null,
          status: 'delivered',
        } as never)
        .select('id')
        .single();

      if (orderError) {
        console.error('Create order error:', orderError);
        return { success: false, error: `建立訂單失敗: ${orderError.message}` };
      }
      orderId = (newOrder as { id: string }).id;
    }

    // Create return request
    const { data: returnRequest, error: insertError } = await adminClient
      .from('return_requests')
      .insert({
        order_id: orderId,
        customer_id: customerId,
        channel_source: input.channelSource,
        reason_category: input.reasonCategory || null,
        reason_detail: input.reasonDetail || null,
        refund_amount: input.refundAmount || null,
        status: 'pending_review',
      } as never)
      .select('id, request_number')
      .single() as { data: { id: string; request_number: string } | null; error: Error | null };

    if (insertError || !returnRequest) {
      console.error('Create return request error:', insertError);
      return { success: false, error: `建立退貨單失敗: ${insertError?.message || '未知錯誤'}` };
    }

    // Insert return items
    const returnItems = input.items
      .filter((item) => item.productName.trim())
      .map((item) => ({
        return_request_id: returnRequest.id,
        product_name: item.productName.trim(),
        product_sku: item.productSku?.trim() || null,
        quantity: item.quantity || 1,
        unit_price: item.unitPrice || null,
        resolution_type: RETURN_ITEM_RESOLUTION_TYPES.FULL.key,
      }));

    if (returnItems.length > 0) {
      const { error: itemInsertError } = await insertReturnItemsWithResolutionFallback(
        adminClient,
        returnItems as Array<Record<string, unknown>>,
        'return.actions.createManualReturnRequest',
        { returnRequestId: returnRequest.id }
      );
      if (itemInsertError) {
        console.error('Create manual return items error:', itemInsertError);
        return { success: false, error: `建立退貨商品失敗: ${itemInsertError.message}` };
      }
    }

    // Log activity
    await adminClient.from('activity_logs').insert({
      entity_type: 'return_request',
      entity_id: returnRequest.id,
      action: 'created',
      actor_type: 'user',
      description: `管理員手動建立退貨申請: ${returnRequest.request_number}`,
    } as never);

    return {
      success: true,
      data: { id: returnRequest.id, requestNumber: returnRequest.request_number },
    };
  } catch (error) {
    console.error('Create manual return request error:', error);
    return { success: false, error: ERROR_MESSAGES.GENERIC };
  }
}
