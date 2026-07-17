import { ADMIN_UUID } from '@/lib/auth/admin-session';
import type { PlatformAdminContext } from '@/lib/saas/platform-admin';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type PlatformOrgNoteType = 'contact' | 'follow_up' | 'internal';

export interface PlatformOrgNoteInput {
  orgId: string;
  noteType: PlatformOrgNoteType;
  note: string;
  followUpAt: string | null;
}

export class PlatformOrgNoteError extends Error {
  constructor(
    public readonly code: 'invalid_request' | 'request_failed',
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PlatformOrgNoteError';
  }
}

interface QueryResult {
  error: { message?: string } | null;
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  insert(values: Record<string, unknown>): QueryBuilder;
}

export interface PlatformOrgNoteQueryClient {
  from(table: string): QueryBuilder;
}

export interface PlatformOrgNoteRepository {
  insertNote(input: {
    orgId: string;
    actorUserId: string | null;
    actorEmail: string | null;
    noteType: PlatformOrgNoteType;
    note: string;
    followUpAt: string | null;
  }): Promise<void>;
}

function invalid(message: string): never {
  throw new PlatformOrgNoteError('invalid_request', 400, message);
}

function normalizeOrgId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    invalid('租戶識別碼格式不正確。');
  }
  return normalized;
}

function normalizeNoteType(value: unknown): PlatformOrgNoteType {
  if (value === 'contact' || value === 'follow_up' || value === 'internal') return value;
  return invalid('請選擇有效的紀錄類型。');
}

function normalizeNote(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < 4) invalid('紀錄內容至少需要 4 個字。');
  if (normalized.length > 1000) invalid('紀錄內容不可超過 1000 個字。');
  return normalized;
}

function normalizeFollowUpAt(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') invalid('下次跟進時間格式不正確。');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid('下次跟進時間格式不正確。');
  return date.toISOString();
}

export function normalizePlatformOrgNoteInput(value: unknown, orgId: unknown): PlatformOrgNoteInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid('請求內容格式不正確。');
  }
  const body = value as Record<string, unknown>;
  return {
    orgId: normalizeOrgId(orgId),
    noteType: normalizeNoteType(body.noteType),
    note: normalizeNote(body.note),
    followUpAt: normalizeFollowUpAt(body.followUpAt),
  };
}

export function createPlatformOrgNoteRepository(
  client: PlatformOrgNoteQueryClient
): PlatformOrgNoteRepository {
  return {
    async insertNote(input) {
      const { error } = await client.from('audit_logs').insert({
        org_id: input.orgId,
        actor_user_id: input.actorUserId,
        action: 'platform.org.note_added',
        target_type: 'organization',
        target_id: input.orgId,
        metadata: {
          note_type: input.noteType,
          note: input.note,
          follow_up_at: input.followUpAt,
          actor_email: input.actorEmail,
        },
      });
      if (error) {
        throw new PlatformOrgNoteError(
          'request_failed',
          500,
          error.message || '營運紀錄儲存失敗。'
        );
      }
    },
  };
}

export function createDefaultPlatformOrgNoteRepository(): PlatformOrgNoteRepository {
  return createPlatformOrgNoteRepository(
    createUntypedAdminClient() as unknown as PlatformOrgNoteQueryClient
  );
}

export async function recordPlatformOrgNote(
  value: unknown,
  orgId: unknown,
  access: PlatformAdminContext,
  repository: PlatformOrgNoteRepository = createDefaultPlatformOrgNoteRepository()
): Promise<PlatformOrgNoteInput> {
  const input = normalizePlatformOrgNoteInput(value, orgId);
  await repository.insertNote({
    ...input,
    actorUserId: access.userId === ADMIN_UUID ? null : access.userId,
    actorEmail: access.userEmail ?? null,
  });
  return input;
}
