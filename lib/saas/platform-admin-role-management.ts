import {
  normalizePlatformAdminRole,
  type PlatformAdminRole,
} from '@/lib/saas/platform-admin-roles';

export type PlatformAdminRolePrincipalType = 'email' | 'user_id';
export type PlatformAdminRoleStatus = 'active' | 'disabled';
export type PlatformAdminRoleOperation = 'upsert' | 'disable';

export interface PlatformAdminRoleAssignment {
  id: string;
  principalType: PlatformAdminRolePrincipalType;
  principal: string;
  role: PlatformAdminRole;
  status: PlatformAdminRoleStatus;
  note: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlatformAdminRoleManagementInput {
  operation: PlatformAdminRoleOperation;
  principalType: PlatformAdminRolePrincipalType;
  principal: string;
  role: PlatformAdminRole | null;
  actorUserId: string;
  note: string | null;
}

export interface PlatformAdminRoleManagementResult extends PlatformAdminRoleAssignment {
  operation: PlatformAdminRoleOperation;
  auditLogId: string | null;
}

export interface PlatformAdminRoleManagementRepository {
  listRoleAssignments(input?: { limit?: number }): Promise<PlatformAdminRoleAssignment[]>;
  manageRoleAssignment(
    input: PlatformAdminRoleManagementInput
  ): Promise<PlatformAdminRoleManagementResult>;
}

interface SupabaseRoleError {
  message?: string;
}

interface SupabaseRoleSelectBuilder {
  order(column: string, options: { ascending: boolean }): SupabaseRoleSelectBuilder;
  limit(count: number): PromiseLike<{ data: unknown; error: SupabaseRoleError | null }>;
}

interface SupabaseRoleFromBuilder {
  select(columns: string): SupabaseRoleSelectBuilder;
}

export interface PlatformAdminRoleManagementQueryClient {
  from(table: string): SupabaseRoleFromBuilder;
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: SupabaseRoleError | null }>;
}

export class PlatformAdminRoleManagementError extends Error {
  constructor(
    public readonly code: 'invalid_request' | 'operation_failed',
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PlatformAdminRoleManagementError';
  }
}

const VALID_OPERATIONS: readonly PlatformAdminRoleOperation[] = ['upsert', 'disable'];
const VALID_PRINCIPAL_TYPES: readonly PlatformAdminRolePrincipalType[] = ['email', 'user_id'];
const VALID_STATUSES: readonly PlatformAdminRoleStatus[] = ['active', 'disabled'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function failInvalid(message: string): never {
  throw new PlatformAdminRoleManagementError('invalid_request', 400, message);
}

function normalizeOperation(value: unknown): PlatformAdminRoleOperation {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (VALID_OPERATIONS.includes(normalized as PlatformAdminRoleOperation)) {
    return normalized as PlatformAdminRoleOperation;
  }
  failInvalid('operation must be one of upsert or disable.');
}

function normalizePrincipalType(value: unknown): PlatformAdminRolePrincipalType {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (VALID_PRINCIPAL_TYPES.includes(normalized as PlatformAdminRolePrincipalType)) {
    return normalized as PlatformAdminRolePrincipalType;
  }
  failInvalid('principalType must be one of email or user_id.');
}

function normalizeUuid(value: unknown, field: string): string {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    failInvalid(`${field} must be a valid UUID.`);
  }
  return normalized;
}

function normalizePrincipal(value: unknown, principalType: PlatformAdminRolePrincipalType): string {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (!normalized) {
    failInvalid('principal is required.');
  }

  if (principalType === 'user_id') {
    return normalizeUuid(normalized, 'principal');
  }

  if (!SIMPLE_EMAIL_PATTERN.test(normalized)) {
    failInvalid('principal must be a valid email address.');
  }

  return normalized;
}

function normalizeRole(value: unknown, operation: PlatformAdminRoleOperation): PlatformAdminRole | null {
  if (operation === 'disable' && (value === undefined || value === null || value === '')) {
    return null;
  }

  const role = normalizePlatformAdminRole(value);
  if (!role) {
    failInvalid('role must be one of owner, support, or billing.');
  }
  return role;
}

function normalizeNote(value: unknown): string | null {
  const normalized = stringOrNull(value);
  if (!normalized) {
    return null;
  }
  if (normalized.length > 500) {
    failInvalid('note is too long.');
  }
  return normalized;
}

function normalizeStatus(value: unknown): PlatformAdminRoleStatus {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (VALID_STATUSES.includes(normalized as PlatformAdminRoleStatus)) {
    return normalized as PlatformAdminRoleStatus;
  }
  throw new Error('Platform admin role row has an invalid status.');
}

function normalizeRoleFromRow(value: unknown): PlatformAdminRole {
  const role = normalizePlatformAdminRole(value);
  if (!role) {
    throw new Error('Platform admin role row has an invalid role.');
  }
  return role;
}

function normalizePrincipalTypeFromRow(value: unknown): PlatformAdminRolePrincipalType {
  const principalType = stringOrNull(value)?.toLowerCase();
  if (VALID_PRINCIPAL_TYPES.includes(principalType as PlatformAdminRolePrincipalType)) {
    return principalType as PlatformAdminRolePrincipalType;
  }
  throw new Error('Platform admin role row has an invalid principal type.');
}

function normalizeAssignment(row: unknown): PlatformAdminRoleAssignment | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const principal = stringOrNull(row.principal);
  if (!id || !principal) {
    return null;
  }

  return {
    id,
    principalType: normalizePrincipalTypeFromRow(row.principal_type),
    principal,
    role: normalizeRoleFromRow(row.role),
    status: normalizeStatus(row.status),
    note: stringOrNull(row.note),
    createdBy: stringOrNull(row.created_by),
    updatedBy: stringOrNull(row.updated_by),
    createdAt: stringOrNull(row.created_at),
    updatedAt: stringOrNull(row.updated_at),
  };
}

function normalizeManagementResult(data: unknown): PlatformAdminRoleManagementResult {
  const assignment = normalizeAssignment(data);
  if (!assignment || !isRecord(data)) {
    throw new Error('Platform admin role RPC returned invalid data.');
  }

  return {
    ...assignment,
    operation: normalizeOperation(data.operation),
    auditLogId: stringOrNull(data.audit_log_id),
  };
}

function assertNoError(error: SupabaseRoleError | null, fallbackMessage: string): void {
  if (error) {
    throw new PlatformAdminRoleManagementError(
      'operation_failed',
      500,
      error.message || fallbackMessage
    );
  }
}

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 100);
}

export function normalizePlatformAdminRoleManagementRequest(
  value: unknown,
  actorUserId: string
): PlatformAdminRoleManagementInput {
  if (!isRecord(value)) {
    failInvalid('Request body must be an object.');
  }

  const operation = normalizeOperation(value.operation);
  const principalType = normalizePrincipalType(value.principalType ?? value.principal_type);

  return {
    operation,
    principalType,
    principal: normalizePrincipal(value.principal, principalType),
    role: normalizeRole(value.role, operation),
    actorUserId: normalizeUuid(actorUserId, 'actorUserId'),
    note: normalizeNote(value.note),
  };
}

export function buildPlatformAdminRoleManagementRpcArgs(
  input: PlatformAdminRoleManagementInput
): Record<string, unknown> {
  return {
    p_operation: input.operation,
    p_principal_type: input.principalType,
    p_principal: input.principal,
    p_role: input.role,
    p_actor_user_id: input.actorUserId,
    p_note: input.note,
  };
}

export function createPlatformAdminRoleManagementRepository(
  client: PlatformAdminRoleManagementQueryClient
): PlatformAdminRoleManagementRepository {
  return {
    async listRoleAssignments(input = {}) {
      const { data, error } = await client
        .from('platform_admin_roles')
        .select(`
          id,
          principal_type,
          principal,
          role,
          status,
          note,
          created_by,
          updated_by,
          created_at,
          updated_at
        `)
        .order('updated_at', { ascending: false })
        .limit(clampLimit(input.limit));

      assertNoError(error, 'Failed to list platform admin role assignments.');

      return (Array.isArray(data) ? data : [])
        .map((row) => normalizeAssignment(row))
        .filter((row): row is PlatformAdminRoleAssignment => row !== null);
    },

    async manageRoleAssignment(input) {
      const { data, error } = await client.rpc(
        'manage_platform_admin_role',
        buildPlatformAdminRoleManagementRpcArgs(input)
      );

      assertNoError(error, 'Failed to manage platform admin role assignment.');
      return normalizeManagementResult(data);
    },
  };
}
