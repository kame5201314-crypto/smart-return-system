import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveSaaSPublicSignupState } from '@/lib/saas/public-signup';

export const metadata: Metadata = {
  title: '申請 14 天免費試用 | Smart Return',
  description:
    '申請 Smart Return Beta 試用，14 天免費、不需信用卡。我們會在 1 個工作天內回覆，安排 30 分鐘 Demo 並協助匯入第一批退貨資料。',
};

const applicationFields = [
  '品牌名稱',
  '聯絡人姓名',
  'Email / LINE',
  '主要銷售平台（蝦皮 / 官網 / momo / 其他）',
  '每月約幾筆退貨',
  '目前最大的退貨痛點',
] as const;

const onboardingSteps = [
  [
    CalendarClock,
    '送出申請',
    '填寫上述資訊送出。我們會在 1 個工作天內回覆，沒有自動產生帳號的步驟。',
  ],
  [
    MessageSquareWarning,
    '30 分鐘 Demo',
    '一起看你目前的退貨流程，確認 Smart Return 是否真的能解決你的問題。',
  ],
  [
    UserRoundPlus,
    '開通帳號',
    '建立品牌帳號、Owner 與團隊邀請。Beta 期一切由我們手動協助。',
  ],
  [
    Sparkles,
    '匯入第一批退貨資料',
    '協助匯入你現有的退貨資料（Excel / 蝦皮匯出）。第一週內進入日常使用。',
  ],
] as const;

const reassurances = [
  [BadgeCheck, '不需信用卡', '14 天試用完全不綁卡。試用結束不會自動扣款。'],
  [Clock3, '隨時取消', '試用期內或付費後皆可隨時停用，不綁約。'],
  [ShieldCheck, '資料獨立隔離', '你的退貨與客戶資料只屬於你，不會跟其他品牌混在一起。'],
  [Sparkles, 'Beta 限 5 家免費導入', '前 5 家品牌享免費協助匯入第一批退貨資料，現在還有名額。'],
] as const;

export default function SignupPage() {
  const signupState = resolveSaaSPublicSignupState();
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@smart-return.tw';
  const subject = encodeURIComponent('Smart Return Beta 試用申請');
  const body = encodeURIComponent(
    [
      '您好，想申請 Smart Return Beta 試用：',
      '',
      '・品牌名稱：',
      '・聯絡人：',
      '・Email / LINE：',
      '・主要銷售平台：',
      '・每月退貨筆數：',
      '・目前最大痛點：',
      '',
      '謝謝！',
    ].join('\n')
  );
  const mailHref = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  const primaryHref = signupState.isPublicSignupEnabled ? mailHref : mailHref;

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="申請試用"
        title="申請 14 天免費試用 + Beta 期免費協助導入。"
        description="不需信用卡。送出申請後我們會在 1 個工作天內回覆，安排 30 分鐘 Demo 並協助你匯入第一批退貨資料。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          {/* Application card */}
          <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-6">
            <div className="flex items-center justify-between gap-3">
              <UserRoundPlus className="size-6 text-emerald-700" />
              <Badge className="bg-amber-500 hover:bg-amber-500">{signupState.statusLabel}</Badge>
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">
              {signupState.headline}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">{signupState.description}</p>

            <div className="mt-6 rounded-md border border-emerald-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">申請只要這 6 個資訊：</div>
              <ul className="mt-3 space-y-2">
                {applicationFields.map((field) => (
                  <li
                    key={field}
                    className="flex items-start gap-2 text-sm leading-6 text-neutral-700"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {field}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="min-h-11 bg-emerald-700 hover:bg-emerald-800">
                <Link href={primaryHref}>
                  <Mail className="size-4" />
                  寄信申請（範本已帶好）
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/contact">改用其他方式聯絡</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-neutral-600">
              寄到：{contactEmail} · 1 個工作天內回覆
            </p>
          </div>

          {/* Onboarding steps */}
          <div className="grid gap-4">
            <div className="mb-2">
              <p className="text-sm font-semibold text-emerald-700">送出申請後會發生什麼</p>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950">
                清楚告訴你接下來 4 步。
              </h3>
            </div>
            {onboardingSteps.map(([Icon, title, body], index) => (
              <div
                key={title}
                className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-lg border border-neutral-200 p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-emerald-700" />
                    <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reassurances */}
      <section className="bg-neutral-50 py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {reassurances.map(([Icon, title, body]) => (
            <div key={title} className="rounded-lg border border-neutral-200 bg-white p-5">
              <Icon className="size-5 text-emerald-700" />
              <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-neutral-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-emerald-700" />
            <span>申請與帳號開通皆保留完整操作紀錄，可追溯。</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-700" />
            <span>AI 額度依方案設定有上限，不會出現意外大額扣款。</span>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
