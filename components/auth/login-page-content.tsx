'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthTurnstile } from '@/components/auth/auth-turnstile';
import { GoogleSignInIcon } from '@/components/auth/google-sign-in-icon';
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
  const passwordSetupSucceeded = searchParams.get('password_setup') === 'success';
  const authCaptchaRequired = captchaRequired;
  const authCaptchaReady = !authCaptchaRequired || captchaReady;

  const googleHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('next', nextParam === '/account/set-password' ? nextParam : '/analytics');
    if (planParam === 'basic' || planParam === 'growth') {
      params.set('plan', planParam);
    }
    return `/auth/google?${params.toString()}`;
  }, [nextParam, planParam]);

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

  useEffect(() => {
    if (passwordSetupSucceeded) toast.success('密碼已設定，請使用信箱與新密碼登入。');
  }, [passwordSetupSucceeded]);

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
        if (result.verificationPath) {
          toast.error(result.error || '帳號尚未完成驗證。');
          router.push(result.verificationPath);
          return;
        }
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

        <Card className="border-neutral-200 bg-white shadow-lg">
          <CardHeader className="space-y-2 pb-5 sm:px-8 sm:pt-8">
            <CardTitle className="text-2xl">
              {isPlatformAdminLogin ? '平台管理後台登入' : '登入工作區'}
            </CardTitle>
            <CardDescription className="leading-6">
              {isPlatformAdminLogin
                ? '請使用平台管理員帳號登入。商家請改用一般登入入口。'
                : googleAuthEnabled
                  ? '使用帳號密碼登入，或以 Google 繼續。'
                  : '使用電子信箱／手機號碼與密碼登入。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="sm:px-8 sm:pb-8">
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

            {passwordSetupSucceeded ? (
              <div
                role="status"
                className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
              >
                密碼已設定，請使用信箱與新密碼登入。
              </div>
            ) : null}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {isPlatformAdminLogin ? '管理員帳號或電子信箱' : '電子信箱／手機號碼'}
                      </FormLabel>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <FormControl>
                          <Input
                            type="text"
                            placeholder={isPlatformAdminLogin
                              ? '請輸入管理員帳號或電子信箱'
                              : 'name@example.com 或 0912345678'}
                            className="h-12 pl-10 text-base"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <p className="text-xs text-neutral-500">密碼會區分英文字母大小寫。</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-4">
                        <FormLabel>密碼</FormLabel>
                        {!isPlatformAdminLogin && passwordRecoveryEnabled ? (
                          <Link
                            href="/forgot-password"
                            className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
                          >
                            忘記密碼？
                          </Link>
                        ) : null}
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="h-12 pl-10 pr-10 text-base"
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
                    <AuthTurnstile
                      key={`login-${captchaResetNonce}`}
                      siteKey={turnstileSiteKey}
                      onSuccess={setCaptchaToken}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => {
                        setCaptchaToken(null);
                        toast.error('安全驗證載入失敗，請重新整理後再試。');
                      }}
                      options={{ language: 'zh-tw', size: 'flexible', action: 'password_login' }}
                    />
                  ) : (
                    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      登入安全驗證設定不完整，請聯絡客服。
                    </p>
                  )
                ) : null}

                <Button
                  type="submit"
                  className="h-12 w-full text-base"
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

            {!isPlatformAdminLogin && googleAuthEnabled ? (
              <div className="mt-6">
                <div className="mb-4 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <span className="text-xs text-neutral-400">其他登入方式</span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>
                <Button asChild variant="outline" className="h-12 w-full bg-white text-base">
                  <Link href={googleHref}>
                    <GoogleSignInIcon />
                    使用 Google 繼續
                  </Link>
                </Button>
                <p className="mt-2 text-center text-xs leading-5 text-neutral-500">
                  {googleSignupEnabled
                    ? '第一次使用 Google？驗證後會先完成商家資料。'
                    : 'Google 僅供已連結的既有帳號登入。'}
                </p>
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
              <p className="mt-6 text-center text-sm text-neutral-600">
                {accountRegistrationEnabled ? '第一次使用 Smart Return？' : '需要新的商家工作區？'}
                <Link
                  href={signupHref}
                  className="ml-1 font-semibold text-emerald-700 underline-offset-2 hover:underline"
                >
                  {accountRegistrationEnabled ? '建立帳號' : '申請免費試用'}
                </Link>
              </p>
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
