'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';

import { AuthTurnstile } from '@/components/auth/auth-turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyPasswordRecoveryOtp } from '@/lib/actions/password-recovery';
import {
  getPasswordRecoveryErrorMessage,
  PASSWORD_RECOVERY_GENERIC_SENT_MESSAGE,
  shouldExposePasswordRecoverySendError,
  type PasswordRecoveryChannel,
} from '@/lib/auth/password-recovery';
import {
  maskVerifiedSignupIdentifier,
  normalizeVerifiedSignupIdentifier,
} from '@/lib/auth/verified-signup';

interface PasswordRecoveryFormProps {
  emailEnabled: boolean;
  phoneEnabled: boolean;
  turnstileSiteKey: string;
}

const RESEND_COOLDOWN_SECONDS = 60;
const RECOVERY_READINESS_ENDPOINT = '/api/saas/password-recovery/readiness';
const RECOVERY_READINESS_TIMEOUT_MS = 5_000;
const RECOVERY_READINESS_CHANGED_MESSAGE =
  '帳號復原服務狀態已更新，請重新整理頁面後再試。';
const RECOVERY_READINESS_UNAVAILABLE_MESSAGE =
  '目前無法確認帳號復原服務狀態，請稍後再試。';

class PasswordRecoveryReadinessError extends Error {
  constructor(public readonly code: 'changed' | 'unavailable') {
    super(
      code === 'changed'
        ? RECOVERY_READINESS_CHANGED_MESSAGE
        : RECOVERY_READINESS_UNAVAILABLE_MESSAGE
    );
    this.name = 'PasswordRecoveryReadinessError';
  }
}

function getPasswordRecoveryFlowErrorMessage(error: unknown): string {
  return error instanceof PasswordRecoveryReadinessError
    ? error.message
    : getPasswordRecoveryErrorMessage(error);
}

async function assertPasswordRecoveryChannelReady(
  channel: PasswordRecoveryChannel
): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    RECOVERY_READINESS_TIMEOUT_MS
  );
  let response: Response;

  try {
    response = await fetch(RECOVERY_READINESS_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    throw new PasswordRecoveryReadinessError('unavailable');
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new PasswordRecoveryReadinessError('unavailable');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PasswordRecoveryReadinessError('unavailable');
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('success' in payload) ||
    payload.success !== true ||
    !('data' in payload) ||
    !payload.data ||
    typeof payload.data !== 'object' ||
    !('emailEnabled' in payload.data) ||
    typeof payload.data.emailEnabled !== 'boolean' ||
    !('phoneEnabled' in payload.data) ||
    typeof payload.data.phoneEnabled !== 'boolean'
  ) {
    throw new PasswordRecoveryReadinessError('unavailable');
  }

  const ready = channel === 'email'
    ? payload.data.emailEnabled
    : payload.data.phoneEnabled;
  if (!ready) {
    throw new PasswordRecoveryReadinessError('changed');
  }
}

async function createPasswordRecoveryClient() {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
}

export function PasswordRecoveryForm({
  emailEnabled,
  phoneEnabled,
  turnstileSiteKey,
}: PasswordRecoveryFormProps) {
  const router = useRouter();
  const [channel, setChannel] = useState<PasswordRecoveryChannel>(
    emailEnabled ? 'email' : 'phone'
  );
  const [step, setStep] = useState<'request' | 'otp'>('request');
  const [identifier, setIdentifier] = useState('');
  const [normalizedIdentifier, setNormalizedIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const resendSeconds = useMemo(
    () => Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000)),
    [clock, resendAvailableAt]
  );

  useEffect(() => {
    if (step !== 'otp' || resendSeconds <= 0) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds, step]);

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaResetNonce((value) => value + 1);
  }

  function startCooldown() {
    const nextResendAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
    setResendAvailableAt(nextResendAt);
    setClock(Date.now());
  }

  function selectChannel(nextChannel: PasswordRecoveryChannel) {
    if (isSubmitting || nextChannel === channel) return;
    setChannel(nextChannel);
    setIdentifier('');
    setMessage(null);
    setError(null);
    resetCaptcha();
  }

  async function requestRecovery(target: string, token: string) {
    await assertPasswordRecoveryChannelReady(channel);
    const client = await createPasswordRecoveryClient();
    const response = channel === 'email'
      ? await client.auth.resetPasswordForEmail(target, { captchaToken: token })
      : await client.auth.signInWithOtp({
          phone: target,
          options: {
            captchaToken: token,
            channel: 'sms',
            shouldCreateUser: false,
          },
        });

    if (response.error && shouldExposePasswordRecoverySendError(response.error)) {
      throw response.error;
    }
  }

  async function handleStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setMessage(null);

    if (!captchaToken) {
      setError('請先完成安全驗證。');
      return;
    }

    try {
      const normalized = normalizeVerifiedSignupIdentifier(channel, identifier);
      inFlight.current = true;
      setIsSubmitting(true);
      await requestRecovery(normalized, captchaToken);
      setNormalizedIdentifier(normalized);
      setOtp('');
      setStep('otp');
      startCooldown();
      setMessage(PASSWORD_RECOVERY_GENERIC_SENT_MESSAGE);
      resetCaptcha();
    } catch (caughtError) {
      setError(getPasswordRecoveryFlowErrorMessage(caughtError));
      resetCaptcha();
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    if (inFlight.current || isSubmitting || resendSeconds > 0) return;
    if (!captchaToken) {
      setError('請先完成安全驗證，再重新傳送驗證碼。');
      return;
    }

    try {
      inFlight.current = true;
      setIsSubmitting(true);
      await requestRecovery(normalizedIdentifier, captchaToken);
      startCooldown();
      setMessage(PASSWORD_RECOVERY_GENERIC_SENT_MESSAGE);
      resetCaptcha();
    } catch (caughtError) {
      setError(getPasswordRecoveryFlowErrorMessage(caughtError));
      resetCaptcha();
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setMessage(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('請輸入 6 位數驗證碼。');
      return;
    }

    try {
      inFlight.current = true;
      setIsSubmitting(true);
      const response = await verifyPasswordRecoveryOtp(channel, normalizedIdentifier, otp);
      if (!response.success) {
        setError(response.error || '驗證服務暫時無法使用，請稍後再試。');
        return;
      }

      router.replace('/reset-password');
      router.refresh();
    } catch (caughtError) {
      setError(getPasswordRecoveryErrorMessage(caughtError));
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  if (!emailEnabled && !phoneEnabled) return null;

  return (
    <div className="space-y-5">
      {step === 'request' ? (
        <form onSubmit={handleStart} className="space-y-4">
          {emailEnabled && phoneEnabled ? (
            <div className="grid grid-cols-2 rounded-md bg-neutral-100 p-1" role="tablist" aria-label="復原方式">
              <ChannelTab
                selected={channel === 'email'}
                onClick={() => selectChannel('email')}
                icon={<Mail className="mr-1 inline size-4" aria-hidden="true" />}
                label="電子信箱"
              />
              <ChannelTab
                selected={channel === 'phone'}
                onClick={() => selectChannel('phone')}
                icon={<Phone className="mr-1 inline size-4" aria-hidden="true" />}
                label="手機號碼"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="recovery-identifier" className="text-sm font-medium text-neutral-900">
              {channel === 'email' ? '電子信箱' : '手機號碼'}
            </label>
            <Input
              id="recovery-identifier"
              type={channel === 'email' ? 'email' : 'tel'}
              inputMode={channel === 'email' ? 'email' : 'tel'}
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={channel === 'email' ? 'name@example.com' : '0912345678'}
              required
              maxLength={channel === 'email' ? 254 : 20}
              disabled={isSubmitting}
              className="mt-2"
            />
          </div>

          <AuthTurnstile
            key={`recovery-request-${captchaResetNonce}`}
            siteKey={turnstileSiteKey}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => {
              setCaptchaToken(null);
              setError('安全驗證載入失敗，請重新整理後再試。');
            }}
            options={{ language: 'zh-TW', size: 'flexible', action: `password_recovery_${channel}` }}
          />

          <Feedback message={message} error={error} />
          <Button type="submit" className="w-full" disabled={isSubmitting || !captchaToken}>
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" />傳送中...</> : '傳送驗證碼'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <div className="flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-neutral-950">輸入驗證碼</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              請查收傳送至 <span className="font-medium text-neutral-900">{maskVerifiedSignupIdentifier(channel, normalizedIdentifier)}</span> 的 6 位數驗證碼。
            </p>
          </div>

          <div>
            <label htmlFor="recovery-otp" className="text-sm font-medium text-neutral-900">
              {channel === 'email' ? '信箱驗證碼' : '手機驗證碼'}
            </label>
            <Input
              id="recovery-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={isSubmitting}
              className="mt-2 text-center text-lg tracking-[0.4em]"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setStep('request');
              setOtp('');
              setMessage(null);
              setError(null);
              resetCaptcha();
            }}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            修改{channel === 'email' ? '信箱' : '手機號碼'}
          </button>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-3 text-xs text-neutral-500">重新傳送前請完成安全驗證。</p>
            <AuthTurnstile
              key={`recovery-resend-${captchaResetNonce}`}
              siteKey={turnstileSiteKey}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
              options={{ language: 'zh-TW', size: 'flexible', action: `recovery_resend_${channel}` }}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full bg-white"
              onClick={handleResend}
              disabled={isSubmitting || resendSeconds > 0 || !captchaToken}
            >
              {resendSeconds > 0 ? `重新傳送（${resendSeconds}）` : '重新傳送驗證碼'}
            </Button>
          </div>

          <Feedback message={message} error={error} />
          <Button type="submit" className="w-full" disabled={isSubmitting || otp.length !== 6}>
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" />驗證中...</> : '驗證帳號'}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-neutral-600">
        想起密碼了？
        <Link href="/login" className="ml-1 font-medium text-emerald-700 hover:underline">
          返回登入
        </Link>
      </p>
    </div>
  );
}

function ChannelTab({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`rounded px-3 py-2 text-sm font-medium ${selected ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    </>
  );
}
