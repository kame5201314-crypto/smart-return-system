export type SaaSEmailDeliveryProvider = 'resend';

export type SaaSEmailDeliveryReadinessStatus =
  | 'disabled'
  | 'ready'
  | 'missing_config'
  | 'unsupported_provider';

export type SaaSEmailDeliveryBlockedReason =
  | 'delivery_not_enabled'
  | 'provider_not_configured'
  | 'provider_credentials_missing'
  | 'provider_unsupported';

export interface SaaSEmailDeliveryReadiness {
  enabled: boolean;
  provider: SaaSEmailDeliveryProvider | null;
  status: SaaSEmailDeliveryReadinessStatus;
  missingEnv: string[];
  blockedReason: SaaSEmailDeliveryBlockedReason | null;
}

export interface SaaSEmailDeliveryMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  idempotencyKey?: string;
}

export interface SaaSEmailDeliveryResult {
  provider: SaaSEmailDeliveryProvider;
  providerMessageId: string | null;
}

export interface SaaSEmailDeliveryOptions {
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
}

interface ResendDeliveryConfig {
  apiKey: string;
  from: string;
}

export class SaaSEmailDeliveryError extends Error {
  constructor(
    public readonly code: SaaSEmailDeliveryBlockedReason | 'provider_error' | 'invalid_message',
    message: string
  ) {
    super(message);
    this.name = 'SaaSEmailDeliveryError';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\\n/g, '').trim() : '';
}

function parseEnabled(value: unknown): boolean {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function normalizeProvider(value: unknown): SaaSEmailDeliveryProvider | null {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === 'resend' ? 'resend' : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRecipients(to: string | string[]): string[] {
  const recipients = Array.isArray(to) ? to : [to];
  const normalized = recipients.map((recipient) => normalizeEnvValue(recipient).toLowerCase());
  const unique = [...new Set(normalized)].filter(Boolean);

  if (unique.length === 0 || unique.some((recipient) => !EMAIL_PATTERN.test(recipient))) {
    throw new SaaSEmailDeliveryError(
      'invalid_message',
      'Email delivery requires at least one valid recipient.'
    );
  }

  return unique;
}

function normalizeMessage(message: SaaSEmailDeliveryMessage) {
  const subject = normalizeEnvValue(message.subject);
  const html = normalizeEnvValue(message.html);
  const text = normalizeEnvValue(message.text);

  if (!subject) {
    throw new SaaSEmailDeliveryError('invalid_message', 'Email subject is required.');
  }

  if (!html && !text) {
    throw new SaaSEmailDeliveryError(
      'invalid_message',
      'Email delivery requires html or text content.'
    );
  }

  return {
    to: normalizeRecipients(message.to),
    subject,
    html: html || undefined,
    text: text || undefined,
    idempotencyKey: normalizeEnvValue(message.idempotencyKey) || undefined,
  };
}

export function resolveSaaSEmailDeliveryReadiness(
  env: Record<string, string | undefined> = process.env
): SaaSEmailDeliveryReadiness {
  if (!parseEnabled(env.ENABLE_EMAIL_DELIVERY)) {
    return {
      enabled: false,
      provider: null,
      status: 'disabled',
      missingEnv: [],
      blockedReason: 'delivery_not_enabled',
    };
  }

  const rawProvider = normalizeEnvValue(env.EMAIL_PROVIDER);
  if (!rawProvider) {
    return {
      enabled: false,
      provider: null,
      status: 'missing_config',
      missingEnv: ['EMAIL_PROVIDER'],
      blockedReason: 'provider_not_configured',
    };
  }

  const provider = normalizeProvider(rawProvider);
  if (provider !== 'resend') {
    return {
      enabled: false,
      provider: null,
      status: 'unsupported_provider',
      missingEnv: [],
      blockedReason: 'provider_unsupported',
    };
  }

  const missingEnv = ['RESEND_API_KEY', 'EMAIL_FROM'].filter(
    (key) => !normalizeEnvValue(env[key])
  );

  if (missingEnv.length > 0) {
    return {
      enabled: false,
      provider,
      status: 'missing_config',
      missingEnv,
      blockedReason: 'provider_credentials_missing',
    };
  }

  return {
    enabled: true,
    provider,
    status: 'ready',
    missingEnv: [],
    blockedReason: null,
  };
}

function resolveResendConfig(
  env: Record<string, string | undefined>
): ResendDeliveryConfig {
  const readiness = resolveSaaSEmailDeliveryReadiness(env);
  if (!readiness.enabled) {
    throw new SaaSEmailDeliveryError(
      readiness.blockedReason ?? 'delivery_not_enabled',
      'Email delivery provider is not enabled.'
    );
  }

  return {
    apiKey: normalizeEnvValue(env.RESEND_API_KEY),
    from: normalizeEnvValue(env.EMAIL_FROM),
  };
}

export async function sendResendEmail(
  message: SaaSEmailDeliveryMessage,
  options: SaaSEmailDeliveryOptions = {}
): Promise<SaaSEmailDeliveryResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const config = resolveResendConfig(env);
  const normalized = normalizeMessage(message);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (normalized.idempotencyKey) {
    headers['Idempotency-Key'] = normalized.idempotencyKey;
  }

  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: config.from,
      to: normalized.to,
      subject: normalized.subject,
      html: normalized.html,
      text: normalized.text,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const messageFromProvider =
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : 'Resend delivery failed.';
    throw new SaaSEmailDeliveryError('provider_error', messageFromProvider);
  }

  const providerMessageId =
    isRecord(payload) && typeof payload.id === 'string' ? payload.id : null;

  return {
    provider: 'resend',
    providerMessageId,
  };
}
