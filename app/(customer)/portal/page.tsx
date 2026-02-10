'use client';

import { useCallback, useRef, useState } from 'react';
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
import { DirectImageUploader, type UploadSession, type UploadedImage } from '@/components/upload/direct-image-uploader';
import { submitCustomerReturn } from '@/lib/actions/customer-return.actions';

// Form validation schema
const returnFormSchema = z.object({
  accountId: z.string().min(1, '請填寫您的帳號'),
  orderNumber: z.string().min(1, '請填寫訂單編號'),
  ordererName: z.string().min(1, '請填寫訂購人姓名'),
  phone: z.string().regex(/^09\d{8}$/, '請輸入有效的手機號碼'),
  channelSource: z.string().min(1, '請選擇購買通路'),
  returnReason: z.string().optional(), // Now using checkbox selection
  productSuggestion: z.string().optional(),
});

type ReturnFormInput = z.infer<typeof returnFormSchema>;

export default function CustomerPortalPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    orderNumber: string;
    requestNumber: string;
  } | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [shippingLabelImages, setShippingLabelImages] = useState<UploadedImage[]>([]);
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const uploadSessionRequestRef = useRef<Promise<UploadSession> | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherReasonText, setOtherReasonText] = useState('');
  const [notAsDescribedText, setNotAsDescribedText] = useState('');
  const [selectedApexelIssues, setSelectedApexelIssues] = useState<string[]>([]);
  const [apexelOtherIssueText, setApexelOtherIssueText] = useState('');
  // Official website return method states
  const [returnMethod, setReturnMethod] = useState<string>('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  // Channel source states (now using checkbox)
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [otherChannelText, setOtherChannelText] = useState('');

  // Channel source options for checkbox selection
  const channelOptions = [
    { id: 'official', label: '官網' },
    { id: 'shopee', label: '蝦皮' },
    { id: 'zeczec', label: '嘖嘖' },
    { id: 'other', label: '其他' },
  ];

  // Product options for checkbox selection
  const productOptions = [
    { id: 'mefu', label: 'MEFU 自拍棒 / 行動電源 / 充電頭 系列' },
    { id: 'apexel', label: 'APEXEL 鏡頭系列' },
    { id: 'other', label: '其他' },
  ];

  // Return reason options (7 options + other)
  const reasonOptions = [
    { id: 'quality_issue', label: '品質問題' },
    { id: 'defective', label: '商品故障' },
    { id: 'damaged_in_transit', label: '運送損壞' },
    { id: 'not_as_described', label: '與描述不符' },
    { id: 'wrong_item', label: '送錯商品' },
    { id: 'change_of_mind', label: '改變心意' },
    { id: 'other', label: '其他' },
  ];

  // APEXEL specific issue options (shown when APEXEL + quality/defective)
  const apexelIssueOptions = [
    { id: 'cannot_install', label: '手機無法安裝' },
    { id: 'blurry_focus', label: '鏡頭模糊 無法對焦' },
    { id: 'apexel_other', label: '其他' },
  ];

  // Official website return method options
  const returnMethodOptions = [
    { id: 'refund', label: '退貨退款' },
    { id: 'credit_card_refund', label: '信用卡刷退 (訂單為信用卡付款才能使用信用卡刷退)' },
    { id: 'exchange_only', label: '僅換貨(不退款)' },
  ];

  // Check if APEXEL issues should be shown
  const shouldShowApexelIssues =
    selectedProducts.includes('apexel') &&
    (selectedReasons.includes('quality_issue') || selectedReasons.includes('defective'));

  // Check if APEXEL tutorial link should be shown
  const shouldShowApexelTutorial =
    selectedProducts.includes('apexel') &&
    (selectedReasons.includes('quality_issue') ||
      selectedReasons.includes('defective') ||
      selectedReasons.includes('not_as_described') ||
      selectedReasons.includes('other'));

  // APEXEL tutorial link
  const APEXEL_TUTORIAL_URL = 'https://mefu.s3.ap-southeast-1.amazonaws.com/_MEFU%E5%AE%98%E7%B6%B2/APEXEL%E6%89%8B%E6%A9%9F%E9%8F%A1%E9%A0%AD%E7%B5%84%E8%A3%9D%E6%95%99%E5%AD%B8.html';

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

  const requestUploadSession = useCallback(
    async (draftId?: string): Promise<UploadSession> => {
      const response = await fetch('/api/v1/upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftId ? { draftId } : {}),
      });

      const payload = await response.json() as {
        success: boolean;
        draftId?: string;
        sessionToken?: string;
        expiresAt?: number;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.draftId || !payload.sessionToken || !payload.expiresAt) {
        throw new Error(payload.error || '無法建立上傳工作階段');
      }

      return {
        draftId: payload.draftId,
        sessionToken: payload.sessionToken,
        expiresAt: payload.expiresAt,
      };
    },
    []
  );

  const getUploadSession = useCallback(async (): Promise<UploadSession> => {
    const now = Date.now();
    if (uploadSession && uploadSession.expiresAt - now > 30 * 1000) {
      return uploadSession;
    }

    if (uploadSessionRequestRef.current) {
      return uploadSessionRequestRef.current;
    }

    const requestPromise = requestUploadSession(uploadSession?.draftId);
    uploadSessionRequestRef.current = requestPromise;

    try {
      const nextSession = await requestPromise;
      setUploadSession(nextSession);
      return nextSession;
    } finally {
      uploadSessionRequestRef.current = null;
    }
  }, [requestUploadSession, uploadSession]);

  async function onSubmit(data: ReturnFormInput) {
    // Validate channel source
    if (!selectedChannel) {
      toast.error('請選擇購買通路');
      return;
    }

    // Validate other channel text if "other" is selected
    if (selectedChannel === 'other' && !otherChannelText.trim()) {
      toast.error('請填寫其他購買通路');
      return;
    }

    // Validate at least one product selected
    if (selectedProducts.length === 0) {
      toast.error('請至少選擇一項退貨商品');
      return;
    }

    // Validate at least one reason selected
    if (selectedReasons.length === 0) {
      toast.error('請至少選擇一項退貨原因');
      return;
    }

    // Validate other reason text if "other" is selected
    if (selectedReasons.includes('other') && !otherReasonText.trim()) {
      toast.error('請填寫其他原因說明');
      return;
    }

    // Validate "與描述不符" detail text
    if (selectedReasons.includes('not_as_described') && !notAsDescribedText.trim()) {
      toast.error('請填寫與描述不符的詳細說明');
      return;
    }

    // Validate APEXEL issues if conditions are met
    if (shouldShowApexelIssues && selectedApexelIssues.length === 0) {
      toast.error('請選擇 APEXEL 鏡頭的具體問題');
      return;
    }

    // Validate APEXEL other issue text
    if (selectedApexelIssues.includes('apexel_other') && !apexelOtherIssueText.trim()) {
      toast.error('請填寫 APEXEL 其他問題說明');
      return;
    }

    // Validate official website return method
    if (selectedChannel === 'official') {
      if (!returnMethod) {
        toast.error('請選擇退換貨方式');
        return;
      }
      if ((returnMethod === 'refund' || returnMethod === 'credit_card_refund') && !bankName.trim()) {
        toast.error('請填寫匯款銀行');
        return;
      }
      if ((returnMethod === 'refund' || returnMethod === 'credit_card_refund') && !bankAccount.trim()) {
        toast.error('請填寫匯款帳號');
        return;
      }
    }

    // Validate at least one image successfully uploaded
    const successfulImages = images.filter((img) => img.status === 'success');
    if (successfulImages.length === 0) {
      toast.error('請至少上傳一張照片');
      return;
    }

    // Validate at least one shipping label image
    const successfulShippingLabelImages = shippingLabelImages.filter((img) => img.status === 'success');
    if (successfulShippingLabelImages.length === 0) {
      toast.error('請至少上傳一張寄件單照片');
      return;
    }

    // Check if any images are still uploading
    const uploadingImages = [...images, ...shippingLabelImages].filter((img) => img.status === 'uploading');
    if (uploadingImages.length > 0) {
      toast.error('請等待圖片上傳完成');
      return;
    }

    try {
      setIsLoading(true);

      // Get successfully uploaded images (already uploaded to Supabase)
      const successfulShippingImages = shippingLabelImages.filter((img) => img.status === 'success');

      // Combine all successfully uploaded images
      const allImagesData = [
        ...successfulImages.map((img) => ({
          publicUrl: img.publicUrl,
          storagePath: img.storagePath,
        })),
        ...successfulShippingImages.map((img) => ({
          publicUrl: img.publicUrl,
          storagePath: img.storagePath,
        })),
      ];

      let activeUploadSession: UploadSession | null = uploadSession;
      try {
        activeUploadSession = await getUploadSession();
      } catch (sessionError) {
        const message = sessionError instanceof Error ? sessionError.message : '無法驗證上傳工作階段';
        toast.error(message);
        return;
      }

      // Get selected product labels for submission
      const selectedProductLabels = selectedProducts.map(
        (id) => productOptions.find((opt) => opt.id === id)?.label || id
      );

      // Get selected reason labels for submission
      const selectedReasonLabels = selectedReasons.map(
        (id) => reasonOptions.find((opt) => opt.id === id)?.label || id
      );

      // Build combined reason text
      let combinedReason = selectedReasonLabels.join('、');
      if (selectedReasons.includes('other') && otherReasonText.trim()) {
        combinedReason += `（其他：${otherReasonText.trim()}）`;
      }
      if (selectedReasons.includes('not_as_described') && notAsDescribedText.trim()) {
        combinedReason += `（與描述不符說明：${notAsDescribedText.trim()}）`;
      }
      // Add APEXEL specific issues
      if (shouldShowApexelIssues && selectedApexelIssues.length > 0) {
        const apexelIssueLabels = selectedApexelIssues.map(
          (id) => apexelIssueOptions.find((opt) => opt.id === id)?.label || id
        );
        let apexelIssueText = apexelIssueLabels.join('、');
        if (selectedApexelIssues.includes('apexel_other') && apexelOtherIssueText.trim()) {
          apexelIssueText += `：${apexelOtherIssueText.trim()}`;
        }
        combinedReason += `【APEXEL問題：${apexelIssueText}】`;
      }

      // Build official website return method info
      let officialReturnInfo = '';
      if (selectedChannel === 'official' && returnMethod) {
        const methodLabel = returnMethodOptions.find((opt) => opt.id === returnMethod)?.label || returnMethod;
        officialReturnInfo = `【退換貨方式：${methodLabel}`;
        if (returnMethod === 'refund' || returnMethod === 'credit_card_refund') {
          officialReturnInfo += `｜匯款銀行：${bankName.trim()}｜匯款帳號：${bankAccount.trim()}`;
        }
        officialReturnInfo += '】';
      }

      // Combine product suggestion with official return info
      let combinedProductSuggestion = data.productSuggestion || '';
      if (officialReturnInfo) {
        combinedProductSuggestion = officialReturnInfo + (combinedProductSuggestion ? '\n' + combinedProductSuggestion : '');
      }

      // Determine channel source value (use other text if "other" is selected)
      const channelSourceValue = selectedChannel === 'other' ? otherChannelText.trim() : selectedChannel;

      // Submit to server
      const result = await submitCustomerReturn(
        {
          channelSource: channelSourceValue,
          accountId: data.accountId,
          orderNumber: data.orderNumber,
          ordererName: data.ordererName,
          phone: data.phone,
          returnProducts: selectedProductLabels,
          reasonCategory: selectedReasons[0], // Primary reason for analytics
          returnReason: combinedReason,
          productSuggestion: combinedProductSuggestion,
        },
        allImagesData,
        activeUploadSession
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
      setUploadSession(null);

      // Show success state
      setIsSubmitted(true);
      toast.success('退貨申請已成功送出！');

    } catch {
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
                    setUploadSession(null);
                    setSelectedChannel('');
                    setOtherChannelText('');
                    setSelectedProducts([]);
                    setSelectedReasons([]);
                    setOtherReasonText('');
                    setNotAsDescribedText('');
                    setSelectedApexelIssues([]);
                    setApexelOtherIssueText('');
                    setReturnMethod('');
                    setBankName('');
                    setBankAccount('');
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

        {/* Help Message & Tutorial Link - Simple White Version */}
        <Card className="shadow-sm border border-gray-200 mb-6 bg-white">
          <CardContent className="p-5">
            <p className="text-gray-700 text-sm mb-4">
              💡 APEXEL鏡頭遇到操作問題? 請給我們一分鐘協助您解決問題!
            </p>
            <a
              href={APEXEL_TUTORIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-gray-200 rounded-lg p-4 hover:border-teal-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📷</span>
                  <div>
                    <h3 className="text-gray-900 font-semibold">鏡頭組裝教學</h3>
                    <p className="text-gray-500 text-sm">APEXEL 手機鏡頭安裝指南</p>
                  </div>
                </div>
                <div className="text-teal-600 font-medium whitespace-nowrap">
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

                {/* Channel Source - Checkbox Selection */}
                <div className="space-y-3">
                  <FormLabel className="text-teal-700 font-bold text-base">
                    購買通路 <span className="text-red-500">*</span>
                  </FormLabel>
                  <div className="space-y-2">
                    {channelOptions.map((option) => (
                      <div key={option.id}>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`channel-${option.id}`}
                            checked={selectedChannel === option.id}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedChannel(option.id);
                                // Also update form value for validation
                                form.setValue('channelSource', option.id);
                              } else {
                                setSelectedChannel('');
                                form.setValue('channelSource', '');
                              }
                              // Clear other channel text when switching
                              if (option.id !== 'other') {
                                setOtherChannelText('');
                              }
                              // Clear return method when changing from official
                              if (option.id !== 'official') {
                                setReturnMethod('');
                                setBankName('');
                                setBankAccount('');
                              }
                            }}
                            disabled={isLoading}
                            className="border-gray-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                          />
                          <label
                            htmlFor={`channel-${option.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {option.label}
                          </label>
                        </div>
                        {/* Show text input when "其他" is selected */}
                        {option.id === 'other' && selectedChannel === 'other' && (
                          <div className="mt-2 ml-7">
                            <Input
                              placeholder="請填寫購買通路"
                              value={otherChannelText}
                              onChange={(e) => setOtherChannelText(e.target.value)}
                              disabled={isLoading}
                              className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account ID */}
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-bold text-base">
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
                      <FormLabel className="text-teal-700 font-bold text-base">
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
                      <FormLabel className="text-teal-700 font-bold text-base">
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
                      <FormLabel className="text-teal-700 font-bold text-base">
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
                  <FormLabel className="text-teal-700 font-bold text-base">
                    退貨商品 <span className="text-red-500">*</span>
                  </FormLabel>
                  <p className="text-sm text-gray-500">
                    請選擇您要退貨的商品類型（可複選）
                  </p>
                  <div className="space-y-4">
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
                          className="border-gray-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 h-5 w-5"
                        />
                        <label
                          htmlFor={option.id}
                          className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Reason - Checkbox Selection */}
                <div className="space-y-3">
                  <FormLabel className="text-teal-700 font-bold text-base">
                    退、換貨原因 <span className="text-red-500">*</span>
                  </FormLabel>
                  <p className="text-sm text-gray-500">
                    請選擇退貨原因（可複選）
                  </p>
                  <div className="space-y-4">
                    {reasonOptions.map((option) => (
                      <div key={option.id}>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`reason-${option.id}`}
                            checked={selectedReasons.includes(option.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedReasons([...selectedReasons, option.id]);
                              } else {
                                setSelectedReasons(selectedReasons.filter((r) => r !== option.id));
                                if (option.id === 'other') {
                                  setOtherReasonText('');
                                }
                                if (option.id === 'not_as_described') {
                                  setNotAsDescribedText('');
                                }
                                // Clear APEXEL issues if quality/defective is unchecked
                                if (option.id === 'quality_issue' || option.id === 'defective') {
                                  const remainingReasons = selectedReasons.filter((r) => r !== option.id);
                                  if (!remainingReasons.includes('quality_issue') && !remainingReasons.includes('defective')) {
                                    setSelectedApexelIssues([]);
                                    setApexelOtherIssueText('');
                                  }
                                }
                              }
                            }}
                            disabled={isLoading}
                            className="border-gray-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 h-5 w-5"
                          />
                          <label
                            htmlFor={`reason-${option.id}`}
                            className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {option.label}
                          </label>
                        </div>
                        {/* Show text input when "與描述不符" is selected */}
                        {option.id === 'not_as_described' && selectedReasons.includes('not_as_described') && (
                          <div className="mt-2 ml-7">
                            <Input
                              placeholder="請填寫與描述不符的詳細說明"
                              value={notAsDescribedText}
                              onChange={(e) => setNotAsDescribedText(e.target.value)}
                              disabled={isLoading}
                              className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                            />
                          </div>
                        )}
                        {/* Show text input when "其他" is selected */}
                        {option.id === 'other' && selectedReasons.includes('other') && (
                          <div className="mt-2 ml-7">
                            <Input
                              placeholder="請填寫其他原因"
                              value={otherReasonText}
                              onChange={(e) => setOtherReasonText(e.target.value)}
                              disabled={isLoading}
                              className="border-0 border-b-2 border-gray-300 rounded-none focus:border-teal-500 focus:ring-0"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* APEXEL Specific Issues - Show when APEXEL + quality_issue/defective */}
                {shouldShowApexelIssues && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <FormLabel className="text-blue-700 font-medium">
                      APEXEL 鏡頭問題 <span className="text-red-500">*</span>
                    </FormLabel>
                    <p className="text-sm text-blue-600">
                      請選擇具體的問題類型（可複選）
                    </p>
                    <div className="space-y-3">
                      {apexelIssueOptions.map((option) => (
                        <div key={option.id}>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`apexel-${option.id}`}
                              checked={selectedApexelIssues.includes(option.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedApexelIssues([...selectedApexelIssues, option.id]);
                                } else {
                                  setSelectedApexelIssues(selectedApexelIssues.filter((i) => i !== option.id));
                                  if (option.id === 'apexel_other') {
                                    setApexelOtherIssueText('');
                                  }
                                }
                              }}
                              disabled={isLoading}
                              className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <label
                              htmlFor={`apexel-${option.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {option.label}
                            </label>
                          </div>
                          {/* Show text input when "其他" is selected */}
                          {option.id === 'apexel_other' && selectedApexelIssues.includes('apexel_other') && (
                            <div className="mt-2 ml-7">
                              <Input
                                placeholder="請填寫其他問題說明"
                                value={apexelOtherIssueText}
                                onChange={(e) => setApexelOtherIssueText(e.target.value)}
                                disabled={isLoading}
                                className="border-0 border-b-2 border-blue-300 rounded-none focus:border-blue-500 focus:ring-0 bg-white"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* APEXEL Tutorial Link - Show when APEXEL + specific reasons */}
                {shouldShowApexelTutorial && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📖</span>
                        <span className="text-blue-700 font-medium">APEXEL使用教學</span>
                      </div>
                      <a
                        href={APEXEL_TUTORIAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                      >
                        查看教學 ▶
                      </a>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      建議先查看使用教學，也許能幫助您解決問題!
                    </p>
                  </div>
                )}

                {/* Official Website Return Method - Only show when channel is "official" */}
                {selectedChannel === 'official' && (
                  <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <FormLabel className="text-amber-700 font-medium text-base">
                      官網退、換貨方式 <span className="text-red-500">*</span>
                    </FormLabel>

                    {/* Return Method Selection */}
                    <div className="space-y-3">
                      <p className="text-sm text-amber-700 font-medium">一、退貨換方式</p>
                      <div className="space-y-2">
                        {returnMethodOptions.map((option) => (
                          <div key={option.id} className="flex items-center space-x-3">
                            <Checkbox
                              id={`return-method-${option.id}`}
                              checked={returnMethod === option.id}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setReturnMethod(option.id);
                                } else {
                                  setReturnMethod('');
                                }
                              }}
                              disabled={isLoading}
                              className="border-amber-400 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            />
                            <label
                              htmlFor={`return-method-${option.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bank Account Section - Show when refund or credit_card_refund is selected */}
                    {(returnMethod === 'refund' || returnMethod === 'credit_card_refund') && (
                      <div className="space-y-3 pt-3 border-t border-amber-200">
                        <p className="text-sm text-amber-700 font-medium">二、鑑賞期內商品退款流程</p>
                        <p className="text-xs text-amber-600">
                          {returnMethod === 'refund'
                            ? '退款請填寫匯款帳號，供匯款作業使用。'
                            : '信用卡刷退請提供匯款帳號，供匯款補貼運費。'}
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm text-amber-700 font-medium">
                              匯款銀行 <span className="text-red-500">*</span>
                            </label>
                            <Input
                              placeholder="例如：中國信託 (822)"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                              disabled={isLoading}
                              className="border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-amber-700 font-medium">
                              匯款帳號 <span className="text-red-500">*</span>
                            </label>
                            <Input
                              placeholder="請輸入您的銀行帳號"
                              value={bankAccount}
                              onChange={(e) => setBankAccount(e.target.value)}
                              disabled={isLoading}
                              className="border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notice for official website return */}
                    <p className="text-sm text-amber-700 mt-4 pt-3 border-t border-amber-200">
                      *後續退款流程將用官網訂單留言(Email通知)。
                    </p>
                  </div>
                )}

                {/* Product Suggestion */}
                <FormField
                  control={form.control}
                  name="productSuggestion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-teal-700 font-bold text-base">
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
                    <FormLabel className="text-teal-700 font-bold text-base">
                      上傳產品照片 <span className="text-red-500">*</span>
                    </FormLabel>
                  </div>
                  <p className="text-sm text-gray-500">
                    請上傳產品照片及外箱照片（最多 5 張）
                  </p>
                  <DirectImageUploader
                    images={images}
                    onImagesChange={setImages}
                    disabled={isLoading}
                    maxImages={5}
                    maxFileSizeMB={10}
                    folder="product-photos"
                    getUploadSession={getUploadSession}
                  />
                </div>

                {/* Image Upload Section - Shipping Label */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-teal-600" />
                    <FormLabel className="text-teal-700 font-bold text-base">
                      上傳寄件單照片 <span className="text-red-500">*</span>
                    </FormLabel>
                  </div>
                  <p className="text-sm text-gray-500">
                    請上傳寄件單照片（最多 2 張）
                  </p>
                  <DirectImageUploader
                    images={shippingLabelImages}
                    onImagesChange={setShippingLabelImages}
                    disabled={isLoading}
                    maxImages={2}
                    maxFileSizeMB={10}
                    folder="shipping-labels"
                    getUploadSession={getUploadSession}
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
