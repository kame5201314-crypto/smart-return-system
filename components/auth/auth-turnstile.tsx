'use client';

import dynamic from 'next/dynamic';
import type { TurnstileProps } from '@marsidev/react-turnstile';

const DynamicTurnstile = dynamic<TurnstileProps>(
  () => import('@marsidev/react-turnstile').then((module) => module.Turnstile),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500"
      >
        正在載入安全驗證...
      </div>
    ),
  }
);

export function AuthTurnstile(props: TurnstileProps) {
  return <DynamicTurnstile {...props} />;
}
