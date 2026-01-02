'use client';

import { useState } from 'react';
import { Save, Settings, Bell, Shield, Database, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

import { RETURN_POLICY, IMAGE_UPLOAD_CONFIG } from '@/config/constants';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  // Return Policy Settings
  const [returnDeadline, setReturnDeadline] = useState(
    RETURN_POLICY.APPLICATION_DEADLINE_DAYS.toString()
  );
  const [inspectionDeadline, setInspectionDeadline] = useState(
    RETURN_POLICY.INSPECTION_DEADLINE_DAYS.toString()
  );
  const [refundDeadline, setRefundDeadline] = useState(
    RETURN_POLICY.REFUND_DEADLINE_DAYS.toString()
  );

  // Image Settings
  const [minImages, setMinImages] = useState(IMAGE_UPLOAD_CONFIG.MIN_REQUIRED.toString());
  const [maxImages, setMaxImages] = useState(IMAGE_UPLOAD_CONFIG.MAX_ALLOWED.toString());
  const [maxFileSize, setMaxFileSize] = useState(IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB.toString());

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [notifyOnNewReturn, setNotifyOnNewReturn] = useState(true);
  const [notifyOnAbnormal, setNotifyOnAbnormal] = useState(true);

  // Company Settings
  const [companyName, setCompanyName] = useState('智慧退貨管理系統');
  const [supportEmail, setSupportEmail] = useState('support@example.com');
  const [supportPhone, setSupportPhone] = useState('02-1234-5678');
  const [returnAddress, setReturnAddress] = useState('台北市信義區信義路五段7號');

  const handleSave = async () => {
    setSaving(true);

    // Simulate saving
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast.success('設定已儲存');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">系統設定</h1>
          <p className="text-muted-foreground">管理系統參數與通知設定</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '儲存中...' : '儲存設定'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            一般設定
          </TabsTrigger>
          <TabsTrigger value="policy">
            <Shield className="w-4 h-4 mr-2" />
            退貨政策
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            通知設定
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Database className="w-4 h-4 mr-2" />
            進階設定
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>公司資訊</CardTitle>
              <CardDescription>設定公司基本資訊與聯絡方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">公司名稱</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportPhone">客服電話</Label>
                  <Input
                    id="supportPhone"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supportEmail">客服信箱</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="returnAddress">退貨地址</Label>
                <Textarea
                  id="returnAddress"
                  value={returnAddress}
                  onChange={(e) => setReturnAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Settings */}
        <TabsContent value="policy">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>退貨期限設定</CardTitle>
                <CardDescription>設定各階段的處理期限</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="returnDeadline">退貨申請期限（天）</Label>
                    <Select value={returnDeadline} onValueChange={setReturnDeadline}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 天</SelectItem>
                        <SelectItem value="7">7 天</SelectItem>
                        <SelectItem value="10">10 天</SelectItem>
                        <SelectItem value="14">14 天</SelectItem>
                        <SelectItem value="30">30 天</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      客戶收貨後可申請退貨的天數
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inspectionDeadline">驗貨期限（天）</Label>
                    <Select value={inspectionDeadline} onValueChange={setInspectionDeadline}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 天</SelectItem>
                        <SelectItem value="2">2 天</SelectItem>
                        <SelectItem value="3">3 天</SelectItem>
                        <SelectItem value="5">5 天</SelectItem>
                        <SelectItem value="7">7 天</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      收到退貨後完成驗貨的天數
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="refundDeadline">退款期限（天）</Label>
                    <Select value={refundDeadline} onValueChange={setRefundDeadline}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 天</SelectItem>
                        <SelectItem value="5">5 天</SelectItem>
                        <SelectItem value="7">7 天</SelectItem>
                        <SelectItem value="14">14 天</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      驗貨通過後完成退款的天數
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>圖片上傳設定</CardTitle>
                <CardDescription>設定退貨申請的圖片要求</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="minImages">最少上傳張數</Label>
                    <Select value={minImages} onValueChange={setMinImages}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 張</SelectItem>
                        <SelectItem value="2">2 張</SelectItem>
                        <SelectItem value="3">3 張</SelectItem>
                        <SelectItem value="4">4 張</SelectItem>
                        <SelectItem value="5">5 張</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxImages">最多上傳張數</Label>
                    <Select value={maxImages} onValueChange={setMaxImages}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 張</SelectItem>
                        <SelectItem value="5">5 張</SelectItem>
                        <SelectItem value="8">8 張</SelectItem>
                        <SelectItem value="10">10 張</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">單檔大小限制</Label>
                    <Select value={maxFileSize} onValueChange={setMaxFileSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 MB</SelectItem>
                        <SelectItem value="10">10 MB</SelectItem>
                        <SelectItem value="15">15 MB</SelectItem>
                        <SelectItem value="20">20 MB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>通知設定</CardTitle>
              <CardDescription>設定系統通知方式與時機</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">通知方式</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email 通知</Label>
                      <p className="text-sm text-muted-foreground">
                        透過電子郵件接收通知
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>簡訊通知</Label>
                      <p className="text-sm text-muted-foreground">
                        透過手機簡訊接收通知
                      </p>
                    </div>
                    <Switch
                      checked={smsNotifications}
                      onCheckedChange={setSmsNotifications}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">通知事件</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>新退貨申請</Label>
                      <p className="text-sm text-muted-foreground">
                        收到新的退貨申請時通知
                      </p>
                    </div>
                    <Switch
                      checked={notifyOnNewReturn}
                      onCheckedChange={setNotifyOnNewReturn}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>異常/爭議案件</Label>
                      <p className="text-sm text-muted-foreground">
                        案件進入異常或爭議狀態時通知
                      </p>
                    </div>
                    <Switch
                      checked={notifyOnAbnormal}
                      onCheckedChange={setNotifyOnAbnormal}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API 設定</CardTitle>
                <CardDescription>管理外部服務連接</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <Input type="password" placeholder="sk-..." disabled />
                  <p className="text-xs text-muted-foreground">
                    用於 AI 分析功能，請在環境變數中設定
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Supabase URL</Label>
                  <Input type="text" placeholder="https://..." disabled />
                  <p className="text-xs text-muted-foreground">
                    Supabase 專案 URL，請在環境變數中設定
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>資料管理</CardTitle>
                <CardDescription>匯出與備份資料</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">匯出所有退貨資料</p>
                    <p className="text-sm text-muted-foreground">
                      下載 Excel 格式的完整退貨記錄
                    </p>
                  </div>
                  <Button variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    匯出
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">匯出 AI 分析報告</p>
                    <p className="text-sm text-muted-foreground">
                      下載所有 AI 生成的分析報告
                    </p>
                  </div>
                  <Button variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    匯出
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
