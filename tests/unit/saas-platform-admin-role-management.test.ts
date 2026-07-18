/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  handleListPlatformAdminRoles,
  handleManagePlatformAdminRole,
} from '@/app/api/internal/saas/platform-admins/route';
import {
  buildPlatformAdminRoleManagementRpcArgs,
  createPlatformAdminRoleManagementRepository,
  normalizePlatformAdminRoleManagementRequest,
  PlatformAdminRoleManagementError,
  type PlatformAdminRoleAssignment,
  type PlatformAdminRoleManagementRepository,
} from '@/lib/saas/platform-admin-role-management';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';

const actorUserId = '22222222-2222-4222-8222-222222222222';
const roleAssignmentId = '33333333-3333-4333-8333-333333333333';
const auditLogId = '44444444-4444-4444-8444-444444444444';

const platformAdminContext: PlatformAdminContext = {
  userId: actorUserId,
  userEmail: 'owner@example.com',
  isPlatformAdmin: true,
  platformRole: 'owner',
  permissions: getPlatformAdminPermissions('owner'),
  featureFlags: resolveSaaSFeatureFlags({
    env: {
      ENABLE_MULTI_TENANT_ADMIN: 'true',
    },
    orgPlan: 'enterprise',
  }),
};

const assignment: PlatformAdminRoleAssignment = {
  id: roleAssignmentId,
  principalType: 'email',
  principal: 'support@example.com',
  role: 'support',
  status: 'active',
  note: 'Manual Beta support',
  createdBy: actorUserId,
  updatedBy: actorUserId,
  createdAt: '2026-05-26T00:00:00.000Z',
  updatedAt: '2026-05-26T00:00:00.000Z',
};

function buildJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/internal/saas/platform-admins', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createRepository(): PlatformAdminRoleManagementRepository {
  return {
    listRoleAssignments: vi.fn(async () => [assignment]),
    manageRoleAssignment: vi.fn(async (input) => ({
      ...assignment,
      operation: input.operation,
      role: input.role ?? assignment.role,
      status: input.operation === 'disable' ? 'disabled' as const : 'active' as const,
      auditLogId,
    })),
  };
}

describe('SaaS platform admin role management', () => {
  it('normalizes upsert requests and maps them to the RPC payload', () => {
    const input = normalizePlatformAdminRoleManagementRequest(
      {
        operation: 'upsert',
        principalType: 'email',
        principal: ' SUPPORT@Example.COM ',
        role: 'support',
        note: 'Manual Beta support',
      },
      actorUserId
    );

    expect(input).toEqual({
      operation: 'upsert',
      principalType: 'email',
      principal: 'support@example.com',
      role: 'support',
      actorUserId,
      note: 'Manual Beta support',
    });
    expect(buildPlatformAdminRoleManagementRpcArgs(input)).toEqual({
      p_operation: 'upsert',
      p_principal_type: 'email',
      p_principal: 'support@example.com',
      p_role: 'support',
      p_actor_user_id: actorUserId,
      p_note: 'Manual Beta support',
    });
  });

  it('normalizes disable requests without requiring a new role', () => {
    const input = normalizePlatformAdminRoleManagementRequest(
      {
        operation: 'disable',
        principal_type: 'user_id',
        principal: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      },
      actorUserId
    );

    expect(input).toMatchObject({
      operation: 'disable',
      principalType: 'user_id',
      principal: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: null,
    });
  });

  it('rejects invalid role management payloads before repository writes', () => {
    expect(() =>
      normalizePlatformAdminRoleManagementRequest(
        {
          operation: 'upsert',
          principalType: 'email',
          principal: 'not-an-email',
          role: 'support',
        },
        actorUserId
      )
    ).toThrow(PlatformAdminRoleManagementError);

    expect(() =>
      normalizePlatformAdminRoleManagementRequest(
        {
          operation: 'upsert',
          principalType: 'email',
          principal: 'support@example.com',
          role: 'superuser',
        },
        actorUserId
      )
    ).toThrow('role must be one of owner, support, or billing.');
  });

  it('lists role assignments through the guarded internal route', async () => {
    const repository = createRepository();
    const response = await handleListPlatformAdminRoles(
      new NextRequest('http://localhost/api/internal/saas/platform-admins?limit=999'),
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        managementReady: true,
        source: 'database',
        assignments: [
          {
            id: roleAssignmentId,
            role: 'support',
          },
        ],
      },
    });
    expect(repository.listRoleAssignments).toHaveBeenCalledWith({ limit: 999 });
  });

  it('falls back to the authenticated runtime role while migration 036 is unavailable', async () => {
    const repository = createRepository();
    vi.mocked(repository.listRoleAssignments).mockRejectedValueOnce(
      new PlatformAdminRoleManagementError(
        'operation_failed',
        500,
        "Could not find the table 'public.platform_admin_roles' in the schema cache"
      )
    );

    const response = await handleListPlatformAdminRoles(
      new NextRequest('http://localhost/api/internal/saas/platform-admins?limit=20'),
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        source: 'runtime_access',
        managementReady: false,
        assignments: [
          {
            id: `runtime:${actorUserId}`,
            principalType: 'email',
            principal: platformAdminContext.userEmail,
            role: 'owner',
            status: 'active',
          },
        ],
      },
    });
  });

  it('manages a role assignment through the guarded internal route', async () => {
    const repository = createRepository();
    const response = await handleManagePlatformAdminRole(
      buildJsonRequest({
        operation: 'upsert',
        principalType: 'email',
        principal: 'billing@example.com',
        role: 'billing',
      }),
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        operation: 'upsert',
        role: 'billing',
        auditLogId,
      },
    });
    expect(repository.manageRoleAssignment).toHaveBeenCalledWith(expect.objectContaining({
      principal: 'billing@example.com',
      role: 'billing',
      actorUserId,
    }));
  });

  it('blocks access before parsing JSON when the platform role is not allowed', async () => {
    const repository = createRepository();
    const response = await handleManagePlatformAdminRole(
      new NextRequest('http://localhost/api/internal/saas/platform-admins', {
        method: 'POST',
        body: '{bad json',
      }),
      {
        requireAccess: async () => {
          throw new PlatformAdminAccessError(
            'permission_denied',
            403,
            'Platform admin permission is required: manage_platform_roles.'
          );
        },
        repository,
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'permission_denied',
    });
    expect(repository.manageRoleAssignment).not.toHaveBeenCalled();
  });

  it('wraps the Supabase repository query and RPC contracts', async () => {
    const selectedBuilder = {
      order: vi.fn(() => selectedBuilder),
      limit: vi.fn(async () => ({
        data: [{
          id: roleAssignmentId,
          principal_type: 'email',
          principal: 'support@example.com',
          role: 'support',
          status: 'active',
          note: null,
          created_by: actorUserId,
          updated_by: actorUserId,
          created_at: '2026-05-26T00:00:00.000Z',
          updated_at: '2026-05-26T00:00:00.000Z',
        }],
        error: null,
      })),
    };
    const listBuilder = {
      select: vi.fn(() => selectedBuilder),
    };
    const client = {
      from: vi.fn(() => listBuilder),
      rpc: vi.fn(async () => ({
        data: {
          operation: 'disable',
          id: roleAssignmentId,
          principal_type: 'email',
          principal: 'support@example.com',
          role: 'support',
          status: 'disabled',
          note: null,
          created_by: actorUserId,
          updated_by: actorUserId,
          created_at: '2026-05-26T00:00:00.000Z',
          updated_at: '2026-05-26T00:00:00.000Z',
          audit_log_id: auditLogId,
        },
        error: null,
      })),
    };
    const repository = createPlatformAdminRoleManagementRepository(client as never);

    await expect(repository.listRoleAssignments({ limit: 200 })).resolves.toHaveLength(1);
    await expect(repository.manageRoleAssignment({
      operation: 'disable',
      principalType: 'email',
      principal: 'support@example.com',
      role: null,
      actorUserId,
      note: null,
    })).resolves.toMatchObject({
      operation: 'disable',
      status: 'disabled',
      auditLogId,
    });
    expect(selectedBuilder.limit).toHaveBeenCalledWith(100);
    expect(client.rpc).toHaveBeenCalledWith('manage_platform_admin_role', expect.objectContaining({
      p_operation: 'disable',
      p_principal: 'support@example.com',
    }));
  });
});
