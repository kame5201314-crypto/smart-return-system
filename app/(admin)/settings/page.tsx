import Link from 'next/link';
import {
  ArrowRight,
  CreditCard,
  Database,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/saas/page-header';
import { getOrgContext } from '@/lib/saas/org-context';

type SettingCard = {
  href: string;
  title: string;
  description: string;
  icon: typeof CreditCard;
};

const coreSettingCards: SettingCard[] = [
  {
    href: '/settings/billing',
    title: '帳務與訂閱',
    description: '查看目前方案、試用狀態與使用期限。',
    icon: CreditCard,
  },
];

const backupCard: SettingCard = {
  href: '/settings/backup',
  title: '資料與備份',
  description: '匯出退貨資料備份，確保營運資料的安全與可追溯。',
  icon: Database,
};

async function loadSettingsHubCards(): Promise<SettingCard[]> {
  try {
    const context = await getOrgContext();
    const cards = [...coreSettingCards];

    if (context.role === 'owner' || context.role === 'admin') {
      cards.push(backupCard);
    }

    return cards;
  } catch {
    return coreSettingCards;
  }
}

export default async function SettingsPage() {
  const settingCards = await loadSettingsHubCards();

  return (
    <div className="space-y-6">
      <PageHeader
        title="設定"
        description="管理你的方案與資料。"
        actions={
          <Button asChild variant="outline">
            <Link href="/pricing" target="_blank">
              查看方案
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {settingCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.href} className="rounded-lg">
              <CardHeader className="gap-4">
                <span className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <Icon className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href={item.href}>
                    開啟
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
