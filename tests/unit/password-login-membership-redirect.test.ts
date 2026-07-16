import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: supabaseMocks.createClient,
}));

import { signIn } from '@/lib/actions/auth';

interface MembershipRow {
  org_id: string;
  status: string | null;
}

function createMerchantAuthClient(input: {
  userId?: string;
  email?: string | null;
  memberships?: MembershipRow[];
  membershipError?: { message: string } | null;
}) {
  const order = vi.fn().mockResolvedValue({
    data: input.memberships ?? [],
    error: input.membershipError ?? null,
  });
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const signInWithPassword = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: input.userId ?? 'merchant-user',
        email: input.email === undefined ? 'merchant@example.com' : input.email,
      },
    },
    error: null,
  });

  return {
    client: {
      auth: { signInWithPassword, signOut },
      from,
    },
    from,
    select,
    eq,
    order,
    signInWithPassword,
    signOut,
  };
}

describe('password login membership-aware redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'admin-password');
    vi.stubEnv('PLATFORM_ADMIN_ROLES', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('sends an active merchant to a safe requested customer page', async () => {
    const auth = createMerchantAuthClient({
      memberships: [{ org_id: 'org-active', status: 'active' }],
    });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('merchant@example.com', 'Password8', '/returns')).resolves.toEqual({
      success: true,
      redirectTo: '/returns',
    });

    expect(auth.from).toHaveBeenCalledWith('organization_members');
    expect(auth.select).toHaveBeenCalledWith('org_id, status');
    expect(auth.eq).toHaveBeenCalledWith('user_id', 'merchant-user');
    expect(auth.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('does not honor an internal requested path for an active merchant', async () => {
    const auth = createMerchantAuthClient({
      memberships: [{ org_id: 'org-active', status: null }],
    });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('merchant@example.com', 'Password8', '/internal/orgs')).resolves.toEqual({
      success: true,
      redirectTo: '/analytics',
    });
  });

  it('requires a merchant without memberships to complete onboarding', async () => {
    const auth = createMerchantAuthClient({ memberships: [] });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('new@example.com', 'Password8', '/analytics')).resolves.toEqual({
      success: true,
      redirectTo: '/signup/complete?plan=basic',
    });
  });

  it('keeps a disabled merchant in the existing disabled-membership completion state', async () => {
    const auth = createMerchantAuthClient({
      memberships: [{ org_id: 'org-disabled', status: 'disabled' }],
    });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('disabled@example.com', 'Password8')).resolves.toEqual({
      success: true,
      redirectTo: '/signup/complete?plan=basic&state=membership_disabled',
    });
  });

  it('applies the same onboarding gate to Taiwan phone password login', async () => {
    const auth = createMerchantAuthClient({
      email: null,
      memberships: [],
    });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('0912-345-678', 'Password8')).resolves.toEqual({
      success: true,
      redirectTo: '/signup/complete?plan=basic',
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      phone: '+886912345678',
      password: 'Password8',
      options: undefined,
    });
  });

  it('keeps explicit platform admins on the internal console without a merchant lookup', async () => {
    vi.stubEnv('PLATFORM_ADMIN_ROLES', 'operator@example.com=owner');
    const auth = createMerchantAuthClient({
      userId: 'platform-user',
      email: 'operator@example.com',
    });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('operator@example.com', 'Password8', '/internal/orgs')).resolves.toEqual({
      success: true,
      redirectTo: '/internal/orgs',
    });
    expect(auth.from).not.toHaveBeenCalled();
  });

  it('fails closed and clears the new session when membership lookup fails', async () => {
    const auth = createMerchantAuthClient({
      membershipError: { message: 'temporary membership lookup failure' },
    });
    supabaseMocks.createClient.mockResolvedValue(auth.client);

    await expect(signIn('merchant@example.com', 'Password8')).resolves.toEqual({
      success: false,
      error: '登入後無法確認工作區權限，請稍後再試',
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
