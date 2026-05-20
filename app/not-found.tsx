import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
            <PackageSearch className="size-10 text-primary" />
          </div>
        </div>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          找不到這個頁面
        </h1>
        <p className="mt-3 text-base text-gray-600">
          您要找的頁面可能已被移除、名稱已變更，或暫時無法使用。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">回首頁</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/analytics">前往後台</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
