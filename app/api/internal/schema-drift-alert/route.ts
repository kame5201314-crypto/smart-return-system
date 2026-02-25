import { NextRequest, NextResponse } from 'next/server';

function normalizeEnvValue(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function isAuthorized(request: NextRequest): boolean {
  const expectedToken = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_TOKEN);
  if (!expectedToken) {
    return true;
  }

  const headerToken = normalizeEnvValue(request.headers.get('x-schema-drift-token'));
  if (headerToken && headerToken === expectedToken) {
    return true;
  }

  const tokenFromQuery = normalizeEnvValue(new URL(request.url).searchParams.get('token'));
  return tokenFromQuery === expectedToken;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  console.error(
    '[schema-drift-webhook]',
    JSON.stringify({
      received_at: new Date().toISOString(),
      payload,
    })
  );

  return NextResponse.json({ success: true });
}
