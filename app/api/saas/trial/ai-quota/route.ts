import { NextResponse } from 'next/server';

import { getOrgContext, SaaSOrgContextError } from '@/lib/saas/org-context';
import {
  loadSelfServiceTrialAIQuotaSnapshot,
  SelfServiceTrialAIQuotaError,
  type SelfServiceTrialAIQuotaQueryClient,
} from '@/lib/saas/self-service-trial-ai-quota';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getOrgContext({
      requirements: { roles: ['owner', 'admin', 'staff'] },
    });
    const quota = await loadSelfServiceTrialAIQuotaSnapshot({
      enabled: context.featureFlags.google_trial_signup,
      orgId: context.orgId,
      orgStatus: context.orgStatus,
      client: createUntypedAdminClient() as unknown as SelfServiceTrialAIQuotaQueryClient,
    });

    return NextResponse.json({ success: true, quota });
  } catch (error) {
    if (error instanceof SaaSOrgContextError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof SelfServiceTrialAIQuotaError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Trial AI quota read failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load trial AI quota.' },
      { status: 500 }
    );
  }
}
