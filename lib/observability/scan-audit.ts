import { createUntypedAdminClient } from '@/lib/supabase/admin';

type ScanAuditActionType =
  | 'manual_bind_unmatched'
  | 'update_shopee_status'
  | 'update_pickup_status';

type ScanAuditEntityTable =
  | 'shopee_returns'
  | 'pickup_records'
  | 'shopee_unmatched_scans';

interface ScanAuditPayload {
  actionType: ScanAuditActionType;
  entityTable: ScanAuditEntityTable;
  entityId: string;
  actor?: string | null;
  reason?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

function normalizeActor(value: string | null | undefined): string {
  const actor = String(value || '').trim();
  return actor || 'system';
}

function isMissingAuditTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';
  const code = 'code' in error ? String((error as { code?: string }).code || '') : '';
  return (
    message.includes('does not exist')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
    || code === '42P01'
    || code === 'PGRST205'
  );
}

export async function recordScanAuditLog(payload: ScanAuditPayload): Promise<void> {
  try {
    const supabase = createUntypedAdminClient();
    const tableClient = supabase.from('scan_audit_logs') as unknown as {
      insert?: (payload: unknown) => Promise<{ error?: unknown }> | { then?: unknown };
    };
    if (typeof tableClient.insert !== 'function') {
      return;
    }

    const result = await tableClient.insert({
      action_type: payload.actionType,
      entity_table: payload.entityTable,
      entity_id: payload.entityId,
      actor: normalizeActor(payload.actor),
      reason: payload.reason || null,
      before_state: payload.beforeState || null,
      after_state: payload.afterState || null,
      metadata: payload.metadata || null,
    } as never) as { error?: unknown };
    const { error } = result;

    if (error && !isMissingAuditTableError(error)) {
      console.error('recordScanAuditLog error:', error);
    }
  } catch (error) {
    if (!isMissingAuditTableError(error)) {
      console.error('recordScanAuditLog unexpected error:', error);
    }
  }
}
