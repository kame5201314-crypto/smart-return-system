import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

function normalizeEnvValue(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

type AuthResult = 'ok' | 'unauthorized' | 'not_configured';

function authorize(request: NextRequest): AuthResult {
  const expectedToken = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_TOKEN);
  // Fail closed: without a configured token the endpoint stays disabled instead
  // of authorizing every caller.
  if (!expectedToken) {
    return 'not_configured';
  }

  // Header token only. The query-string token path was removed so the secret is
  // never placed in URLs, access logs, or referrers. Compared in constant time.
  const headerToken = normalizeEnvValue(request.headers.get('x-schema-drift-token'));
  if (headerToken && safeEqual(headerToken, expectedToken)) {
    return 'ok';
  }

  return 'unauthorized';
}

export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (auth === 'not_configured') {
    return NextResponse.json(
      { success: false, error: 'Schema drift alert endpoint is not configured' },
      { status: 503 }
    );
  }
  if (auth === 'unauthorized') {
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
