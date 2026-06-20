import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * PII-free portal landing page.
 *
 * The customer portal is multi-tenant and unauthenticated, so every apply /
 * query action must be scoped to a specific store via /portal/[orgSlug]. This
 * bare /portal page intentionally collects NO personal data and calls NO server
 * action; it only directs visitors to their store's dedicated return link.
 */
export default function PortalLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center shadow-lg">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">退貨服務</h1>
        <Card className="mt-6 border-0 shadow-md text-left">
          <CardContent className="pt-6 space-y-3 text-gray-600">
            <p>
              請使用商家提供的<strong>專屬退貨連結</strong>來申請退貨或查詢進度。
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
