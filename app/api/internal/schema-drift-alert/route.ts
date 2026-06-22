import { NextRequest, NextResponse } from 'next/server';

function normalizeEnvValue(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function isConfigured(): boolean {
  return normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_TOKEN).length > 0;
}

// Fail-closed: a token must be configured, and it is only accepted from the
// x-schema-drift-token header (never a query param, which would leak into
// logs / referrers).
function isAuthorized(request: NextRequest): boolean {
  const expectedToken = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_TOKEN);
  if (!expectedToken) {
    return false;
  }

  const headerToken = normalizeEnvValue(request.headers.get('x-schema-drift-token'));
  return headerToken.length > 0 && headerToken === expectedToken;
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Alert endpoint not configured' },
      { status: 503 }
    );
  }

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
