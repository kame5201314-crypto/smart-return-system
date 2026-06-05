'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, PackageCheck, ShieldCheck, User } from 'lucide-react';

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

function isPlatformAdminNext(value: string | null): boolean {
  if (!value) return false;
  return value === '/admin' || value === '/internal' || value.startsWith('/internal/');
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const isPlatformAdminLogin = isPlatformAdminNext(nextParam);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginInput) {
    try {
      setIsLoading(true);
      const nextPath =
        typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next');
      const result = await signIn(data.email, data.password, nextPath ?? undefined);

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
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
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
          <p className="text-neutral-500 mt-2">
            {isPlatformAdminLogin ? '平台管理員登入' : '登入你的工作區'}
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {isPlatformAdminLogin ? '平台管理後台登入' : '歡迎回來'}
            </CardTitle>
            <CardDescription>
              {isPlatformAdminLogin
                ? '請使用平台管理員帳號登入。商家請改用一般登入入口。'
                : '請輸入帳號密碼進入退貨工作區。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>帳號</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="輸入帳號"
                            className="pl-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
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
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
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
                還沒有帳號？
                <Link
                  href="/signup"
                  className="ml-1 font-medium text-emerald-700 underline-offset-2 hover:underline"
                >
                  申請 14 天免費試用
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Back to home */}
        <p className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回首頁
          </Link>
        </p>

        {/* Footer */}
        <p className="text-center text-neutral-400 text-xs mt-4">
          © {new Date().getFullYear()} Smart Return. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
          <div className="text-sm text-neutral-500">Loading...</div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
