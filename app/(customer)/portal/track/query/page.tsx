'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { getReturnStatus } from '@/lib/actions/return.actions';
import { toast } from 'sonner';

export default function TrackQueryPage() {
  const router = useRouter();
  const [requestNumber, setRequestNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requestNumber.trim()) {
      toast.error('請輸入退貨單號');
      return;
    }

    if (!phone.trim() || !/^09\d{8}$/.test(phone)) {
      toast.error('請輸入有效的手機號碼');
      return;
    }

    setLoading(true);

    try {
      const result = await getReturnStatus(requestNumber.trim(), phone.trim());

      if (!result.success) {
        toast.error(result.error || '查詢失敗');
        setLoading(false);
        return;
      }

      // Navigate to track detail page
      router.push(`/portal/track/${result.data?.id}`);
    } catch {
      toast.error('查詢失敗，請稍後再試');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/portal/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>查詢退貨進度</CardTitle>
          <CardDescription>
            請輸入退貨單號與手機號碼以查詢退貨進度
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestNumber">退貨單號</Label>
              <Input
                id="requestNumber"
                placeholder="例如：RET-20240101-001"
                value={requestNumber}
                onChange={(e) => setRequestNumber(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">手機號碼</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="09xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                '查詢中...'
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  查詢進度
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>退貨單號會在申請退貨後透過簡訊發送給您</p>
            <p className="mt-1">如有任何問題，請聯繫客服</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
