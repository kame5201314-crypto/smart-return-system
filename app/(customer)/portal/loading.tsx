import { Loader2 } from 'lucide-react';

export default function CustomerPortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="text-center">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-gray-600">載入中，請稍候…</p>
      </div>
    </div>
  );
}
