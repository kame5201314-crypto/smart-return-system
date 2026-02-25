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

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[schema-drift-alert] webhook failed:', message);
  }
}

