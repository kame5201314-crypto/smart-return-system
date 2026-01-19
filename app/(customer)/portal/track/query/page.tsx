'use client';

import { useState } from 'react';
import { Search, ArrowLeft, Phone, FileText, Package, Clock, CheckCircle, AlertCircle, Truck } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import { toast } from 'sonner';
import { searchReturnsByPhone, searchReturnByNumber } from '@/lib/actions/customer-return.actions';

// Status label mapping
const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review: { label: '待審核', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" /> },
  approved_waiting_shipping: { label: '已核准，待寄回', color: 'bg-blue-100 text-blue-800', icon: <Package className="w-4 h-4" /> },
  shipping_in_transit: { label: '運送中', color: 'bg-purple-100 text-purple-800', icon: <Truck className="w-4 h-4" /> },
  received_inspecting: { label: '驗貨中', color: 'bg-orange-100 text-orange-800', icon: <Search className="w-4 h-4" /> },
  abnormal_disputed: { label: '異常處理中', color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-4 h-4" /> },
  refund_processing: { label: '退款處理中', color: 'bg-indigo-100 text-indigo-800', icon: <Clock className="w-4 h-4" /> },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
};

interface ReturnResult {
  id: string;
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_detail: string | null;
  created_at: string;
  approved_at?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  refund_processed_at?: string | null;
  closed_at?: string | null;
  order?: {
    order_number: string;
    customer_name: string | null;
  } | null;
  return_images?: {
    id: string;
    image_url: string;
    image_type: string | null;
  }[];
}

export default function TrackQueryPage() {
  const [requestNumber, setRequestNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'phone' | 'order'>('phone');
  const [results, setResults] = useState<ReturnResult[]>([]);
  const [searched, setSearched] = useState(false);

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
    setSearched(true);
    setResults([]);

    try {
      if (searchType === 'phone') {
        const result = await searchReturnsByPhone(phone);
        if (result.success && result.data) {
          setResults(result.data as ReturnResult[]);
          if (result.data.length === 0) {
            toast.info('沒有找到符合的退貨記錄');
          } else {
            toast.success(`找到 ${result.data.length} 筆退貨記錄`);
          }
        } else {
          toast.error(result.error || '查詢失敗');
        }
      } else {
        const result = await searchReturnByNumber(requestNumber);
        if (result.success && result.data) {
          setResults([result.data as ReturnResult]);
          toast.success('找到退貨記錄');
        } else {
          toast.error(result.error || '找不到此退貨單號');
        }
      }
    } catch {
      toast.error('查詢失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Back button */}
        <Link
          href="/portal"
          className="inline-flex items-center text-sm text-teal-600 hover:text-teal-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回首頁
        </Link>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">查詢退貨進度</h1>
          <p className="text-gray-500 mt-2">輸入手機號碼或退貨單號查詢</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="bg-teal-600 text-white rounded-t-lg">
            <CardTitle className="text-lg">查詢方式</CardTitle>
            <CardDescription className="text-teal-100">
              請選擇以下任一方式查詢您的退貨進度
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 bg-white">
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
                    <Label htmlFor="phone" className="text-teal-700 font-medium">
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
                    <Label htmlFor="requestNumber" className="text-teal-700 font-medium">
                      退貨單號
                    </Label>
                    <Input
                      id="requestNumber"
                      placeholder="例如：RET-20240101-0001"
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
                  className="w-full mt-6 bg-teal-600 hover:bg-teal-700 py-6 text-lg"
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

        {/* Results */}
        {searched && (
          <div className="mt-6 space-y-4">
            {results.length > 0 ? (
              results.map((item) => {
                const statusInfo = STATUS_LABELS[item.status] || { label: item.status, color: 'bg-gray-100 text-gray-800', icon: null };
                return (
                  <Card key={item.id} className="shadow-lg border-0 bg-white">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-500">退貨單號</p>
                          <p className="font-bold text-teal-600">{item.request_number}</p>
                        </div>
                        <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {item.order && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500">訂單編號</p>
                          <p className="font-medium">{item.order.order_number}</p>
                          {item.order.customer_name && (
                            <p className="text-sm text-gray-600">客戶: {item.order.customer_name}</p>
                          )}
                        </div>
                      )}

                      {item.reason_detail && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500">退貨原因</p>
                          <p className="text-gray-700">{item.reason_detail}</p>
                        </div>
                      )}

                      {item.return_images && item.return_images.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-2">上傳的圖片</p>
                          <div className="grid grid-cols-3 gap-2">
                            {item.return_images.map((img) => (
                              <a
                                key={img.id}
                                href={img.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-teal-400 transition-colors"
                              >
                                <img
                                  src={img.image_url}
                                  alt="退貨圖片"
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-4">
                        <p className="text-sm text-gray-500 mb-2">進度時間軸</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">申請時間</span>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                          {item.approved_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">核准時間</span>
                              <span>{formatDate(item.approved_at)}</span>
                            </div>
                          )}
                          {item.shipped_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">寄出時間</span>
                              <span>{formatDate(item.shipped_at)}</span>
                            </div>
                          )}
                          {item.received_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">收貨時間</span>
                              <span>{formatDate(item.received_at)}</span>
                            </div>
                          )}
                          {item.refund_processed_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">退款時間</span>
                              <span>{formatDate(item.refund_processed_at)}</span>
                            </div>
                          )}
                          {item.closed_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">結案時間</span>
                              <span>{formatDate(item.closed_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-center text-gray-600">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium">沒有找到退貨記錄</p>
                    <p className="text-sm text-gray-500 mt-1">
                      請確認輸入的資料與申請時填寫的一致
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Help Card */}
        {!searched && (
          <Card className="mt-6 bg-white border-0 shadow-md">
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
        )}
      </div>
    </div>
  );
}
