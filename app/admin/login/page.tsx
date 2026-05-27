import { redirect } from 'next/navigation';

import { normalizeInternalNextPath } from '@/lib/auth/internal-login-redirect';

interface AdminLoginPageProps {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = normalizeInternalNextPath(firstParam(params.next));

  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}
