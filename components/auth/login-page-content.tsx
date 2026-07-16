'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  PackageCheck,
  ShieldCheck,
  User,
  UserRoundPlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { signIn } from '@/lib/actions/auth';

const loginSchema = z.object({
  email: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

type LoginInput = z.infer<typeof loginSchema>;

interface LoginPageContentProps {
  googleAuthEnabled: boolean;
  googleSignupEnabled?: boolean;
  accountRegistrationEnabled?: boolean;
  passwordRecoveryEnabled?: boolean;
  captchaRequired?: boolean;
  captchaReady?: boolean;
  turnstileSiteKey?: string;
}

function isPlatformAdminNext(value: string | null): boolean {
  if (!value) return false;
  return value === '/admin' || value === '/internal' || value.startsWith('/internal/');
}

function getGoogleErrorMessage(value: string | null): string | null {
  if (value === 'google_auth_disabled') return 'Google 登入目前尚未開放。';
  if (value === 'google_auth_expired') return '登入流程已失效，請重新使用 Google 登入';
  if (value === 'google_auth_failed') return 'Google 登入失敗，請重新嘗試。';
  return null;
}

function GoogleSignInIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <Image
      src="/brand/google-sign-in-light-square.png"
      alt=""
      width={40}
      height={40}
      className={className}
      aria-hidden="true"
      draggable={false}
      data-testid="google-sign-in-icon"
    />
  );
}

export function LoginPageContent({
  googleAuthEnabled,
  googleSignupEnabled = false,
  accountRegistrationEnabled = googleSignupEnabled,
  passwordRecoveryEnabled = false,
  captchaRequired = false,
  captchaReady = false,
  turnstileSiteKey = '',
}: LoginPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const planParam = searchParams.get('plan');
  const isPlatformAdminLogin = isPlatformAdminNext(nextParam);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const googleErrorCode = searchParams.get('error');
  const googleError = getGoogleErrorMessage(googleErrorCode);
  const googleAuthExpired = googleErrorCode === 'google_auth_expired';
  const passwordResetSucceeded = searchParams.get('password_reset') === 'success';
  const authCaptchaRequired = captchaRequired;
  const authCaptchaReady = !authCaptchaRequired || captchaReady;

  const googleHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('next', nextParam && !isPlatformAdminLogin ? nextParam : '/analytics');
    if (planParam === 'basic' || planParam === 'growth') {
      params.set('plan', planParam);
    }
    return `/auth/google?${params.toString()}`;
  }, [isPlatformAdminLogin, nextParam, planParam]);

  const signupHref = useMemo(() => {
    if (planParam === 'basic' || planParam === 'growth') {
      return `/signup?plan=${planParam}`;
    }
    return '/signup';
  }, [planParam]);

  useEffect(() => {
    if (googleError) toast.error(googleError);
  }, [googleError]);

  useEffect(() => {
    if (passwordResetSucceeded) toast.success('密碼已更新，請使用新密碼登入。');
  }, [passwordResetSucceeded]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginInput) {
    try {
      if (authCaptchaRequired && !captchaToken) {
        toast.error('請先完成安全驗證。');
        return;
      }
      setIsLoading(true);
      const nextPath =
        typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next');
      const result = await signIn(
        data.email,
        data.password,
        nextPath ?? undefined,
        captchaToken ?? undefined
      );

      if (!result.success) {
        toast.error(result.error || '登入失敗');
        return;
      }

      toast.success('登入成功！');
      router.push(result.redirectTo ?? '/analytics');
      router.refresh();
    } catch {
      toast.error('登入失敗，請稍後再試');
    } finally {
      setIsLoading(false);
      if (authCaptchaRequired) {
        setCaptchaToken(null);
        setCaptchaResetNonce((value) => value + 1);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className={`mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl transition-colors ${
              isPlatformAdminLogin
                ? 'bg-neutral-900 hover:bg-neutral-800'
                : 'bg-emerald-100 hover:bg-emerald-200'
            }`}
            aria-label="返回首頁"
          >
            {isPlatformAdminLogin ? (
              <ShieldCheck className="size-8 text-emerald-300" />
            ) : (
              <PackageCheck className="size-8 text-emerald-700" />
            )}
          </Link>
          <h1 className="text-2xl font-bold text-neutral-950">Smart Return</h1>
          <p className="mt-2 text-neutral-500">
            {isPlatformAdminLogin ? '平台管理員登入' : '登入你的工作區'}
          </p>
        </div>

        <Card className="border bg-white shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {isPlatformAdminLogin ? '平台管理後台登入' : '歡迎回來'}
            </CardTitle>
            <CardDescription>
              {isPlatformAdminLogin
                ? '請使用平台管理員帳號登入。商家請改用一般登入入口。'
                : '以電子信箱／手機號碼與密碼登入，或使用 Google 進入退貨工作區。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {googleError ? (
              <div
                role="alert"
                className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{googleError}</p>
                    {googleAuthExpired && googleAuthEnabled && !isPlatformAdminLogin ? (
                      <Button asChild size="sm" variant="outline" className="mt-3 bg-white">
                        <Link href={googleHref}>
                          <GoogleSignInIcon className="size-5" />
                          重新使用 Google 登入
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {passwordResetSucceeded ? (
              <div
                role="status"
                className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
              >
                密碼已更新，請使用新密碼登入。
              </div>
            ) : null}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>電子信箱／手機號碼</FormLabel>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="name@example.com 或 0912345678"
                            className="pl-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密碼</FormLabel>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {authCaptchaRequired ? (
                  authCaptchaReady ? (
                    <Turnstile
                      key={`login-${captchaResetNonce}`}
                      siteKey={turnstileSiteKey}
                      onSuccess={setCaptchaToken}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => {
                        setCaptchaToken(null);
                        toast.error('安全驗證載入失敗，請重新整理後再試。');
                      }}
                      options={{ language: 'zh-TW', size: 'flexible', action: 'password_login' }}
                    />
                  ) : (
                    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      登入安全驗證設定不完整，請聯絡客服。
                    </p>
                  )
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !authCaptchaReady || (authCaptchaRequired && !captchaToken)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      登入中...
                    </>
                  ) : (
                    '登入'
                  )}
                </Button>
              </form>
            </Form>

            {!isPlatformAdminLogin && passwordRecoveryEnabled ? (
              <p className="mt-4 text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                >
                  忘記密碼？使用驗證碼復原
                </Link>
              </p>
            ) : null}

            {!isPlatformAdminLogin && googleAuthEnabled ? (
              <div className="mt-6">
                <div className="mb-5 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <span className="text-xs text-neutral-400">或使用 Google 帳號</span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>
                <Button asChild variant="outline" className="h-11 w-full bg-white">
                  <Link href={googleHref}>
                    <GoogleSignInIcon />
                    使用 Google 登入
                  </Link>
                </Button>
              </div>
            ) : null}

            {isPlatformAdminLogin ? (
              <p className="mt-6 text-center text-sm text-neutral-600">
                想以商家身分登入？
                <Link
                  href="/login"
                  className="ml-1 font-medium text-emerald-700 underline-offset-2 hover:underline"
                >
                  改用一般登入
                </Link>
              </p>
            ) : (
              <div className="mt-6 border-t border-neutral-200 pt-5 text-center">
                <p className="text-sm font-medium text-neutral-800">
                  {accountRegistrationEnabled
                    ? '還沒有帳號？立即免費建立。'
                    : '還沒有帳號？先申請免費試用。'}
                </p>
                <Button asChild variant="outline" className="mt-3 w-full bg-white">
                  <Link href={signupHref}>
                    <UserRoundPlus className="size-4" aria-hidden="true" />
                    {accountRegistrationEnabled ? '註冊新帳號' : '申請 3 天免費試用'}
                  </Link>
                </Button>
                {accountRegistrationEnabled ? (
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {googleSignupEnabled
                      ? '可使用 Google 註冊，立即開始 3 天免費試用；不需信用卡。'
                      : '使用註冊頁目前開放的驗證方式建立帳號；不需信用卡。'}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回首頁
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} Smart Return. All rights reserved.
        </p>
      </div>
    </div>
  );
}
