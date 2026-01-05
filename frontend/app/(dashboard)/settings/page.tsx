"use client";

import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderSync,
  Key,
  Bell,
  Users,
  Settings2,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col">
      <Header
        title="系統設定"
        description="管理系統配置、API 金鑰與通知設定"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">
              <Settings2 className="mr-2 h-4 w-4" />
              一般設定
            </TabsTrigger>
            <TabsTrigger value="cloud">
              <FolderSync className="mr-2 h-4 w-4" />
              雲端連結
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="mr-2 h-4 w-4" />
              API 金鑰
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              通知設定
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="mr-2 h-4 w-4" />
              團隊管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>一般設定</CardTitle>
                <CardDescription>管理基本系統配置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>組織名稱</Label>
                    <Input defaultValue="我的公司" />
                  </div>
                  <div className="space-y-2">
                    <Label>時區</Label>
                    <Select defaultValue="asia-taipei">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asia-taipei">Asia/Taipei (UTC+8)</SelectItem>
                        <SelectItem value="asia-tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">AI 檢查設定</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>信心度門檻 (自動通過)</Label>
                      <Input type="number" defaultValue="90" />
                      <p className="text-xs text-muted-foreground">
                        AI 信心度高於此值的素材將自動標記為通過
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>批次處理數量</Label>
                      <Input type="number" defaultValue="10" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    儲存設定
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cloud">
            <Card>
              <CardHeader>
                <CardTitle>雲端連結</CardTitle>
                <CardDescription>管理 Google Drive / Dropbox 連結</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <FolderSync className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Google Drive</p>
                        <p className="text-sm text-muted-foreground">尚未連結</p>
                      </div>
                    </div>
                    <Button>連結帳號</Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <FolderSync className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Dropbox</p>
                        <p className="text-sm text-muted-foreground">尚未連結</p>
                      </div>
                    </div>
                    <Button variant="outline">連結帳號</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">同步設定</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">自動同步</p>
                      <p className="text-sm text-muted-foreground">
                        定時自動掃描雲端資料夾中的新檔案
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div className="space-y-2">
                    <Label>同步間隔 (分鐘)</Label>
                    <Input type="number" defaultValue="30" className="w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API 金鑰</CardTitle>
                <CardDescription>管理外部服務的 API 金鑰</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <Input type="password" placeholder="sk-..." />
                  <p className="text-xs text-muted-foreground">
                    用於 GPT-4o Vision 圖片分析
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Google Client ID</Label>
                  <Input placeholder="輸入 Google Client ID" />
                </div>
                <div className="space-y-2">
                  <Label>Google Client Secret</Label>
                  <Input type="password" placeholder="輸入 Google Client Secret" />
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    儲存金鑰
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>通知設定</CardTitle>
                <CardDescription>管理系統通知與警報</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">新素材通知</p>
                    <p className="text-sm text-muted-foreground">
                      當有新素材上傳時發送通知
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">錯誤警報</p>
                    <p className="text-sm text-muted-foreground">
                      當 AI 檢測到嚴重錯誤時發送警報
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">侵權警報</p>
                    <p className="text-sm text-muted-foreground">
                      當偵測到疑似侵權商品時發送警報
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">每日摘要</p>
                    <p className="text-sm text-muted-foreground">
                      每天發送 QC 效率與績效摘要
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>團隊管理</CardTitle>
                <CardDescription>管理團隊成員與權限</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">團隊管理功能即將推出...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
