import { Inbox, ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { TeamInviteForm } from '@/components/saas/team-invite-form';
import { loadTeamSettingsView } from '@/lib/saas/settings-live-data';
import type { TeamSettingsView } from '@/lib/saas/ui-backend-contracts';

const ROLE_LABEL: Record<TeamSettingsView['members'][number]['role'], string> = {
  owner: '擁有者',
  admin: '管理員',
  staff: '作業成員',
  viewer: '檢視者',
};

const MEMBER_STATUS_LABEL: Record<TeamSettingsView['members'][number]['status'], string> = {
  active: '已加入',
  invited: '邀請中',
  disabled: '已停用',
};

const INVITE_STATUS_LABEL: Record<TeamSettingsView['invites'][number]['status'], string> = {
  pending: '待接受',
  accepted: '已接受',
  expired: '已過期',
  revoked: '已撤銷',
};

const roleRows = [
  ['擁有者', '方案、帳務、成員管理與資料安全設定。'],
  ['管理員', '退貨流程、團隊邀請、用量檢視與一般設定。'],
  ['作業成員', '處理退貨、驗貨、掃描、備註與日常作業。'],
  ['檢視者', '查看退貨與報表，不可新增、修改或匯出。'],
] as const;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function TeamContent({ data }: { data: TeamSettingsView }) {
  const activeSeats = data.members.filter((member) => member.status !== 'disabled').length;
  const seatLabel = data.seatLimit === null ? '合約' : data.seatLimit.toLocaleString('zh-TW');

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRoundCog className="size-5 text-emerald-700" />
            邀請成員
          </CardTitle>
          <CardDescription>
            已使用席次 {activeSeats} / {seatLabel}。建立邀請後，可複製邀請連結傳送給對方。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamInviteForm canInvite={data.actions.canInvite} disabledReason={data.actions.disabledReason} />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-5 text-emerald-700" />
            成員清單
          </CardTitle>
          <CardDescription>組織內所有成員及其狀態。</CardDescription>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Inbox className="size-6" aria-hidden="true" />
              尚無成員資料。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>加入時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.displayName ? `${member.displayName}（${member.email}）` : member.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL[member.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {MEMBER_STATUS_LABEL[member.status]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(member.joinedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.invites.length > 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRoundCog className="size-5 text-cyan-700" />
              邀請中
            </CardTitle>
            <CardDescription>尚未接受的邀請會在此列出。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>到期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL[invite.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {INVITE_STATUS_LABEL[invite.status]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(invite.expiresAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-700" />
            角色權限
          </CardTitle>
          <CardDescription>各角色可進行的操作範圍。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色</TableHead>
                <TableHead>可進行的操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleRows.map(([role, detail]) => (
                <TableRow key={role}>
                  <TableCell className="font-medium">{role}</TableCell>
                  <TableCell className="text-muted-foreground">{detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default async function TeamSettingsPage() {
  const result = await loadTeamSettingsView();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">團隊與角色</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理成員角色與邀請新夥伴加入。
          </p>
        </div>
      </div>

      {result.state === 'ready' ? (
        <TeamContent data={result.data} />
      ) : result.state === 'gated' ? (
        <SettingsStateCard variant="gated" gated={result.gated} />
      ) : result.state === 'empty' ? (
        <SettingsStateCard variant="empty" message={result.message} />
      ) : (
        <SettingsStateCard variant="error" message={result.message} />
      )}
    </div>
  );
}
