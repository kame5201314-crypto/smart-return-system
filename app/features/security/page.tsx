import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  EyeOff,
  Key,
  Lock,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '資料安全與隱私 | Smart Return',
  description:
    '每個品牌的退貨資料完全獨立隔離、客戶個資不會外洩、團隊角色分權清楚。專為台灣電商品牌設計的資料安全標準。',
};

const trustItems = [
  [
    Building2,
    '品牌資料完全分離',
    '每個品牌（每個品牌帳號）的退貨、訂單、客戶資料完全獨立，不同品牌之間互看不到。',
  ],
  [
    EyeOff,
    '客戶個資不外流',
    '客戶姓名、電話、地址只有你的團隊看得到。我們也不會把你的客戶資料用於任何其他用途或對外銷售。',
  ],
  [
    Users,
    '角色分權清楚',
    'Owner（老闆）、Admin（主管）、Staff（客服 / 倉庫）、Viewer（檢視）四種角色，各看自己該看的資料。',
  ],
  [
    Key,
    '邀請制成員管理',
    '所有新成員都需 Owner 或 Admin 邀請加入，離職人員可立即停權，操作紀錄保留可追溯。',
  ],
  [
    Lock,
    '加密儲存與傳輸',
    '密碼經加密儲存、所有頁面走 HTTPS，後台連線採權杖驗證，不會用明文密碼。',
  ],
  [
    ShieldCheck,
    '不會擅自改你的資料',
    'AI 只做文字分析，不會自動退款、不會自動回覆客戶、不會自動修改訂單，所有重要動作都由人決定。',
  ],
] as const;

const promises = [
  '我們不販售、不轉讓你的客戶資料',
  '我們不會用你的客戶資料訓練 AI 模型',
  '系統內所有敏感操作都會保留操作者、時間與動作紀錄',
  '取消服務後可請求刪除資料，30 天內處理完成',
] as const;

export default function SecurityFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="資料安全"
        title="你的退貨資料只有你看得到，客戶個資不會被我們拿去做別的事。"
        description="電商最怕資料外流。Smart Return 從第一天就把資料隔離、權限分層、操作可追溯做進系統，不是事後補的。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {trustItems.map(([Icon, title, body]) => (
            <div key={title} className="rounded-lg border border-neutral-200 p-5">
              <Icon className="size-5 text-emerald-700" />
              <h2 className="mt-4 text-base font-semibold text-neutral-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-neutral-950 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-emerald-300">我們的承諾</p>
            <h2 className="mt-2 text-2xl font-semibold">
              你的客戶資料只屬於你。
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">
              台灣電商的客戶資料外流事件不少。我們把這幾件事寫成承諾，不只是口頭說說。
            </p>
          </div>
          <div className="grid gap-3">
            {promises.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-md border border-white/10 bg-white/8 px-4 py-3 text-sm text-neutral-200"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="flex items-start gap-4">
            <UserCog className="mt-1 size-6 text-cyan-700" />
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950">
                需要更嚴格的資安與合約條件？
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Enterprise 方案可洽談導入檢核表、客製權限矩陣、資料保留政策與 SLA 條款。
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/contact">
              洽談企業方案
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
