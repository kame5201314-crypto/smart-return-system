import { cookies } from 'next/headers';

import { ADMIN_UUID } from '@/lib/auth/admin-session';
import {
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import type { PlatformOrgDetail } from '@/lib/saas/platform-admin-data';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const PLATFORM_TENANT_PREVIEW_COOKIE = 'platform_tenant_preview';
export const PLATFORM_TENANT_PREVIEW_MAX_AGE_SECONDS = 60 * 60;

export interface PlatformTenantPreviewPayload {
  kind: 'platform_tenant_preview';
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  adminUserId: string;
  adminEmail: string | null;
  platformRole: PlatformAdminContext['platformRole'];
  iat: number;
  exp: number;
  nonce: string;
}

export type PlatformTenantPreviewMode =
  | {
      state: 'ready';
      preview: {
        orgId: string;
        orgName: string;
        orgSlug: string | null;
        adminUserId: string;
        adminEmail: string | null;
        platformRole: PlatformAdminContext['platformRole'];
        expiresAt: string;
        exitPath: '/internal/orgs';
      };
    }
  | {
      state: 'hidden';
      reason: 'missing' | 'invalid' | 'expired' | 'access_denied';
    };

export interface CreatePlatformTenantPreviewSessionInput {
  access: PlatformAdminContext;
  organization: Pick<PlatformOrgDetail, 'id' | 'name' | 'slug'>;
  now?: Date;
}

export type PlatformTenantPreviewAuditAction =
  | 'platform.tenant_preview_started'
  | 'platform.tenant_preview_cleared';

export interface PlatformTenantPreviewAuditTarget {
  orgId: string | null;
  orgName: string | null;
  orgSlug: string | null;
}

export interface PlatformTenantPreviewAuditInput {
  action: PlatformTenantPreviewAuditAction;
  access: PlatformAdminContext;
  target: PlatformTenantPreviewAuditTarget | null;
  previewExpiresAt?: string | null;
  reason?: string | null;
}

export interface PlatformTenantPreviewAuditResult {
  auditLogId: string | null;
}

export interface PlatformTenantPreviewAuditRepository {
  recordPreviewAudit(
    input: PlatformTenantPreviewAuditInput
  ): Promise<PlatformTenantPreviewAuditResult>;
}

export interface LoadPlatformTenantPreviewModeOptions {
  requireAccess?: () => Promise<PlatformAdminContext>;
  getToken?: (() => Promise<string | undefined | null>) | string | undefined | null;
  now?: Date;
}

export const PLATFORM_TENANT_PREVIEW_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: PLATFORM_TENANT_PREVIEW_MAX_AGE_SECONDS,
  path: '/',
};

interface SupabasePreviewAuditError {
  message?: string;
}

interface SupabasePreviewAuditInsertBuilder {
  select(columns: string): {
    maybeSingle(): Promise<{
      data: unknown;
      error: SupabasePreviewAuditError | null;
    }>;
  };
}

interface SupabasePreviewAuditTableBuilder {
  insert(values: Record<string, unknown>): SupabasePreviewAuditInsertBuilder;
}

export interface PlatformTenantPreviewAuditQueryClient {
  from(table: string): SupabasePreviewAuditTableBuilder;
}

function getSessionSecret(): string {
  const secret = (process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) {
    throw new Error('Missing platform tenant preview session secret.');
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url: string): Uint8Array {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function encodePayload(payload: PlatformTenantPreviewPayload): string {
  return toBase64Url(textEncoder.encode(JSON.stringify(payload)));
}

function decodePayload(value: string): PlatformTenantPreviewPayload | null {
  try {
    return JSON.parse(textDecoder.decode(fromBase64Url(value))) as PlatformTenantPreviewPayload;
  } catch {
    return null;
  }
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signPayload(encodedPayload: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(encodedPayload));
  return toBase64Url(new Uint8Array(signature));
}

function isValidPayload(value: PlatformTenantPreviewPayload | null): value is PlatformTenantPreviewPayload {
  return (
    value?.kind === 'platform_tenant_preview' &&
    typeof value.orgId === 'string' &&
    value.orgId.trim().length > 0 &&
    typeof value.orgName === 'string' &&
    typeof value.adminUserId === 'string' &&
    value.adminUserId.trim().length > 0 &&
    typeof value.iat === 'number' &&
    typeof value.exp === 'number' &&
    typeof value.nonce === 'string' &&
    value.nonce.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeAuditLogId(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }

  return stringOrNull(data.id);
}

function resolveAuditActorUserId(access: PlatformAdminContext): string | null {
  return access.userId === ADMIN_UUID ? null : access.userId;
}

export async function createPlatformTenantPreviewToken(
  input: CreatePlatformTenantPreviewSessionInput
): Promise<{ token: string; payload: PlatformTenantPreviewPayload }> {
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const payload: PlatformTenantPreviewPayload = {
    kind: 'platform_tenant_preview',
    orgId: input.organization.id,
    orgName: input.organization.name,
    orgSlug: input.organization.slug,
    adminUserId: input.access.userId,
    adminEmail: input.access.userEmail ?? null,
    platformRole: input.access.platformRole,
    iat: now,
    exp: now + PLATFORM_TENANT_PREVIEW_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = encodePayload(payload);
  const signature = await signPayload(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function createPlatformTenantPreviewAuditRepository(
  client: PlatformTenantPreviewAuditQueryClient
): PlatformTenantPreviewAuditRepository {
  return {
    async recordPreviewAudit(input) {
      const metadata = {
        actor_user_id: input.access.userId,
        actor_email: input.access.userEmail ?? null,
        platform_role: input.access.platformRole,
        org_id: input.target?.orgId ?? null,
        org_name: input.target?.orgName ?? null,
        org_slug: input.target?.orgSlug ?? null,
        preview_expires_at: input.previewExpiresAt ?? null,
        reason: input.reason ?? null,
      };

      const { data, error } = await client
        .from('audit_logs')
        .insert({
          org_id: input.target?.orgId ?? null,
          actor_user_id: resolveAuditActorUserId(input.access),
          action: input.action,
          target_type: 'organization',
          target_id: input.target?.orgId ?? null,
          metadata,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Failed to write platform tenant preview audit log.');
      }

      return {
        auditLogId: normalizeAuditLogId(data),
      };
    },
  };
}

export async function verifyPlatformTenantPreviewToken(
  token: string | undefined | null,
  now = new Date()
): Promise<PlatformTenantPreviewPayload | null> {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  const payload = decodePayload(encodedPayload);
  if (!isValidPayload(payload)) return null;

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (payload.exp <= nowSeconds) return null;

  return payload;
}

async function getDefaultPreviewToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(PLATFORM_TENANT_PREVIEW_COOKIE)?.value;
}

export async function loadPlatformTenantPreviewMode(
  options: LoadPlatformTenantPreviewModeOptions = {}
): Promise<PlatformTenantPreviewMode> {
  try {
    await (options.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_organizations',
    })))();

    const token =
      typeof options.getToken === 'function'
        ? await options.getToken()
        : options.getToken !== undefined
          ? options.getToken
          : await getDefaultPreviewToken();

    if (!token) {
      return {
        state: 'hidden',
        reason: 'missing',
      };
    }

    const payload = await verifyPlatformTenantPreviewToken(token, options.now);
    if (!payload) {
      return {
        state: 'hidden',
        reason: 'invalid',
      };
    }

    return {
      state: 'ready',
      preview: {
        orgId: payload.orgId,
        orgName: payload.orgName,
        orgSlug: payload.orgSlug,
        adminUserId: payload.adminUserId,
        adminEmail: payload.adminEmail,
        platformRole: payload.platformRole,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        exitPath: '/internal/orgs',
      },
    };
  } catch {
    return {
      state: 'hidden',
      reason: 'access_denied',
    };
  }
}
