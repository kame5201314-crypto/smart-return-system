'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle, Package, Upload, Camera, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploader } from '@/components/upload/image-uploader';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { IMAGE_UPLOAD_CONFIG } from '@/config/constants';
import { submitCustomerReturn } from '@/lib/actions/customer-return.actions';

interface ReturnFormData {
  accountId: string;
  orderNumber: string;
  ordererName: string;
  receiverName?: string;
  phone: string;
  channelSource: string;
  returnReason: string;
  productSuggestion?: string;
  submittedAt: string;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  type: string;
}

const channelLabels: Record<string, string> = {
  shopee: '蝦皮',
  ruten: '露天',
  official: '官網',
  momo: 'Momo',
  pchome: 'PChome',
  other: '其他',
};

// Compress image to reduce upload size (target: ~200KB)
async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function ReturnApplyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ReturnFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('returnFormData');
    if (!stored) {
      router.push('/portal');
      return;
    }

    const data = JSON.parse(stored) as ReturnFormData;
    setFormData(data);
    setLoading(false);
  }, [router]);

  async function handleSubmit() {
    // Validate images
    if (images.length < IMAGE_UPLOAD_CONFIG.MIN_REQUIRED) {
      toast.error(`請上傳至少 ${IMAGE_UPLOAD_CONFIG.MIN_REQUIRED} 張照片`);
      return;
    }

    if (images.length > IMAGE_UPLOAD_CONFIG.MAX_ALLOWED) {
      toast.error(`最多只能上傳 ${IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張照片`);
      return;
    }

    if (!formData) {
      toast.error('表單資料遺失，請重新填寫');
      return;
    }

    try {
      setSubmitting(true);

      // Compress and convert images to base64 (parallel processing)
      const imageFiles = await Promise.all(
        images.map(async (img) => {
          // Compress image to reduce size (~3MB -> ~200KB)
          const compressedBase64 = await compressImage(img.file);

          return {
            name: img.file.name.replace(/\.\w+$/, '.jpg'), // Change extension to jpg
            type: 'image/jpeg',
            base64: compressedBase64,
          };
        })
      );

      // Call server action to submit return request
      const result = await submitCustomerReturn(
        {
          channelSource: formData.channelSource,
          accountId: formData.accountId,
          orderNumber: formData.orderNumber,
          ordererName: formData.ordererName,
          receiverName: formData.receiverName,
          phone: formData.phone,
          returnReason: formData.returnReason,
          productSuggestion: formData.productSuggestion,
        },
        imageFiles
      );

      if (!result.success) {
        toast.error(result.error || '送出失敗，請稍後再試');
        return;
      }

      // Store the submission info for reference
      sessionStorage.setItem('lastSubmission', JSON.stringify({
        ...formData,
        requestNumber: result.data?.requestNumber,
        submittedAt: new Date().toISOString(),
      }));

      setSuccess(result.data?.requestNumber || '');
      toast.success('退貨申請已送出成功！');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('送出失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 flex items-center justify-center">
        <div className="animate-pulse text-white">載入中...</div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <Card className="text-center shadow-xl">
            <CardContent className="pt-12 pb-12">
              <div className="mx-auto mb-6 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-green-700">退貨申請成功！</h2>
              <p className="text-gray-600 mb-2">
                您的退貨申請編號為：
              </p>
              <p className="text-2xl font-mono font-bold text-purple-700 mb-4">{success}</p>
              <p className="text-sm text-gray-500 mb-8">
                請保留此編號以便查詢退貨進度<br />
                我們將盡快為您處理
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    sessionStorage.removeItem('returnFormData');
                    router.push('/portal');
                  }}
                >
                  返回首頁
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => router.push('/portal/track/query')}
                >
                  查詢進度
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          className="text-white hover:bg-white/20 mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回修改表單
        </Button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">退貨申請確認</h1>
          <p className="text-purple-200 mt-2">請確認資料並上傳照片</p>
        </div>

        {/* Form Data Summary */}
        <Card className="shadow-xl mb-6">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-lg">申請資料確認</CardTitle>
            <CardDescription className="text-purple-200">
              請確認以下資料是否正確
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">購買通路</p>
                <Badge variant="secondary" className="mt-1">
                  {channelLabels[formData?.channelSource || ''] || formData?.channelSource}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">訂單編號</p>
                <p className="font-medium">{formData?.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">帳號</p>
                <p className="font-medium">{formData?.accountId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">訂購人</p>
                <p className="font-medium">{formData?.ordererName}</p>
              </div>
              {formData?.receiverName && (
                <div>
                  <p className="text-sm text-gray-500">收件人</p>
                  <p className="font-medium">{formData.receiverName}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">聯絡電話</p>
                <p className="font-medium">{formData?.phone}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">退換貨原因</p>
              <p className="mt-1 text-gray-800">{formData?.returnReason}</p>
            </div>

            {formData?.productSuggestion && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">產品建議</p>
                <p className="mt-1 text-gray-800">{formData.productSuggestion}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card className="shadow-xl mb-6">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <CardTitle className="text-lg">上傳照片</CardTitle>
            </div>
            <CardDescription className="text-purple-200">
              請上傳 {IMAGE_UPLOAD_CONFIG.MIN_REQUIRED}-{IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張照片
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert className="mb-4 border-purple-200 bg-purple-50">
              <Info className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-700">
                <strong>必須上傳的照片：</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>物流面單（貨運單或包裹標籤）</li>
                  <li>商品狀況（商品正面、背面）</li>
                  <li>外箱狀況（包裝外觀）</li>
                </ul>
              </AlertDescription>
            </Alert>

            <ImageUploader
              images={images}
              onImagesChange={setImages}
              disabled={submitting}
            />

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                已上傳 {images.length} / {IMAGE_UPLOAD_CONFIG.MAX_ALLOWED} 張
              </span>
              {images.length < IMAGE_UPLOAD_CONFIG.MIN_REQUIRED && (
                <span className="text-red-500">
                  還需上傳 {IMAGE_UPLOAD_CONFIG.MIN_REQUIRED - images.length} 張
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          className="w-full bg-white text-purple-700 hover:bg-gray-100 py-6 text-lg font-medium shadow-lg"
          disabled={submitting || images.length < IMAGE_UPLOAD_CONFIG.MIN_REQUIRED}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              送出中...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              確認送出退貨申請
            </>
          )}
        </Button>

        {/* Notice */}
        <p className="text-center text-purple-200 text-sm mt-4">
          送出後，我們將盡快審核您的申請
        </p>
      </div>
    </div>
  );
}
