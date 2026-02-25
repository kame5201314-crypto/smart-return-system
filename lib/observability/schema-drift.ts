interface SchemaDriftAlertPayload {
  source: string;
  table: string;
  column: string;
  errorMessage?: string;
  context?: Record<string, unknown>;
}

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/\\n/g, '').trim();
}

export async function emitSchemaDriftAlert(payload: SchemaDriftAlertPayload): Promise<void> {
  const event = {
    level: 'error',
    type: 'schema_drift',
    occurred_at: new Date().toISOString(),
    source: payload.source,
    table: payload.table,
    column: payload.column,
    error: payload.errorMessage || null,
    context: payload.context || {},
  };

  console.error('[schema-drift-alert]', JSON.stringify(event));

  const webhookUrl = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_WEBHOOK_URL);
  if (!webhookUrl) {
    return;
  }

  const webhookToken = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_TOKEN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (webhookToken) {
    headers['x-schema-drift-token'] = webhookToken;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[schema-drift-alert] webhook failed:', message);
  }
}
