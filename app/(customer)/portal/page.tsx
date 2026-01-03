'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Package, ArrowRight } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Form validation schema
const returnFormSchema = z.object({
  accountId: z.string().min(1, '請填寫您的帳號'),
  orderNumber: z.string().min(1, '請填寫訂單編號'),
  ordererName: z.string().min(1, '請填寫訂購人姓名'),
  receiverName: z.string().optional(),
  phone: z.string().regex(/^09\d{8}$/, '請輸入有效的手機號碼'),
  channelSource: z.string().min(1, '請選擇購買通路'),
  returnReason: z.string().min(1, '請填寫退換貨原因'),
  productSuggestion: z.string().optional(),
});

type ReturnFormInput = z.infer<typeof returnFormSchema>;

export default function CustomerPortalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ReturnFormInput>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      accountId: '',
      orderNumber: '',
      ordererName: '',
      receiverName: '',
      phone: '',
      channelSource: '',
      returnReason: '',
      productSuggestion: '',
    },
  });

  async function onSubmit(data: ReturnFormInput) {
    try {
      setIsLoading(true);

      // Store form data in session storage for the apply page
      sessionStorage.setItem('returnFormData', JSON.stringify({
        ...data,
        submittedAt: new Date().toISOString(),
      }));

      toast.success('表單已送出，請繼續填寫退貨申請');

      // Redirect to detailed return application page
      router.push('/portal/apply');
    } catch {
      toast.error('送出失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">產品退、換貨表單</h1>
          <p className="text-purple-200 mt-2">請填寫以下資料以申請退換貨</p>
        </div>

        {/* Form Card */}
        <Card className="shadow-xl">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-lg">退換貨申請資料</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Channel Source */}
                <FormField
                  control={form.control}
                  name="channelSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-purple-700 font-medium">
                        購買通路 <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="請選擇購買通路" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="shopee">蝦皮</SelectItem>
                          <SelectItem value="ruten">露天</SelectItem>
                          <SelectItem value="official">官網</SelectItem>
                          <SelectItem value="momo">Momo</SelectItem>
                          <SelectItem value="pchome">PChome</SelectItem>
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
                      <FormLabel className="text-purple-700 font-medium">
                        您的帳號 (蝦皮/露天/官網帳號) <span className="text-red-500">*</span>
                      </FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
                        (官網帳號請填 E-mail 或手機號碼)
                      </p>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0"
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
                      <FormLabel className="text-purple-700 font-medium">
                        訂單編號 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0"
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
                      <FormLabel className="text-purple-700 font-medium">
                        訂購人 <span className="text-red-500">*</span>
                      </FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
                        (請填寫訂單上的名字，收件人若有不同也請一起填寫)
                      </p>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Receiver Name (Optional) */}
                <FormField
                  control={form.control}
                  name="receiverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-purple-700 font-medium">
                        收件人姓名（若與訂購人不同）
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0"
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
                      <FormLabel className="text-purple-700 font-medium">
                        您的電話 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="09xxxxxxxx"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Return Reason */}
                <FormField
                  control={form.control}
                  name="returnReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-purple-700 font-medium">
                        退、換貨原因 <span className="text-red-500">*</span>
                      </FormLabel>
                      <p className="text-sm text-gray-500 mb-2">
                        覺得產品哪個部分不適合？
                      </p>
                      <FormControl>
                        <Textarea
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0 min-h-[100px]"
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
                      <FormLabel className="text-purple-700 font-medium">
                        對產品有什麼建議？
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="您的回答"
                          className="border-0 border-b-2 border-gray-300 rounded-none focus:border-purple-500 focus:ring-0 min-h-[100px]"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-5 w-5" />
                  )}
                  送出並繼續申請退貨
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Notice */}
        <Card className="mt-6 bg-white/90">
          <CardHeader>
            <CardTitle className="text-lg text-purple-700">退貨須知</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>1. 商品需於收貨後 7 天內申請退貨</p>
            <p>2. 請準備 3-5 張照片（物流面單、商品狀況、外箱）</p>
            <p>3. 蝦皮訂單請透過蝦皮 App 申請退貨</p>
            <p>4. 退款將於驗貨完成後 7 個工作天內處理</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
