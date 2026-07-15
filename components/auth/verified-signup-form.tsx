'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Turnstile } from '@marsidev/react-turnstile';
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getVerifiedSignupErrorMessage,
  maskVerifiedSignupIdentifier,
  normalizeEmailIdentifier,
  normalizeTaiwanPhoneIdentifier,
  normalizeVerifiedSignupIdentifier,
  validateVerifiedSignupPassword,
  type VerifiedSignupChannel,
} from '@/lib/auth/verified-signup';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';
import { createClient } from '@/lib/supabase/client';

interface VerifiedSignupFormProps {
  emailEnabled: boolean;
  phoneEnabled: boolean;
  initialPlan: SaaSPlanCode;
  turnstileSiteKey: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifiedSignupForm({
  emailEnabled,
  phoneEnabled,
  initialPlan,
  turnstileSiteKey,
}: VerifiedSignupFormProps) {
  const router = useRouter();
  const [channel, setChannel] = useState<VerifiedSignupChannel>(emailEnabled ? 'email' : 'phone');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [identifier, setIdentifier] = useState('');
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
  const [showPassword, setShowPassword] = useState(false);

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

  function selectChannel(nextChannel: VerifiedSignupChannel) {
    if (isSubmitting || nextChannel === channel) return;
    setChannel(nextChannel);
    setIdentifier('');
    setError(null);
    setMessage(null);
    resetCaptcha();
  }

  async function handleStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      if (!termsAccepted) {
        setError('請先同意使用者註冊協議與隱私權政策。');
        return;
      }
      if (!captchaToken) {
        setError('請先完成安全驗證。');
        return;
      }

      const normalized = normalizeVerifiedSignupIdentifier(channel, identifier);
      validateVerifiedSignupPassword(password, passwordConfirmation);
      setIsSubmitting(true);

      const client = createClient();
      const metadata = {
        signup_channel: channel,
        referral_code: referralCode.trim().slice(0, 64) || undefined,
      };
      const response = channel === 'email'
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
        await client.auth.signOut();
        throw new Error('OTP confirmation provider is not configured');
      }

      setNormalizedIdentifier(normalized);
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
      setError(getVerifiedSignupErrorMessage(caughtError));
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('請輸入 6 位數驗證碼。');
      return;
    }

    setIsSubmitting(true);
    try {
      const client = createClient();
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

      const { data, error: userError } = await client.auth.getUser();
      if (userError || !data.user) throw userError || new Error('Verified user missing');

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
        await client.auth.signOut();
        throw new Error('Verified identity mismatch');
      }

      const plan = initialPlan === 'growth' ? 'growth' : 'basic';
      router.replace(`/signup/complete?plan=${plan}`);
      router.refresh();
    } catch (caughtError) {
      setError(getVerifiedSignupErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    if (resendSeconds > 0 || isSubmitting) return;
    if (!captchaToken) {
      setError('請先完成安全驗證，再重新傳送驗證碼。');
      return;
    }

    setIsSubmitting(true);
    try {
      const client = createClient();
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
      setError(getVerifiedSignupErrorMessage(caughtError));
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!emailEnabled && !phoneEnabled) return null;

  return (
    <div className="space-y-5">
      {step === 'credentials' ? (
        <form onSubmit={handleStart} className="space-y-4" data-testid="verified-signup-form">
          {emailEnabled && phoneEnabled ? (
            <div className="grid grid-cols-2 rounded-md bg-neutral-100 p-1" role="tablist" aria-label="驗證方式">
              <button
                type="button"
                role="tab"
                aria-selected={channel === 'email'}
                onClick={() => selectChannel('email')}
                className={`rounded px-3 py-2 text-sm font-medium ${channel === 'email' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
              >
                <Mail className="mr-1 inline size-4" aria-hidden="true" />
                電子信箱
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={channel === 'phone'}
                onClick={() => selectChannel('phone')}
                className={`rounded px-3 py-2 text-sm font-medium ${channel === 'phone' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
              >
                <Phone className="mr-1 inline size-4" aria-hidden="true" />
                手機號碼
              </button>
            </div>
          ) : null}

          <div>
            <label htmlFor="signup-identifier" className="text-sm font-medium text-neutral-900">
              {channel === 'email' ? '電子信箱' : '手機號碼'}
            </label>
            <Input
              id="signup-identifier"
              type={channel === 'email' ? 'email' : 'tel'}
              inputMode={channel === 'email' ? 'email' : 'tel'}
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={channel === 'email' ? 'name@example.com' : '0912345678'}
              maxLength={254}
              required
              disabled={isSubmitting}
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="text-sm font-medium text-neutral-900">密碼</label>
            <div className="relative mt-2">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                required
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">8 至 72 碼，需包含英文字母與數字。</p>
          </div>

          <div>
            <label htmlFor="signup-password-confirmation" className="text-sm font-medium text-neutral-900">確認密碼</label>
            <Input
              id="signup-password-confirmation"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              minLength={8}
              maxLength={72}
              required
              disabled={isSubmitting}
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="signup-referral-code" className="text-sm font-medium text-neutral-900">推薦碼（選填）</label>
            <Input
              id="signup-referral-code"
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              maxLength={64}
              disabled={isSubmitting}
              className="mt-2"
            />
          </div>

          <label className="flex items-start gap-3 text-sm leading-6 text-neutral-700">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              disabled={isSubmitting}
              className="mt-1 size-4 accent-emerald-700"
            />
            <span>
              我已閱讀並同意
              <Link href="/legal/terms" target="_blank" className="mx-1 text-emerald-700 underline">使用者註冊協議</Link>
              與
              <Link href="/legal/privacy" target="_blank" className="mx-1 text-emerald-700 underline">隱私權政策</Link>
            </span>
          </label>

          <Turnstile
            key={`credentials-${captchaResetNonce}`}
            siteKey={turnstileSiteKey}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => {
              setCaptchaToken(null);
              setError('安全驗證載入失敗，請重新整理後再試。');
            }}
            options={{ language: 'zh-TW', size: 'flexible', action: `signup_${channel}` }}
          />

          <Feedback message={message} error={error} />
          <Button type="submit" className="w-full" disabled={isSubmitting || !captchaToken}>
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" />傳送中...</> : '傳送驗證碼'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5" data-testid="verified-signup-otp-form">
          <div>
            <div className="flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-neutral-950">輸入驗證碼</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              請查收傳送至 <span className="font-medium text-neutral-900">{maskVerifiedSignupIdentifier(channel, normalizedIdentifier)}</span> 的 6 位數驗證碼。
            </p>
          </div>

          <div>
            <label htmlFor="signup-otp" className="text-sm font-medium text-neutral-900">
              {channel === 'email' ? '信箱驗證碼' : '手機驗證碼'}
            </label>
            <Input
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
              className="mt-2 text-center text-lg tracking-[0.4em]"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setOtp('');
              setError(null);
              setMessage(null);
              resetCaptcha();
            }}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            修改{channel === 'email' ? '信箱' : '手機號碼'}
          </button>
          <p className="text-sm text-neutral-600">
            已有帳號或一直沒收到驗證碼？
            <Link href="/login" className="ml-1 font-medium text-emerald-700 underline-offset-2 hover:underline">
              返回登入
            </Link>
          </p>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-3 text-xs text-neutral-500">重新傳送前請完成安全驗證。</p>
            <Turnstile
              key={`otp-${captchaResetNonce}`}
              siteKey={turnstileSiteKey}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
              options={{ language: 'zh-TW', size: 'flexible', action: `resend_${channel}` }}
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
            {isSubmitting ? <><Loader2 className="size-4 animate-spin" />驗證中...</> : '驗證並建立帳號'}
          </Button>
        </form>
      )}
    </div>
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
