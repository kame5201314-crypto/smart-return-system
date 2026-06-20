import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * PII-free placeholder for the legacy apply-confirmation page.
 *
 * Return applications must be tenant-scoped through /portal/[orgSlug] so the
 * submission is bound to the correct store. This page collects no personal data
 * and calls no server action; it only points visitors to their store's link.
 */
export default function ApplyLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center shadow-lg">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">申請退貨</h1>
        <Card className="mt-6 border-0 shadow-md text-left">
          <CardContent className="pt-6 space-y-3 text-gray-600">
            <p>
              請使用商家提供的<strong>專屬退貨連結</strong>申請退貨。
            </p>
            <p className="text-sm text-gray-500">
              連結格式為 <code className="px-1 py-0.5 bg-gray-100 rounded">/portal/您的商店代碼</code>。
              若您不確定商店代碼，請聯絡原購買商家索取退貨連結。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
