'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  Eye,
  EyeOff,
  Link2,
  Loader2,
  LockKeyhole,
  MailCheck,
  UserRound,
} from 'lucide-react';

import { GoogleSignInIcon } from '@/components/auth/google-sign-in-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getVerifiedSignupErrorMessage,
  normalizeEmailIdentifier,
  normalizeTaiwanPhoneIdentifier,
  resolveVerifiedSignupInput,
  validateVerifiedSignupPassword,
  type VerifiedSignupChannel,
  VerifiedSignupValidationError,
} from '@/lib/auth/verified-signup';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';

interface VerifiedSignupFormProps {
  emailEnabled: boolean;
  phoneEnabled: boolean;
  showEmailWhenUnavailable?: boolean;
  initialPlan: SaaSPlanCode;
  turnstileSiteKey: string;
  googleSignupHref?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;
const SIGNUP_READINESS_ENDPOINT = '/api/saas/signup/readiness';
const SIGNUP_READINESS_TIMEOUT_MS = 5_000;
const SIGNUP_READINESS_CHANGED_MESSAGE = '註冊服務狀態已更新，請重新整理頁面後再試。';
const SIGNUP_READINESS_UNAVAILABLE_MESSAGE = '目前無法確認註冊服務狀態，請稍後再試。';
type SignupErrorField = 'identifier' | 'password' | 'passwordConfirmation' | 'terms' | 'otp';

class VerifiedSignupReadinessError extends Error {
  constructor(public readonly code: 'changed' | 'unavailable') {
    super(
      code === 'changed'
        ? SIGNUP_READINESS_CHANGED_MESSAGE
        : SIGNUP_READINESS_UNAVAILABLE_MESSAGE
    );
    this.name = 'VerifiedSignupReadinessError';
  }
}

async function createVerifiedSignupClient() {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
}

function getSignupErrorMessage(error: unknown): string {
  return error instanceof VerifiedSignupReadinessError
    ? error.message
    : getVerifiedSignupErrorMessage(error);
}

async function assertVerifiedSignupChannelReady(
  channel: VerifiedSignupChannel
): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SIGNUP_READINESS_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(SIGNUP_READINESS_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    throw new VerifiedSignupReadinessError('unavailable');
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new VerifiedSignupReadinessError('unavailable');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new VerifiedSignupReadinessError('unavailable');
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
    throw new VerifiedSignupReadinessError('unavailable');
  }

  const ready = channel === 'email'
    ? payload.data.emailEnabled
    : payload.data.phoneEnabled;
  if (!ready) {
    throw new VerifiedSignupReadinessError('changed');
  }
}

export function VerifiedSignupForm({
  emailEnabled,
  phoneEnabled,
  showEmailWhenUnavailable = false,
  initialPlan,
  turnstileSiteKey,
  googleSignupHref,
}: VerifiedSignupFormProps) {
  const router = useRouter();
  const emailFallbackVisible = showEmailWhenUnavailable && !emailEnabled;
  const allCredentialMethodsUnavailable = emailFallbackVisible && !phoneEnabled;
  const [channel, setChannel] = useState<VerifiedSignupChannel>(
    emailEnabled || allCredentialMethodsUnavailable ? 'email' : 'phone'
  );
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [displayIdentifier, setDisplayIdentifier] = useState('');
  const [normalizedIdentifier, setNormalizedIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otp, setOtp] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<SignupErrorField | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const inFlight = useRef(false);
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordConfirmationInputRef = useRef<HTMLInputElement>(null);
  const termsInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const resendSeconds = useMemo(
    () => Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000)),
    [clock, resendAvailableAt]
  );

  useEffect(() => {
    if (step !== 'otp' || resendSeconds <= 0) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds, step]);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
      return;
    }
    identifierInputRef.current?.focus();
  }, [step]);

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaResetNonce((value) => value + 1);
  }

  const emailInputUnavailable = emailFallbackVisible && identifier.includes('@');

  function clearUnavailableEmailCredentials() {
    setPassword('');
    setPasswordConfirmation('');
    setReferralCode('');
    setTermsAccepted(false);
    setShowPassword(false);
    resetCaptcha();
  }

  function handleIdentifierChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextIdentifier = event.target.value;
    const nextEmailInputUnavailable = emailFallbackVisible && nextIdentifier.includes('@');

    setIdentifier(nextIdentifier);

    if (nextEmailInputUnavailable) {
      if (!emailInputUnavailable) clearUnavailableEmailCredentials();
      setMessage(null);
      setError('信箱驗證服務準備中，目前暫時無法寄送驗證碼。');
      setErrorField('identifier');
      return;
    }

    if (emailInputUnavailable) {
      // A previously completed challenge must not be reused after switching
      // from the unavailable Email path back to the available phone path.
      resetCaptcha();
      setMessage(null);
      setError(null);
      setErrorField(null);
    }
  }

  async function handleStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setMessage(null);
    setErrorField(null);

    // Keep this presentation-only state fail closed. Even a programmatic form
    // submission must never create an account before Email OTP is ready.
    const submittedIdentifier = identifierInputRef.current?.value ?? identifier;
    const submittedEmailUnavailable = emailFallbackVisible && submittedIdentifier.includes('@');
    if (allCredentialMethodsUnavailable || submittedEmailUnavailable) {
      if (submittedEmailUnavailable) clearUnavailableEmailCredentials();
      setError('信箱驗證服務準備中，目前暫時無法寄送驗證碼。');
      setErrorField('identifier');
      return;
    }

    try {
      if (!termsAccepted) {
        setError('請先同意使用者註冊協議與隱私權政策。');
        setErrorField('terms');
        termsInputRef.current?.focus();
        return;
      }
      if (!captchaToken) {
        setError('請先完成安全驗證。');
        return;
      }

      const resolvedInput = resolveVerifiedSignupInput(identifier, {
        emailEnabled,
        phoneEnabled,
      });
      const nextChannel = resolvedInput.channel;
      const normalized = resolvedInput.normalizedIdentifier;
      validateVerifiedSignupPassword(password, passwordConfirmation);
      inFlight.current = true;
      setIsSubmitting(true);
      await assertVerifiedSignupChannelReady(nextChannel);

      const client = await createVerifiedSignupClient();
      const metadata = {
        signup_channel: nextChannel,
        referral_code: referralCode.trim().slice(0, 64) || undefined,
      };
      const response = nextChannel === 'email'
        ? await client.auth.signUp({
            email: normalized,
            password,
            options: { captchaToken, data: metadata },
          })
        : await client.auth.signUp({
            phone: normalized,
            password,
            options: { captchaToken, channel: 'sms', data: metadata },
          });

      if (response.error) throw response.error;

      // A public verified-signup rollout must require confirmation in Supabase Auth.
      // If a session is returned immediately, fail closed instead of silently bypassing OTP.
      if (response.data.session) {
        const signOutResponse = await client.auth.signOut({ scope: 'local' });
        if (signOutResponse.error) {
          throw new Error('Unverified signup session cleanup failed');
        }
        throw new Error('OTP confirmation provider is not configured');
      }

      setChannel(nextChannel);
      setNormalizedIdentifier(normalized);
      setDisplayIdentifier(identifier.trim());
      setPassword('');
      setPasswordConfirmation('');
      setOtp('');
      setStep('otp');
      const nextResendAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setResendAvailableAt(nextResendAt);
      setClock(Date.now());
      setMessage('如果資料正確且可使用，我們已寄出驗證碼。');
      resetCaptcha();
    } catch (caughtError) {
      setError(getSignupErrorMessage(caughtError));
      if (caughtError instanceof VerifiedSignupValidationError) {
        if (caughtError.code === 'weak_password') {
          setErrorField('password');
          passwordInputRef.current?.focus();
        } else if (caughtError.code === 'password_mismatch') {
          setErrorField('passwordConfirmation');
          passwordConfirmationInputRef.current?.focus();
        } else {
          setErrorField('identifier');
          identifierInputRef.current?.focus();
        }
      }
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
    setErrorField(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('請輸入 6 位數驗證碼。');
      setErrorField('otp');
      otpInputRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setIsSubmitting(true);
    let client: Awaited<ReturnType<typeof createVerifiedSignupClient>> | null = null;
    let createdVerifiedSession = false;
    try {
      await assertVerifiedSignupChannelReady(channel);
      client = await createVerifiedSignupClient();
      const response = channel === 'email'
        ? await client.auth.verifyOtp({
            email: normalizedIdentifier,
            token: otp,
            type: 'signup',
          })
        : await client.auth.verifyOtp({
            phone: normalizedIdentifier,
            token: otp,
            type: 'sms',
          });
      if (response.error) throw response.error;
      if (!response.data.session || !response.data.user) {
        throw new Error('Verified signup session missing');
      }
      createdVerifiedSession = true;

      const { data, error: userError } = await client.auth.getUser();
      if (
        userError ||
        !data.user ||
        data.user.id !== response.data.user.id
      ) {
        throw userError || new Error('Verified user missing or mismatched');
      }

      const verified = channel === 'email'
        ? Boolean(
            data.user.email_confirmed_at &&
            data.user.email &&
            normalizeEmailIdentifier(data.user.email) === normalizedIdentifier
          )
        : Boolean(
            data.user.phone_confirmed_at &&
            data.user.phone &&
            normalizeTaiwanPhoneIdentifier(data.user.phone) === normalizedIdentifier
          );
      if (!verified) {
        throw new Error('Verified identity mismatch');
      }

      const plan = initialPlan === 'growth' ? 'growth' : 'basic';
      router.replace(`/signup/complete?plan=${plan}`);
      router.refresh();
    } catch (caughtError) {
      let safeError = caughtError;
      if (createdVerifiedSession && client) {
        try {
          const signOutResponse = await client.auth.signOut({ scope: 'local' });
          if (signOutResponse.error) {
            throw signOutResponse.error;
          }
        } catch {
          safeError = new Error('Verified signup session cleanup failed');
        }
      }
      setError(getSignupErrorMessage(safeError));
      if (safeError instanceof VerifiedSignupReadinessError) {
        resetCaptcha();
      }
      setErrorField('otp');
      otpInputRef.current?.focus();
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    setErrorField(null);
    if (inFlight.current || resendSeconds > 0 || isSubmitting) return;
    if (!captchaToken) {
      setError('請先完成安全驗證，再重新傳送驗證碼。');
      return;
    }

    inFlight.current = true;
    setIsSubmitting(true);
    try {
      await assertVerifiedSignupChannelReady(channel);
      const client = await createVerifiedSignupClient();
      const response = channel === 'email'
        ? await client.auth.resend({
            type: 'signup',
            email: normalizedIdentifier,
            options: { captchaToken },
          })
        : await client.auth.resend({
            type: 'sms',
            phone: normalizedIdentifier,
            options: { captchaToken },
          });
      if (response.error) throw response.error;

      const nextResendAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setResendAvailableAt(nextResendAt);
      setClock(Date.now());
      setMessage('如果資料正確且可使用，我們已重新傳送驗證碼。');
      resetCaptcha();
    } catch (caughtError) {
      setError(getSignupErrorMessage(caughtError));
      resetCaptcha();
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  if (!emailEnabled && !phoneEnabled && !showEmailWhenUnavailable) return null;

  const emailVisible = emailEnabled || emailFallbackVisible;
  const combinedChannels = emailVisible && phoneEnabled;
  const emailOnlyForm = emailVisible && !phoneEnabled;
  const identifierLabel = combinedChannels
    ? '手機號碼或電子信箱'
    : emailOnlyForm
      ? '電子信箱'
      : '手機號碼';
  const identifierPlaceholder = combinedChannels
    ? '請輸入手機號碼或電子信箱'
    : emailOnlyForm
      ? 'name@example.com'
      : '0912345678';
  const otpLabel = combinedChannels
    ? '手機或信箱驗證碼'
    : channel === 'email'
      ? '信箱驗證碼'
      : '手機驗證碼';

  return (
    <div className="space-y-6">
      {step === 'credentials' ? (
        <>
          <form onSubmit={handleStart} className="space-y-5" data-testid="verified-signup-form">
            {emailFallbackVisible ? (
              <div
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
                data-testid="email-signup-unavailable-notice"
              >
                <p className="font-semibold">信箱驗證服務準備中</p>
                <p className="mt-1 leading-6">
                  {phoneEnabled
                    ? '手機號碼註冊目前可使用；任何電子信箱（不限定 Gmail）的驗證碼寄送仍在設定中。'
                    : '可使用任何電子信箱註冊，不限定 Gmail。驗證碼寄送正在設定，目前暫停輸入與送出；'}
                  {!phoneEnabled && googleSignupHref
                    ? '現在可先使用下方 Google 繼續。'
                    : !phoneEnabled
                      ? '目前請先使用下方申請表聯絡我們。'
                      : null}
                </p>
              </div>
            ) : null}
          <div>
            <div className="flex items-center">
              <span className="mr-1 text-red-500" aria-hidden="true">*</span>
              <label htmlFor="signup-identifier" className="text-sm font-medium text-neutral-900">
                {identifierLabel}
              </label>
            </div>
            <div className="relative mt-2">
              <UserRound
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                ref={identifierInputRef}
                id="signup-identifier"
                type={combinedChannels ? 'text' : channel === 'email' ? 'email' : 'tel'}
                inputMode={combinedChannels ? 'email' : channel === 'email' ? 'email' : 'tel'}
                autoComplete={combinedChannels ? 'username' : channel === 'email' ? 'email' : 'tel'}
                value={identifier}
                onChange={handleIdentifierChange}
                placeholder={identifierPlaceholder}
                maxLength={254}
                required
                disabled={allCredentialMethodsUnavailable || isSubmitting}
                aria-invalid={errorField === 'identifier'}
                aria-describedby={errorField === 'identifier' ? 'verified-signup-error' : undefined}
                className="h-12 pl-10"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center">
              <span className="mr-1 text-red-500" aria-hidden="true">*</span>
              <label htmlFor="signup-password" className="text-sm font-medium text-neutral-900">
                密碼
              </label>
            </div>
            <div className="relative mt-2">
              <LockKeyhole
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                ref={passwordInputRef}
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                required
                disabled={allCredentialMethodsUnavailable || emailInputUnavailable || isSubmitting}
                aria-invalid={errorField === 'password'}
                aria-describedby={
                  errorField === 'password'
                    ? 'signup-password-requirements verified-signup-error'
                    : 'signup-password-requirements'
                }
                placeholder="請輸入密碼"
                className="h-12 pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={allCredentialMethodsUnavailable || emailInputUnavailable || isSubmitting}
                className="absolute right-3 top-1/2 rounded-sm p-1 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p id="signup-password-requirements" className="mt-1 text-xs text-neutral-500">
              8 至 72 碼，需包含英文字母與數字。
            </p>
          </div>

          <div>
            <div className="flex items-center">
              <span className="mr-1 text-red-500" aria-hidden="true">*</span>
              <label htmlFor="signup-password-confirmation" className="text-sm font-medium text-neutral-900">
                確認密碼
              </label>
            </div>
            <div className="relative mt-2">
              <LockKeyhole
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                ref={passwordConfirmationInputRef}
                id="signup-password-confirmation"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                minLength={8}
                maxLength={72}
                required
                disabled={allCredentialMethodsUnavailable || emailInputUnavailable || isSubmitting}
                aria-invalid={errorField === 'passwordConfirmation'}
                aria-describedby={
                  errorField === 'passwordConfirmation' ? 'verified-signup-error' : undefined
                }
                placeholder="請再次輸入密碼"
                className="h-12 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-referral-code" className="text-sm font-medium text-neutral-900">推薦碼</label>
            <div className="relative mt-2">
              <Link2
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                id="signup-referral-code"
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value)}
                maxLength={64}
                disabled={allCredentialMethodsUnavailable || emailInputUnavailable || isSubmitting}
                placeholder="請輸入推薦碼（選填）"
                className="h-12 pl-10"
              />
            </div>
          </div>

          <p className="text-sm text-neutral-700">
            已有帳號？
            <Link
              href="/login"
              className="ml-1 font-medium text-neutral-950 underline-offset-4 hover:text-emerald-700 hover:underline"
            >
              返回登入
            </Link>
          </p>

          <div className="flex items-start gap-3 text-sm leading-6 text-neutral-700">
            <input
              ref={termsInputRef}
              id="signup-terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              required
              disabled={allCredentialMethodsUnavailable || emailInputUnavailable || isSubmitting}
              aria-invalid={errorField === 'terms'}
              aria-describedby={errorField === 'terms' ? 'verified-signup-error' : undefined}
              className="mt-1 size-4 accent-emerald-700"
            />
            <span>
              <span className="mr-1 text-red-500" aria-hidden="true">*</span>
              <label htmlFor="signup-terms">我已閱讀並同意</label>
              <Link href="/legal/terms" target="_blank" className="mx-1 text-emerald-700 underline underline-offset-2">使用者註冊協議</Link>
              與
              <Link href="/legal/privacy" target="_blank" className="mx-1 text-emerald-700 underline underline-offset-2">隱私權政策</Link>
            </span>
          </div>

          {!allCredentialMethodsUnavailable && !emailInputUnavailable ? (
            <Turnstile
              key={`credentials-${captchaResetNonce}`}
              siteKey={turnstileSiteKey}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => {
                setCaptchaToken(null);
                setError('安全驗證載入失敗，請重新整理後再試。');
              }}
              options={{
                language: 'zh-tw',
                size: 'flexible',
                action: combinedChannels ? 'signup_identity' : `signup_${channel}`,
              }}
            />
          ) : null}

          <Feedback message={message} error={error} />
            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={
                allCredentialMethodsUnavailable ||
                emailInputUnavailable ||
                isSubmitting ||
                !captchaToken
              }
            >
              {allCredentialMethodsUnavailable || emailInputUnavailable
                ? '信箱註冊即將開放'
                : isSubmitting
                  ? <><Loader2 className="size-4 animate-spin" />傳送中...</>
                  : '註冊'}
            </Button>
          </form>

          {googleSignupHref ? <GoogleSignupOption href={googleSignupHref} /> : null}
        </>
      ) : (
        <form onSubmit={handleVerify} className="space-y-6" data-testid="verified-signup-otp-form">
          <div>
            <h2 className="text-lg font-semibold leading-7 text-neutral-950">
              請查收並輸入手機或信箱中的驗證碼
            </h2>
            <p className="mt-2 break-all text-base text-neutral-500">
              {displayIdentifier || normalizedIdentifier}
            </p>
          </div>

          <div>
            <label htmlFor="signup-referral-code-confirmation" className="text-sm font-medium text-neutral-900">
              推薦碼
            </label>
            <div className="relative mt-2">
              <Link2
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                id="signup-referral-code-confirmation"
                value={referralCode}
                placeholder="未填寫推薦碼"
                readOnly
                aria-readonly="true"
                className="h-12 bg-neutral-50 pl-10 text-neutral-600"
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">若需修改，請返回上一步。</p>
          </div>

          <div>
            <div className="flex items-center">
              <span className="mr-1 text-red-500" aria-hidden="true">*</span>
              <label htmlFor="signup-otp" className="text-sm font-medium text-neutral-900">
                {otpLabel}
              </label>
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-0">
              <div className="relative min-w-0 flex-1">
                <MailCheck
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  ref={otpInputRef}
                  id="signup-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  disabled={isSubmitting}
                  aria-invalid={errorField === 'otp'}
                  aria-describedby={errorField === 'otp' ? 'verified-signup-error' : undefined}
                  placeholder="請輸入 6 位數驗證碼"
                  className="h-12 pl-10 tracking-[0.18em] sm:rounded-r-none"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full bg-white px-3 text-sm sm:min-w-40 sm:w-auto sm:rounded-l-none sm:border-l-0"
                onClick={handleResend}
                disabled={isSubmitting || resendSeconds > 0 || !captchaToken}
              >
                {resendSeconds > 0 ? `重新傳送（${resendSeconds}）` : '重新傳送'}
              </Button>
            </div>
          </div>

          {resendSeconds === 0 ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-3 text-xs leading-5 text-neutral-500">
                重新傳送前，請先完成安全驗證。
              </p>
              <Turnstile
                key={`otp-${captchaResetNonce}`}
                siteKey={turnstileSiteKey}
                onSuccess={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
                onError={() => {
                  setCaptchaToken(null);
                  setError('安全驗證載入失敗，請重新整理後再試。');
                }}
                options={{ language: 'zh-tw', size: 'flexible', action: `resend_${channel}` }}
              />
            </div>
          ) : null}

          <p className="text-sm text-neutral-700">
            手機或信箱有誤？
            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setOtp('');
                setError(null);
                setMessage(null);
                setErrorField(null);
                resetCaptcha();
              }}
              disabled={isSubmitting}
              className="ml-1 font-medium text-neutral-950 underline-offset-4 hover:text-emerald-700 hover:underline"
            >
              返回上一步
            </button>
          </p>

          <Feedback message={message} error={error} />
          <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting || otp.length !== 6}>
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" />驗證中...</> : '註冊'}
          </Button>
        </form>
      )}
    </div>
  );
}

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message ? (
        <p
          id="verified-signup-status"
          role="status"
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          id="verified-signup-error"
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

function GoogleSignupOption({ href }: { href: string }) {
  return (
    <div className="pt-1" data-testid="google-signup-option">
      <div className="mb-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs text-neutral-400">或使用 Google 驗證身分</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
      <Button asChild variant="outline" className="h-12 w-full bg-white text-base">
        <Link href={href}>
          <GoogleSignInIcon className="size-5" />
          使用 Google 繼續
        </Link>
      </Button>
      <p className="mt-2 text-center text-xs leading-5 text-neutral-500">
        Google 驗證後仍需完成商家資料；3 天免費、不需信用卡
      </p>
    </div>
  );
}
