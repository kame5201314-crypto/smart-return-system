'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Package, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { customerLogin } from '@/lib/actions/return.actions';
import { customerLoginSchema, type CustomerLoginInput } from '@/lib/validations/return.schema';
import { CHANNELS, ERROR_MESSAGES } from '@/config/constants';

export default function CustomerPortalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [shopeeWarning, setShopeeWarning] = useState(false);

  const form = useForm<CustomerLoginInput>({
    resolver: zodResolver(customerLoginSchema),
    defaultValues: {
      orderNumber: '',
      phone: '',
    },
  });

  async function onSubmit(data: CustomerLoginInput) {
    try {
      setIsLoading(true);
      setShopeeWarning(false);

      const result = await customerLogin(data);

      if (!result.success) {
        toast.error(result.error || ERROR_MESSAGES.GENERIC);
        return;
      }

      const session = result.data!;

      // Check if Shopee order
      if (session.channelSource === 'shopee') {
        setShopeeWarning(true);
        return;
      }

      // Store session and redirect
      sessionStorage.setItem('customerSession', JSON.stringify(session));

      if (!session.isReturnEligible) {
        toast.error(ERROR_MESSAGES.RETURN_EXPIRED);
        router.push('/portal/dashboard');
        return;
      }

      router.push('/portal/dashboard');
    } catch {
      toast.error(ERROR_MESSAGES.GENERIC);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>退貨申請</CardTitle>
          <CardDescription>
            請輸入您的訂單編號與手機號碼進行驗證
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shopeeWarning && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>蝦皮訂單</AlertTitle>
              <AlertDescription>
                蝦皮訂單請至蝦皮 App 內申請退貨。本系統僅提供官網、Momo
                等通路的退貨服務。
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="orderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>訂單編號</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="請輸入訂單編號"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>手機號碼</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="09xxxxxxxx"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                驗證並繼續
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">退貨須知</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. 商品需於收貨後 7 天內申請退貨</p>
          <p>2. 請準備 3-5 張照片（物流面單、商品狀況、外箱）</p>
          <p>3. 蝦皮訂單請透過蝦皮 App 申請退貨</p>
          <p>4. 退款將於驗貨完成後 7 個工作天內處理</p>
        </CardContent>
      </Card>
    </div>
  );
}
