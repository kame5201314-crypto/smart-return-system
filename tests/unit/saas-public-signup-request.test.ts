/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleSaaSPublicSignupRequest } from '@/app/api/saas/signup/route';
import type {
  SaaSPublicSignupRequestRepository,
  SaaSPublicSignupRequestRepositoryFactory,
} from '@/lib/saas/signup-request';
import {
  buildSaaSPublicSignupRequestInsert,
  createSaaSPublicSignupRequestRepository,
  type SignupRequestQueryClient,
} from '@/lib/saas/signup-request-repository';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createRepository(): SaaSPublicSignupRequestRepository {
  return {
    createRequest: vi.fn(async () => ({ id: 'signup-request-1' })),
  };
}

describe('SaaS public signup API', () => {
  it('blocks signup before validating or persisting when the public signup flag is closed', async () => {
    const repository = createRepository();
    const repositoryFactory = vi.fn(() => repository);
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({}),
      {
        env: {},
        repository: repositoryFactory,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'feature_disabled',
    });
    expect(repositoryFactory).not.toHaveBeenCalled();
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('validates required fields after public signup is enabled', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'not-an-email',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
        repository,
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'invalid_request',
    });
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('returns not configured when the flag is enabled but persistence is not wired', async () => {
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'owner@example.com',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
      }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'not_configured',
    });
  });

  it('returns not configured when the default repository cannot be created', async () => {
    const repositoryFactory: SaaSPublicSignupRequestRepositoryFactory = vi.fn(() => {
      throw new Error('Missing Supabase admin credentials');
    });
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'owner@example.com',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
        repository: repositoryFactory,
      }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'not_configured',
    });
    expect(repositoryFactory).toHaveBeenCalledOnce();
  });

  it('accepts a valid Basic signup request through an injected repository', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'OWNER@EXAMPLE.COM',
        phone: '0912-345-678',
        plan: 'growth',
        monthlyReturnVolume: '1200',
        message: 'Need a trial workspace.',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
        repository,
      }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        accepted: true,
        mode: 'public_signup',
        requestId: 'signup-request-1',
      },
    });
    expect(repository.createRequest).toHaveBeenCalledWith({
      companyName: 'Demo Store',
      contactName: 'Owner',
      email: 'owner@example.com',
      phone: '0912-345-678',
      plan: 'basic',
      monthlyReturnVolume: 1200,
      message: 'Need a trial workspace.',
    });
  });

  it('maps signup input to the signup_requests insert payload', () => {
    expect(
      buildSaaSPublicSignupRequestInsert({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'owner@example.com',
        plan: 'basic',
        monthlyReturnVolume: 1200,
      })
    ).toEqual({
      company_name: 'Demo Store',
      contact_name: 'Owner',
      email: 'owner@example.com',
      phone: null,
      plan: 'basic',
      monthly_return_volume: 1200,
      message: null,
      status: 'pending',
      source: 'public_signup',
    });
  });

  it('persists signup requests through the Supabase repository', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'signup-request-1',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const client = { from } satisfies SignupRequestQueryClient;

    const repository = createSaaSPublicSignupRequestRepository(client);
    const result = await repository.createRequest({
      companyName: 'Demo Store',
      contactName: 'Owner',
      email: 'owner@example.com',
      phone: '0912-345-678',
      plan: 'basic',
      monthlyReturnVolume: 1200,
      message: 'Need a trial workspace.',
    });

    expect(result).toEqual({ id: 'signup-request-1' });
    expect(from).toHaveBeenCalledWith('signup_requests');
    expect(insert).toHaveBeenCalledWith({
      company_name: 'Demo Store',
      contact_name: 'Owner',
      email: 'owner@example.com',
      phone: '0912-345-678',
      plan: 'basic',
      monthly_return_volume: 1200,
      message: 'Need a trial workspace.',
      status: 'pending',
      source: 'public_signup',
    });
    expect(select).toHaveBeenCalledWith('id');
  });

  it('surfaces Supabase insert errors as request failures', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: {
                message: 'relation "signup_requests" does not exist',
              },
            })),
          })),
        })),
      })),
    } satisfies SignupRequestQueryClient;

    const repository = createSaaSPublicSignupRequestRepository(client);
    await expect(
      repository.createRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'owner@example.com',
        plan: 'basic',
      })
    ).rejects.toThrow(/signup_requests/);
  });
});
