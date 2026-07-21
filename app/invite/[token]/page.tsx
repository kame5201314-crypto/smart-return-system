import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { InviteAcceptPanel } from '@/components/saas/invite-accept-panel';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { loadInviteAcceptanceView } from '@/lib/saas/invite-acceptance-live-data';

export const metadata: Metadata = {
  title: '接受團隊邀請 | AI退貨管理系統',
  description: '接受 AI退貨管理系統 團隊邀請並加入組織。',
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadInviteAcceptanceView(token);

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Team Invite"
        title="接受團隊邀請"
        description="確認邀請資訊與登入身分，加入你的 AI退貨管理系統 組織。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {result.state === 'ready' ? (
            <InviteAcceptPanel data={result.data} token={token} />
          ) : result.state === 'gated' ? (
            <SettingsStateCard variant="gated" gated={result.gated} />
          ) : result.state === 'empty' ? (
            <SettingsStateCard variant="empty" message={result.message} />
          ) : (
            <SettingsStateCard variant="error" message={result.message} />
          )}
        </div>
      </section>
    </MarketingShell>
  );
}
