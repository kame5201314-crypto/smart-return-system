import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100">
            <PackageSearch className="size-10 text-emerald-700" />
          </div>
        </div>
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">
          找不到這個頁面
        </h1>
        <p className="mt-3 text-base text-neutral-600">
          這個頁面可能已被移除、名稱已變更，或暫時無法使用。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">返回首頁</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/analytics">前往工作台</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
