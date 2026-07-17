import { NextRequest, NextResponse } from 'next/server';

import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import {
  createDefaultPlatformOrgNoteRepository,
  PlatformOrgNoteError,
  recordPlatformOrgNote,
  type PlatformOrgNoteRepository,
} from '@/lib/saas/platform-org-notes';

interface Dependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformOrgNoteRepository;
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PlatformOrgNoteError('invalid_request', 400, '請求內容必須是 JSON。');
  }
}

export async function handleCreatePlatformOrgNote(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: Dependencies = {}
) {
  try {
    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'manage_organization_notes',
    })))();
    const body = await readBody(request);
    const { id } = await context.params;
    const note = await recordPlatformOrgNote(
      body,
      id,
      access,
      deps.repository ?? createDefaultPlatformOrgNoteRepository()
    );
    return NextResponse.json({ success: true, data: { note } });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError || error instanceof PlatformOrgNoteError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('Create platform organization note failed:', error);
    return NextResponse.json(
      { success: false, error: '營運紀錄儲存失敗。' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  return crossSiteResponse ?? handleCreatePlatformOrgNote(request, context);
}
