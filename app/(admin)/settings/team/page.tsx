import { MailPlus, ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DemoDataBanner } from '@/components/saas/demo-data-banner';

const roleRows = [
  ['Owner', '組織擁有者', '方案、帳務、成員、資料刪除與安全設定。'],
  ['Admin', '管理員', '退貨流程、團隊邀請、用量檢視與一般設定。'],
  ['Staff', '作業成員', '處理退貨、驗貨、掃描、備註與日常作業。'],
  ['Viewer', '檢視者', '查看退貨與報表，不可新增、修改或匯出。'],
] as const;

const members = [
  ['owner@brand.test', 'Owner', '已加入'],
  ['ops@brand.test', 'Admin', '已加入'],
  ['warehouse@brand.test', 'Staff', '已加入'],
  ['finance@brand.test', 'Viewer', '待邀請'],
] as const;

export default function TeamSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">團隊與角色</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stage 1 先支援 Owner / Admin / Staff / Viewer。Beta 期邀請流程仍可由平台管理員協助。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button disabled title="Stage 2 邀請流程上線後開啟">
            <MailPlus className="size-4" />
            邀請成員
          </Button>
          <p className="text-xs text-muted-foreground">Beta 期由平台管理員代為邀請。</p>
        </div>
      </div>

      <DemoDataBanner>
        <span className="font-medium">示意成員清單</span>
        ：正式資料將由 organization_members 與 organization_invites 提供。
      </DemoDataBanner>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-5 text-emerald-700" />
              成員清單
            </CardTitle>
            <CardDescription>示意資料；正式資料會從 organization_members 與 invites 讀取。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(([email, role, status]) => (
                  <TableRow key={email}>
                    <TableCell className="font-medium">{email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRoundCog className="size-5 text-cyan-700" />
              邀請限制
            </CardTitle>
            <CardDescription>先依方案席次限制，不開放無限制邀請。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Basic：3 seats</p>
            <p>Growth：10 seats</p>
            <p>Pro：30 seats</p>
            <p>Enterprise：依合約</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-700" />
            角色權限
          </CardTitle>
          <CardDescription>後端 guard 需以 role + feature flag + plan 同時判斷。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色</TableHead>
                <TableHead>定位</TableHead>
                <TableHead>權限摘要</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleRows.map(([role, scope, detail]) => (
                <TableRow key={role}>
                  <TableCell>
                    <Badge>{role}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{scope}</TableCell>
                  <TableCell className="text-muted-foreground">{detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
