import { NextResponse } from 'next/server';

import { resolveVerifiedSignupAvailability } from '@/lib/auth/verified-signup';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
};

export function handleVerifiedSignupReadiness(
  env: Record<string, string | undefined> = process.env
) {
  const availability = resolveVerifiedSignupAvailability(env);

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
  return handleVerifiedSignupReadiness();
}
