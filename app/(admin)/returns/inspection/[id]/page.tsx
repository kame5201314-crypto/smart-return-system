'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, XCircle, Package, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { getReturnRequestDetail, submitInspection } from '@/lib/actions/return.actions';
import { getCurrentUser } from '@/lib/actions/auth';
import { inspectionSchema, type InspectionInput } from '@/lib/validations/return.schema';
import { INSPECTION_GRADES, INSPECTION_CHECKLIST, ERROR_MESSAGES } from '@/config/constants';

interface ReturnDetail {
  id: string;
  request_number: string;
  status: string;
  reason_category: string | null;
  reason_detail: string | null;
  order?: {
    customer_name: string | null;
    order_number: string;
  } | null;
  return_items?: {
    id: string;
    product_name: string;
    quantity: number;
  }[];
  return_images?: {
    id: string;
    image_url: string;
    image_type: string | null;
  }[];
}

export default function InspectionPage() {
  const params = useParams();
  const router = useRouter();
  const [returnData, setReturnData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const form = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      returnRequestId: params.id as string,
      result: undefined,
      conditionGrade: undefined,
      checklist: {
        packaging_intact: null,
        product_intact: null,
        accessories_complete: null,
        matches_photos: null,
        resellable: null,
      },
      notes: '',
      inspectorComment: '',
    },
  });

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  async function fetchDetail() {
    try {
      const result = await getReturnRequestDetail(params.id as string) as { success: boolean; data?: ReturnDetail; error?: string };
      if (result.success && result.data) {
        setReturnData(result.data);
        form.setValue('returnRequestId', result.data.id);
      }
    } catch (error) {
      console.error('Failed to fetch return detail:', error);
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: InspectionInput) {
    try {
      setSubmitting(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error('請先登入');
        return;
      }

      const result = await submitInspection(data, user.id);

      if (result.success) {
        toast.success('驗貨結果已提交');
        router.push(`/returns/${params.id}`);
      } else {
        toast.error(result.error || ERROR_MESSAGES.GENERIC);
      }
    } catch {
      toast.error(ERROR_MESSAGES.GENERIC);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">找不到此退貨單</p>
        <Button onClick={() => router.push('/returns')}>返回列表</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">驗貨工作台</h1>
        <p className="text-muted-foreground">
          退貨單號：{returnData.request_number}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Images & Info */}
        <div className="space-y-6">
          {/* Customer uploaded images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                客戶上傳照片
              </CardTitle>
              <CardDescription>
                請仔細核對照片與實際商品
              </CardDescription>
            </CardHeader>
            <CardContent>
              {returnData.return_images && returnData.return_images.length > 0 ? (
                <div className="space-y-4">
                  {/* Main image viewer */}
                  {selectedImage && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={selectedImage}
                        alt="Selected"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Thumbnails */}
                  <div className="grid grid-cols-4 gap-2">
                    {returnData.return_images.map((image) => (
                      <div
                        key={image.id}
                        className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors
                          ${selectedImage === image.image_url ? 'border-primary' : 'border-transparent hover:border-gray-300'}
                        `}
                        onClick={() => setSelectedImage(image.image_url)}
                      >
                        <img
                          src={image.image_url}
                          alt={image.image_type || 'Photo'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  尚無照片
                </p>
              )}
            </CardContent>
          </Card>

          {/* Return info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                退貨資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">客戶名稱</p>
                  <p className="font-medium">{returnData.order?.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">訂單編號</p>
                  <p className="font-medium">{returnData.order?.order_number || '-'}</p>
                </div>
              </div>

              {returnData.reason_detail && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">客戶說明</p>
                  <p className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200">
                    {returnData.reason_detail}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-muted-foreground text-sm mb-2">退貨商品</p>
                <div className="space-y-2">
                  {returnData.return_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm">{item.product_name}</span>
                      <Badge variant="outline">× {item.quantity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Inspection Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              驗貨表單
            </CardTitle>
            <CardDescription>
              請根據實際收貨情況填寫驗貨結果
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Result */}
                <FormField
                  control={form.control}
                  name="result"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>驗貨結果 *</FormLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={field.value === 'passed' ? 'default' : 'outline'}
                          className={field.value === 'passed' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => field.onChange('passed')}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          通過（直接結案）
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === 'failed' ? 'default' : 'outline'}
                          className={field.value === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
                          onClick={() => field.onChange('failed')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          異常（驗收異常）
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Condition Grade */}
                <FormField
                  control={form.control}
                  name="conditionGrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>商品狀態等級 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇等級" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(INSPECTION_GRADES).map((grade) => (
                            <SelectItem key={grade.key} value={grade.key}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{grade.key}</span>
                                <span>- {grade.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({grade.description})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Checklist */}
                <div className="space-y-3">
                  <FormLabel>檢查項目</FormLabel>
                  {INSPECTION_CHECKLIST.map((item) => (
                    <FormField
                      key={item.key}
                      control={form.control}
                      name={`checklist.${item.key}` as const}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(checked) => field.onChange(checked)}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {item.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>內部備註</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="輸入驗貨過程的內部備註..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Inspector Comment */}
                <FormField
                  control={form.control}
                  name="inspectorComment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>驗貨評語</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="輸入可顯示給客戶的驗貨評語..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '提交驗貨結果'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
