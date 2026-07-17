import { NextResponse } from 'next/server';

import { resolvePasswordRecoveryAvailability } from '@/lib/auth/password-recovery';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
};

export function handlePasswordRecoveryReadiness(
  env: Record<string, string | undefined> = process.env
) {
  const availability = resolvePasswordRecoveryAvailability(env);

  return NextResponse.json(
    {
      success: true,
      data: {
        emailEnabled: availability.emailEnabled,
        phoneEnabled: availability.phoneEnabled,
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function GET() {
  return handlePasswordRecoveryReadiness();
}
