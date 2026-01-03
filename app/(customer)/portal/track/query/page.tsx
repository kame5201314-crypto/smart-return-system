'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, Phone, FileText, Package } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { toast } from 'sonner';

export default function TrackQueryPage() {
  const router = useRouter();
  const [requestNumber, setRequestNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'phone' | 'order'>('phone');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate based on search type
    if (searchType === 'phone') {
      if (!phone.trim() || !/^09\d{8}$/.test(phone)) {
        toast.error('請輸入有效的手機號碼 (09開頭，共10碼)');
        return;
      }
    } else {
      if (!requestNumber.trim()) {
        toast.error('請輸入退貨單號');
        return;
      }
    }

    setLoading(true);

    try {
      // Simulate search - in real implementation, this would call an API
      // that can search by either phone or request number
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo, show a message
      if (searchType === 'phone') {
        toast.success(`正在查詢手機 ${phone} 的退貨記錄...`);
        // In real implementation: router.push(`/portal/track/phone/${phone}`);
      } else {
        toast.success(`正在查詢退貨單號 ${requestNumber}...`);
        // In real implementation: router.push(`/portal/track/${requestNumber}`);
      }

      // For demo purposes, show no results message after a delay
      setTimeout(() => {
        toast.info('目前沒有符合的退貨記錄，請確認輸入資料是否正確');
        setLoading(false);
      }, 500);

    } catch {
      toast.error('查詢失敗，請稍後再試');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Back button */}
        <Link
          href="/portal"
          className="inline-flex items-center text-sm text-white/80 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回首頁
        </Link>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">查詢退貨進度</h1>
          <p className="text-purple-200 mt-2">輸入手機號碼或退貨單號查詢</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-lg">查詢方式</CardTitle>
            <CardDescription className="text-purple-200">
              請選擇以下任一方式查詢您的退貨進度
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'phone' | 'order')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  手機號碼
                </TabsTrigger>
                <TabsTrigger value="order" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  退貨單號
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit}>
                <TabsContent value="phone" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-purple-700 font-medium">
                      手機號碼
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="09xxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                      className="text-lg py-6"
                    />
                    <p className="text-sm text-gray-500">
                      請輸入您申請退貨時填寫的手機號碼
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="order" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="requestNumber" className="text-purple-700 font-medium">
                      退貨單號
                    </Label>
                    <Input
                      id="requestNumber"
                      placeholder="例如：RET-M5X7K9P2"
                      value={requestNumber}
                      onChange={(e) => setRequestNumber(e.target.value)}
                      disabled={loading}
                      className="text-lg py-6"
                    />
                    <p className="text-sm text-gray-500">
                      退貨單號會在申請成功後顯示，請妥善保存
                    </p>
                  </div>
                </TabsContent>

                <Button
                  type="submit"
                  className="w-full mt-6 bg-purple-600 hover:bg-purple-700 py-6 text-lg"
                  disabled={loading}
                >
                  {loading ? (
                    '查詢中...'
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      查詢進度
                    </>
                  )}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="mt-6 bg-white/90">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-600 space-y-2">
              <p>找不到您的退貨記錄？</p>
              <p className="text-gray-500">
                請確認輸入的資料與申請時填寫的一致<br />
                如有任何問題，請聯繫客服
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
