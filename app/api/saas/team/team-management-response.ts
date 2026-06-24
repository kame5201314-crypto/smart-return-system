import { NextResponse } from 'next/server';

import { SaaSOrgContextError } from '@/lib/saas/org-context';
import { TeamManagementError } from '@/lib/saas/team-management';

export function teamManagementErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof SaaSOrgContextError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof TeamManagementError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error(fallback, error);
  return NextResponse.json(
    { success: false, error: 'Team management request failed.', code: 'request_failed' },
    { status: 500 }
  );
}
