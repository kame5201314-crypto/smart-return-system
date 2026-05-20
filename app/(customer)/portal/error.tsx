'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function CustomerPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[customer-portal] page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="mx-auto w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="size-8 text-red-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">無法載入此頁面</h2>
        <p className="mt-2 text-sm text-gray-600">
          連線發生問題，請重新嘗試。若仍無法載入，請聯絡賣場客服協助。
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-gray-400">
            error id: {error.digest}
          </p>
        ) : null}
        <div className="mt-6">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 size-4" />
            重新嘗試
          </Button>
        </div>
      </div>
    </div>
  );
}
