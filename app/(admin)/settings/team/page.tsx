import { ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/saas/page-header';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { TeamInviteForm } from '@/components/saas/team-invite-form';
import { TeamInvitesTable } from '@/components/saas/team-invites-table';
import { TeamMembersTable } from '@/components/saas/team-members-table';
import { loadTeamSettingsView } from '@/lib/saas/settings-live-data';
import type { TeamSettingsView } from '@/lib/saas/ui-backend-contracts';

const roleRows = [
  ['擁有者', '方案、帳務、成員管理與資料安全設定。'],
  ['管理員', '退貨流程、團隊邀請、用量檢視與一般設定。'],
  ['作業成員', '處理退貨、驗貨、掃描、備註與日常作業。'],
  ['檢視者', '查看退貨與報表，不可新增、修改或匯出。'],
] as const;

function TeamContent({ data }: { data: TeamSettingsView }) {
  // 席次用量＝未停用成員 ＋ 待接受邀請，與 canInvite 的限額判斷（resolveSaaSTeamSeatUsage）一致。
  const usedSeats =
    data.members.filter((member) => member.status !== 'disabled').length +
    data.invites.filter((invite) => invite.status === 'pending').length;
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
            已使用席次 {usedSeats} / {seatLabel}（含待接受邀請）。建立邀請後，可複製邀請連結傳送給對方。
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
          <CardDescription>管理組織成員的角色與存取權限。</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersTable members={data.members} />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRoundCog className="size-5 text-cyan-700" />
            邀請紀錄
          </CardTitle>
          <CardDescription>管理尚未接受的邀請：撤銷或重新產生邀請連結。</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamInvitesTable invites={data.invites} />
        </CardContent>
      </Card>

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
      <PageHeader
        title="團隊與角色"
        description="管理成員角色與邀請新夥伴加入。"
      />

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
