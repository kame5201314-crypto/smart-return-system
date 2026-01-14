'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Package, Send, CheckCircle, Camera } from 'lucide-react';
import { z } from 'zod';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleImageUploader } from '@/components/upload/simple-image-uploader';
import { submitCustomerReturn } from '@/lib/actions/customer-return.actions';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

// Form validation schema
const returnFormSchema = z.object({
  accountId: z.string().min(1, '請填寫您的帳號'),
  orderNumber: z.string().min(1, '請填寫訂單編號'),
  ordererName: z.string().min(1, '請填寫訂購人姓名'),
  phone: z.string().regex(/^09\d{8}$/, '請輸入有效的手機號碼'),
  channelSource: z.string().min(1, '請選擇購買通路'),
  returnReason: z.string().min(1, '請填寫退換貨原因'),
  productSuggestion: z.string().optional(),
});

type ReturnFormInput = z.infer<typeof returnFormSchema>;

// Helper to convert File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export default function CustomerPortalPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    orderNumber: string;
    requestNumber: string;
  } | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [shippingLabelImages, setShippingLabelImages] = useState<UploadedImage[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Product options for checkbox selection
  const productOptions = [
    { id: 'mefu', label: 'MEFU 自拍棒 / 行動電源 / 充電頭 系列' },
    { id: 'apexel', label: 'APEXEL 鏡頭系統' },
    { id: 'other', label: '其他' },
  ];

  const form = useForm<ReturnFormInput>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      accountId: '',
      orderNumber: '',
      ordererName: '',
      phone: '',
      channelSource: '',
      returnReason: '',
      productSuggestion: '',
    },
  });

  async function onSubmit(data: ReturnFormInput) {
    // Validate at least one product selected
    if (selectedProducts.length === 0) {
      toast.error('請至少選擇一項退貨商品');
      return;
    }

    // Validate at least one image
    if (images.length === 0) {
      toast.error('請至少上傳一張照片');
      return;
    }

    try {
      setIsLoading(true);

      // Convert images to base64 for server action
      const imageFilesData = await Promise.all(
        images.map(async (img) => ({
          name: img.file.name,
          type: img.file.type,
          base64: await fileToBase64(img.file),
        }))
      );

      // Convert shipping label images to base64
      const shippingLabelFilesData = await Promise.all(
        shippingLabelImages.map(async (img) => ({
          name: img.file.name,
          type: img.file.type,
          base64: await fileToBase64(img.file),
        }))
      );

      // Combine all images
      const allImagesData = [...imageFilesData, ...shippingLabelFilesData];

      // Get selected product labels for submission
      const selectedProductLabels = selectedProducts.map(
        (id) => productOptions.find((opt) => opt.id === id)?.label || id
      );

      // Submit to server
      const result = await submitCustomerReturn(
        {
          channelSource: data.channelSource,
          accountId: data.accountId,
          orderNumber: data.orderNumber,
          ordererName: data.ordererName,
          phone: data.phone,
          returnProducts: selectedProductLabels,
          returnReason: data.returnReason,
          productSuggestion: data.productSuggestion,
        },
        allImagesData
      );

      if (!result.success) {
        toast.error(result.error || '送出失敗，請稍後再試');
        return;
      }

      // Store data for confirmation
      setSubmittedData({
        orderNumber: data.orderNumber,
        requestNumber: result.data?.requestNumber || '',
      });

      // Cleanup image previews
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      shippingLabelImages.forEach((img) => URL.revokeObjectURL(img.preview));

      // Show success state
      setIsSubmitted(true);
      toast.success('退貨申請已成功送出！');

    } catch (error) {
      console.error('Submit error:', error);
      toast.error('送出失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }

  // Success state after submission
  if (isSubmitted && submittedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <Card className="shadow-lg border-0">
            <CardContent className="pt-10 pb-10 text-center">
              <div className="mx-auto mb-6 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                退貨申請已送出
              </h1>
              <p className="text-gray-600 mb-6">
                我們已收到您的退貨申請，將盡快為您處理
              </p>

              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-500 mb-1">退貨單號</div>
                <div className="text-xl font-bold text-teal-600">
                  {submittedData.requestNumber}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  請妥善保存此單號，以便查詢退貨進度
                </p>
              </div>

              <div className="space-y-3">
                <Link href="/portal/track/query">
                  <Button className="w-full bg-teal-600 hover:bg-teal-700">
                    查詢退貨進度
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsSubmitted(false);
                    setSubmittedData(null);
                    setImages([]);
                    setShippingLabelImages([]);
                    setSelectedProducts([]);
                    form.reset();
                  }}
                >
                  繼續申請其他退貨
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">產品退、換貨表單</h1>
          <p className="text-gray-500 mt-2">請填寫以下資料並上傳照片</p>
        </div>

        {/* Help Message & Tutorial Link */}
        <Card className="shadow-lg border-0 mb-6 overflow-hidden">
          <CardContent className="p-4 bg-gradient-to-r from-slate-800 to-slate-700">
            <p className="text-white text-center font-medium mb-4">
              遇到產品問題想退貨? 請給我們一分鐘協助您解決問題!
            </p>
            <a
              href="/tutorial/lens"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="bg-slate-900 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">📷</div>
                  <div>
                    <h3 className="text-white text-xl font-bold">鏡頭組裝教學</h3>
                    <p className="text-gray-300 text-sm">APEXEL 手機鏡頭安裝指南</p>
                  </div>
                </div>
                <div className="bg-teal-600 text-white px-4 py-2 rounded-lg font-medium">
                  了解更多 ▶
                </div>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Form Card */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-lg">退換貨申請資料</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 bg-white">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Channel Source */}
                <FormField
                  control={form.control}
                  name="channelSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        購買通路 <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="請選擇購買通路" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="official">官網</SelectItem>
                          <SelectItem value="shopee">蝦皮</SelectItem>
                          <SelectItem value="other">其他</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Account ID */}
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        您的帳號 (官網 / 蝦皮) <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Order Number */}
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        訂單編號 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Orderer Name */}
                <FormField
                  control={form.control}
                  name="ordererName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        訂購人 <span className="text-red-500">*</span>
                      </FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
                        (請填寫訂單上的名字，收件人若有不同也請一起填寫)
                      </p>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        您的電話 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="09xxxxxxxx"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Return Products - Checkbox Selection */}
                <div className="space-y-3">
                  <FormLabel className="text-teal-700 font-medium">
                    退貨商品 <span className="text-red-500">*</span>
                  </FormLabel>
                  <p className="text-sm text-gray-500">
                    請選擇您要退貨的商品類型（可複選）
                  </p>
                  <div className="space-y-3">
                    {productOptions.map((option) => (
                      <div key={option.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={option.id}
                          checked={selectedProducts.includes(option.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts([...selectedProducts, option.id]);
                            } else {
                              setSelectedProducts(selectedProducts.filter((p) => p !== option.id));
                            }
                          }}
                          disabled={isLoading}
                          className="border-gray-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                        />
                        <label
                          htmlFor={option.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Reason */}
                <FormField
                  control={form.control}
                  name="returnReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        退、換貨原因 <span className="text-red-500">*</span>
                      </FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
                        覺得產品哪個部分不適合？
                      </p>
                      <FormControl>
                        <Textarea
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0 min-h-[100px]"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Product Suggestion */}
                <FormField
                  control={form.control}
                  name="productSuggestion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-medium">
                        對產品有什麼建議？
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0 min-h-[100px]"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image Upload Section - Product Photos */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-teal-600" />
                    <FormLabel className="text-teal-700 font-medium text-base">
                      上傳產品照片 <span className="text-red-500">*</span>
                    </FormLabel>
                  </div>
                  <p className="text-sm text-gray-500">
                    請上傳產品照片及外箱照片（最多 5 張）
                  </p>
                  <SimpleImageUploader
                    images={images}
                    onImagesChange={setImages}
                    disabled={isLoading}
                    maxImages={5}
                    maxFileSizeMB={10}
                  />
                </div>

                {/* Image Upload Section - Shipping Label */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-teal-600" />
                    <FormLabel className="text-teal-700 font-medium text-base">
                      上傳寄件單照片
                    </FormLabel>
                  </div>
                  <p className="text-sm text-gray-500">
                    請上傳寄件單照片（最多 2 張）
                  </p>
                  <SimpleImageUploader
                    images={shippingLabelImages}
                    onImagesChange={setShippingLabelImages}
                    disabled={isLoading}
                    maxImages={2}
                    maxFileSizeMB={10}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      送出中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      送出退貨申請
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Notice */}
        <Card className="mt-6 bg-white shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-teal-700">退貨須知</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>1. 商品退貨需於鑑賞期內申請退貨。</p>
            <p>2. 請上傳產品照片及外箱照片、寄件單號，將能加快處理速度。</p>
            <p>3. 退貨流程約 9~12 天內完成，請耐心等候。</p>
          </CardContent>
        </Card>

        {/* Track Query Link */}
        <Card className="mt-6 bg-teal-50 border-teal-200 shadow-md">
          <CardContent className="p-4">
            <Link href="/portal/track/query" className="flex items-center justify-between group">
              <div>
                <p className="font-medium text-teal-800">已申請過？</p>
                <p className="text-sm text-teal-600">點此查詢退貨進度</p>
              </div>
              <div className="bg-teal-600 text-white px-4 py-2 rounded-lg group-hover:bg-teal-700 transition-colors">
                查詢進度
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
