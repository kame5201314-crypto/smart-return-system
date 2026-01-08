'use client';

import { ExternalLink, Truck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LOGISTICS_PROVIDERS } from '@/config/constants';

export default function LogisticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">物流快查</h1>
        <p className="text-muted-foreground">快速查詢各物流商包裹狀態</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            物流商查詢連結
          </CardTitle>
          <CardDescription>點擊下方連結，前往各物流商查詢系統</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LOGISTICS_PROVIDERS.map((provider) => (
              <a
                key={provider.key}
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-6 bg-gray-50 rounded-lg hover:bg-gray-100 hover:shadow-md transition-all group border"
              >
                <span className="text-4xl">{provider.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg">{provider.label}</p>
                  <p className="text-sm text-muted-foreground">點擊查詢包裹狀態</p>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
