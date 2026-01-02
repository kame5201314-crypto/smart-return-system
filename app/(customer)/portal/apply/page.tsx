'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ImageUploader } from '@/components/upload/image-uploader';

import { getOrderForReturn, submitReturnApplication } from '@/lib/actions/return.actions';
import { returnApplySchema, type ReturnApplyInput } from '@/lib/validations/return.schema';
import { RETURN_REASONS, RETURN_SHIPPING_METHODS, IMAGE_UPLOAD_CONFIG, ERROR_MESSAGES } from '@/config/constants';
import type { CustomerSession, OrderWithItems } from '@/types';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  type: string;
}

export default function ReturnApplyPage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const form = useForm<ReturnApplyInput>({
    resolver: zodResolver(returnApplySchema),
    defaultValues: {
      orderId: '',
      reasonCategory: '',
      reasonDetail: '',
      returnShippingMethod: undefined,
      selectedItems: [],
    },
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('customerSession');
    if (!stored) {
      router.push('/portal');
      return;
    }

    const sessionData = JSON.parse(stored) as CustomerSession;
    setSession(sessionData);

    if (!sessionData.canApplyReturn || !sessionData.isReturnEligible) {
      toast.error('此訂單無法申請退貨');
      router.push('/portal/dashboard');
      return;
    }

    form.setValue('orderId', sessionData.orderId);

    // Fetch order details
    getOrderForReturn(sessionData.orderId).then((res) => {
      const result = res as { success: boolean; data?: OrderWithItems; error?: string };
      if (result.success && result.data) {
        setOrder(result.data);
      }
      setLoading(false);
    });
  }, [router, form]);

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  async function onSubmit(data: ReturnApplyInput) {
    // Validate images
    if (images.length < IMAGE_UPLOAD_CONFIG.MIN_REQUIRED) {
      toast.error(ERROR_MESSAGES.INSUFFICIENT_IMAGES);
      return;
    }

    // Validate selected items
    if (selectedItems.size === 0) {
      toast.error('請選擇至少一項要退貨的商品');
      return;
    }

    // Build selected items array
    const items = Array.from(selectedItems).map((itemId) => {
      const item = order?.order_items?.find((i) => i.id === itemId);
      return {
        orderItemId: itemId,
        quantity: item?.quantity || 1,
        reason: data.reasonCategory,
      };
    });

    try {
      setSubmitting(true);

      // In a real implementation, upload images to Supabase Storage first
      // For now, we'll simulate the upload
      const imageUrls = images.map((img) => ({
        url: img.preview, // Would be actual URL after upload
        type: img.type,
        storagePath: `returns/${session?.orderId}/${img.id}`,
      }));

      const result = await submitReturnApplication(
        { ...data, selectedItems: items },
        imageUrls
      );

      if (result.success && result.data) {
        setSuccess(result.data.requestNumber);
        toast.success('退貨申請已送出');
      } else {
        toast.error(result.error || ERROR_MESSAGES.GENERIC);
      }
    } catch {
      toast.error(ERROR_MESSAGES.GENERIC);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">申請成功</h2>
          <p className="text-muted-foreground mb-4">
            您的退貨申請編號為：<span className="font-mono font-bold">{success}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            請保留此編號以便查詢退貨進度
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.push('/portal/dashboard')}>
              返回首頁
            </Button>
            <Button onClick={() => router.push(`/portal/track/${success}`)}>
              查看進度
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>退貨申請</CardTitle>
          <CardDescription>
            訂單編號：{session.orderNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Select items to return */}
              <div className="space-y-3">
                <FormLabel>選擇退貨商品 *</FormLabel>
                {order?.order_items?.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors
                      ${selectedItems.has(item.id) ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}
                    `}
                    onClick={() => toggleItem(item.id)}
                  >
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku || 'N/A'} × {item.quantity}
                      </p>
                    </div>
                    {item.unit_price && (
                      <p className="font-medium">
                        NT$ {(item.unit_price * item.quantity).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
                {selectedItems.size === 0 && (
                  <p className="text-sm text-red-500">請選擇至少一項商品</p>
                )}
              </div>

              {/* Reason category */}
              <FormField
                control={form.control}
                name="reasonCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>退貨原因 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="請選擇退貨原因" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(RETURN_REASONS).map((reason) => (
                          <SelectItem key={reason.key} value={reason.key}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reason detail */}
              <FormField
                control={form.control}
                name="reasonDetail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>詳細說明 *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="請詳細說明退貨原因（至少10字）"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Return shipping method */}
              <FormField
                control={form.control}
                name="returnShippingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>退回方式 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="請選擇退回方式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(RETURN_SHIPPING_METHODS).map((method) => (
                          <SelectItem key={method.key} value={method.key}>
                            <div>
                              <p>{method.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {method.description}
                              </p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image upload */}
              <div className="space-y-2">
                <FormLabel>
                  上傳照片 * ({IMAGE_UPLOAD_CONFIG.MIN_REQUIRED}-{IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張)
                </FormLabel>
                <ImageUploader
                  images={images}
                  onImagesChange={setImages}
                  disabled={submitting}
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || images.length < IMAGE_UPLOAD_CONFIG.MIN_REQUIRED || selectedItems.size === 0}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                提交退貨申請
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
