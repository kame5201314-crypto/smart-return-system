import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * PII-free placeholder for the legacy phone-only tracking page.
 *
 * Phone-only lookups are disabled (they leaked return PII within a store). The
 * real, tenant-scoped query lives at /portal/[orgSlug]/track/query and requires
 * BOTH a return number and the matching phone. This page collects no personal
 * data and calls no server action.
 */
export default function TrackQueryLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center shadow-lg">
          <Search className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">查詢退貨進度</h1>
        <Card className="mt-6 border-0 shadow-md text-left">
          <CardContent className="pt-6 space-y-3 text-gray-600">
            <p>
              查詢退貨進度請使用商家提供的<strong>專屬查詢連結</strong>，
              並備妥您的<strong>退貨單號</strong>與<strong>手機號碼</strong>。
            </p>
            <p className="text-sm text-gray-500">
              連結格式為 <code className="px-1 py-0.5 bg-gray-100 rounded">/portal/您的商店代碼/track/query</code>。
              若您不確定商店代碼，請聯絡原購買商家。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
