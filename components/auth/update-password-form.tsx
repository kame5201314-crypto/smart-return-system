'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateRecoveredPassword } from '@/lib/actions/password-recovery';
import { getPasswordRecoveryErrorMessage } from '@/lib/auth/password-recovery';
import { validateVerifiedSignupPassword } from '@/lib/auth/verified-signup';

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      validateVerifiedSignupPassword(password, confirmation);
      setIsSubmitting(true);

      const result = await updateRecoveredPassword(password, confirmation);
      if (!result.success) {
        setError(result.error || '密碼更新失敗，請重新進行帳號復原。');
        return;
      }

      router.replace('/login?password_reset=success');
      router.refresh();
    } catch (caughtError) {
      setError(getPasswordRecoveryErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="new-password" className="text-sm font-medium text-neutral-900">
          新密碼
        </label>
        <div className="relative mt-2">
          <LockKeyhole
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <Input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            required
            disabled={isSubmitting}
            className="pl-10 pr-10"
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
        <label htmlFor="new-password-confirmation" className="text-sm font-medium text-neutral-900">
          確認新密碼
        </label>
        <Input
          id="new-password-confirmation"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          minLength={8}
          maxLength={72}
          required
          disabled={isSubmitting}
          className="mt-2"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            更新中...
          </>
        ) : (
          '更新密碼並重新登入'
        )}
      </Button>
    </form>
  );
}
