# AI 退貨系統 商業版 SaaS 產品規格

日期：2026-05-20
版本：v2（對齊 MVP-first 紀律）
狀態：Draft（Google trial 已上線；付費／Email／Phone rollout 待定案）
分支：`develop-saas`
適用：SaaS Vercel Project + SaaS Supabase Project

本規格是訂閱制商業版的「網站功能、流程、資料、金流、權限」藍圖。
方案、旗標、DB foundation 已在 [`lib/config/saas-plans.ts`](../lib/config/saas-plans.ts)、[`lib/config/feature-flags.ts`](../lib/config/feature-flags.ts)、[`supabase/migrations/023_saas_commercial_foundation.sql`](../supabase/migrations/023_saas_commercial_foundation.sql)
落地，這份文件補上產品語意、流程、頁面、狀態機。

## v2 對齊 MVP-first 的決策

- **Beta 期不接金流**。Google 三天試用可自助建立；非 Google／付費帳號仍由
  owner 人工控管。Stage 2 才接綠界，Stage 5 才接 Stripe；TapPay 短期不接。
- **角色四層**：Owner / Admin / Staff / Viewer（取代 023 的 owner/admin/member），由 `024_extend_member_roles.sql` 擴充 CHECK。
- **Trial**：人工開通 Beta 可維持 owner 管理的 `trialing`；Google 自助試用已是
  3 天，且只允許一次成功的 real AI 分析。
- **MVP 不做**：AI Pack 加購、升降級 proration、退貨筆數超額計費、API key 管理 UI。延後到 Stage 4+。
- **退貨筆數軟限制**：80% 黃條、100% 紅條，連續 2 個月超量才建議升級；不自動加收、不擋作業。
- **AI 額度硬上限**：命中相同 fingerprint 快取不扣額度；未命中且額度用完時阻擋 AI 分析。
- **退費政策量化**：首次付款後 7 天內，且 AI <= 20%、退貨單 <= 5%、未匯出、未邀請成員，才可申請人工審核退費。
- **狀態機寬限**：past_due → 7 天 → suspended → 30 天 → cancelled（§8）。
- **service_role 只能在 server route handler 使用**，client / server component 一律 anon key + RLS。
- **報表匯出**：入門版限 CSV 單檔 / 月 5 次、成長版以上不限（軟性提示，避免擋作業）。

里程碑 §15 已重排為 Stage 1（封閉 Beta）→ Stage 2（付費 Beta）→ Stage 3（正式上線）三大段，對齊外部規格的階段語意。

---

## 1. 商業模式總結

- 每月固定費用、依方案分兩個公開方案（入門版 / 成長版）與大量需求洽談。
- 計費幣別：TWD。
- 計費週期：每月，自動續訂。
- 試用期：新註冊組織 3 天 trial，期間功能完整可用、不需信用卡。
- 主金流（台灣）：ECPay 定期定額 → 信用卡定期授權；含電子發票。
- 國際備案：Stripe Subscription（先以 feature flag 關閉，第二階段才開放）。
- 行動支付備案：TapPay（同上）。
- Legacy `ENABLE_PUBLIC_SIGNUP` 申請／provisioning 路徑預設關閉；Google
  自助三天試用由獨立旗標控制且已啟用。Email/Phone 與付費公開 rollout
  仍需 owner 逐項授權。

---

## 2. 方案結構（與程式碼一致）

| 方案 | 月費 (TWD) | 帳號數上限 | 月處理退貨筆數 | AI 退貨分析/月 | 進階分析 | API | Multi-tenant Admin | 客服 SLA |
|---|---:|---:|---:|---:|---|---|---|---|
| 入門版 (`basic`) | 399 | 3 | 300 | 10 | — | — | — | Email |
| 成長版 (`growth`) | 699 | 5 | 800 | 25 | ✓ | — | — | Email、優先回覆 |
| 大量需求 (`enterprise`) | 報價 | 合約 | 合約 | 合約 | ✓ | ✓ | ✓ | SLA 合約 |

額外差異：

- 退貨筆數是軟限制：不擋新增退貨、不擋掃描、不擋匯出；只提示升級。
- 退貨量達 80% 顯示黃條，達 100% 顯示紅條。
- 連續 2 個月超量才在月結後寄信給 Owner 建議升級。
- AI 分析是硬上限：超出 `aiMonthlyLimit` 直接阻擋 + 提示升級方案。
- AI Pack 加購延到 Stage 4+，MVP 不實作。
- 資料保留：入門版 / 成長版 12 個月，大量需求依合約定義。

> AI 額度與帳號數採硬上限，退貨筆數採軟超量（避免擋住倉庫工作）。

---

## 3. 角色與權限

| 角色 | 範圍 | 主要能力 |
|---|---|---|
| Owner | 一個 org 一位 | 訂閱、付款、刪除組織、邀請所有成員 |
| Admin | 多位 | 設定、邀請 staff/viewer、處理退貨、看分析、看用量、報表 |
| Staff | 多位 | 處理退貨、掃描入庫、檢查、不可看帳務 |
| Viewer | 多位 | 只讀報表與分析，不可改任何資料（Stage 3 開放） |
| Platform Admin（內部） | 跨 org | 平台側客服、Beta 開通、強制變更方案，仰賴 `multi_tenant_admin` |

> 023 migration 的 CHECK 是 `('owner','admin','member')`，需以 `024_extend_member_roles.sql` 擴充為 `('owner','admin','staff','viewer')`，並把既有 `member` 資料一次性 update 為 `staff`。

權限解析三層（前後端皆套）：

```
最終可用功能 =
  (plan 是否包含此能力)
  AND (feature flag 是否打開)
  AND (使用者 org role 是否被授權)
```

任何 server action / route handler 都必須走統一 guard：
1. 解析使用者 → `auth.uid()`。
2. 解析 org → `organization_members.org_id`。
3. 解析 plan → `organizations.plan`。
4. 解析旗標 → `organizations.feature_flags` 合併 env 預設。
5. 通過才繼續，否則 401 / 403 / 402（402 用於額度爆）。

---

## 4. 公開網站（未登入區）

| Route | 用途 | 主要區塊 |
|---|---|---|
| `/` | 行銷首頁（landing） | hero、痛點、產品三大模組、客戶案例、CTA |
| `/pricing` | 方案比較 | 兩個公開方案 + 大量需求洽談 + FAQ |
| `/features/returns` | 退貨模組 | 蝦皮匯入、掃描、AI 分析 demo |
| `/features/ai` | AI 模組 | 文字 AI 退貨原因分群、報告示意 |
| `/features/security` | 資安與資料 | 多租戶 RLS、備份、保留 |
| `/contact` | 聯絡（大量需求報價） | 表單 → email + Slack |
| `/legal/terms` | 服務條款 | 必備 |
| `/legal/privacy` | 隱私權政策 | 必備 |
| `/legal/refund` | 退費政策 | 7 天內人工審核退費條件 |
| `/login` | 商家登入 | Email/Phone + password；Google OAuth 後端可保留，但公開入口預設由 `ENABLE_GOOGLE_AUTH_UI=false` 隱藏；明確的 `註冊新帳號` 入口會保留方案；平台 `/internal` 使用同頁但不顯示商家復原或註冊入口 |
| `/forgot-password` | 帳號復原（旗標控管） | Email/Phone 6 位數 OTP + CAPTCHA；泛化寄送回應 |
| `/reset-password` | 設定新密碼（受保護） | 需新 recovery session + 短效 signed HttpOnly proof |
| `/signup` | 註冊（旗標控管） | 固定顯示單一手機／信箱＋密碼表單；不顯示 Google、Beta、準備中或人工申請區塊；只有 readiness 完整的 channel 才會進入 CAPTCHA、寄碼、OTP 與建帳流程 |
| `/invite/[token]` | 受邀加入 | 接受邀請、建立帳號 |

註：landing 與 legal 三頁是必要法律與信任素材，沒有就無法正式開放公開註冊。

---

## 5. 註冊與試用流程

### 5.1 Google 三天自助試用（Production 已完成）

```
既有直接入口 → Google OAuth → verified Google identity
  → /signup/complete 確認品牌與方案
  → service-role RPC 建立唯一 org / owner membership / 3-day subscription
  → 試用 real AI 僅一次；到期 cron 只處理 self-service claim
  → 到期後保留讀取、禁止新增/匯入/匯出/AI
```

`dd27745` 另在 `/login` 增加保留方案的「註冊新帳號」入口；此入口尚待另行
授權部署。公開 `/signup` 現在只呈現 Email／Phone 表單；Google OAuth 後端與
既有 Google 身分仍保留，但公開入口由 `ENABLE_GOOGLE_AUTH_UI` 隱藏。

Migrations `040`–`043` 已套用到 SaaS project，禁止重跑。Google rollout
不依賴 Billing 或 Email provider。

### 5.2 Email／Phone 驗證碼註冊（Repository 完成、尚未啟用）

```
Email 或台灣手機 + password + terms + CAPTCHA
  → 6-digit signup OTP
  → confirmed identity
  → migration 044 的 provider-neutral RPC 建立同一種 3-day trial
```

兩個 channel 使用獨立 disabled-by-default flags。Migration `044` 尚未套用；
Custom SMTP、SMS provider、CAPTCHA/env 與 Production deploy 尚未完成。
第一步畫面固定使用同一個 `手機／信箱` 欄位，不顯示 rollout 提示或人工申請表；
只有選定 channel readiness 通過後才會載入 CAPTCHA 並呼叫 Supabase Auth。

### 5.3 Google 以外的人工 Beta 開通（`public_signup` 關閉，預設）

```
訪客
  → /contact 留資料
  → Platform Admin 在後台手動建立 org
  → 系統寄邀請 email + magic link
  → 使用者點連結 → 設定密碼 → /app/onboarding/welcome
```

### 5.4 Onboarding 精靈（首次登入）

`/app/onboarding/[step]`

```
step 1  歡迎 + 介紹 5 分鐘流程
step 2  基本資料（負責人、產業、平均退貨量級）
step 3  匯入第一份蝦皮退貨 CSV（可跳過）
step 4  邀請第一位成員（可跳過）
step 5  完成 → /app/dashboard，並標記 organizations.onboarding_completed_at
```

跳過的步驟不阻擋使用，但 dashboard 會顯示「3 件任務待完成」卡片。

---

## 6. 主應用（登入後）路由

App router group `(app)` 取代既有 `(admin)`，多租戶版本。

| Route | 用途 | 對應原檔 |
|---|---|---|
| `/app/dashboard` | 概覽 | `app/(admin)/dashboard/page.tsx` |
| `/app/returns` | 退貨列表 | `app/(admin)/returns/page.tsx` |
| `/app/returns/[id]` | 退貨明細 | 既有 |
| `/app/shopee-returns` | 蝦皮列表 | 既有 |
| `/app/shopee-returns/scan` | 掃描 | 既有 |
| `/app/pickup` | 集貨 | 既有 |
| `/app/orders` | 訂單 | 既有 |
| `/app/logistics` | 物流 | 既有 |
| `/app/analytics` | 分析（基本） | 既有 |
| `/app/analytics/ai-report` | AI 報告 | 既有 |
| `/app/analytics/advanced` | 進階分析（成長版以上） | 新增，受 `advanced_analytics` 旗標 |
| `/app/portal` | 給客戶用的對外連結（C 端） | 既有 |
| **新增（商業版專屬）** | | |
| `/app/settings/organization` | 組織資訊 | 新 |
| `/app/settings/team` | 成員管理 | 新 |
| `/app/settings/billing` | 訂閱與付款 | 新 |
| `/app/settings/billing/invoices` | 發票歷史 | 新 |
| `/app/settings/usage` | AI 用量 + 升級提示 | 新 |
| `/app/settings/api` | API key（大量需求，Stage 4+） | 新，MVP 不開 |
| `/app/settings/notifications` | 通知偏好 | 新 |
| `/app/settings/security` | 登入紀錄、雙因子 | 新 |
| **平台內部** | 受 `multi_tenant_admin` 旗標 | |
| `/internal/orgs` | 平台 admin 看所有 org | 新 |
| `/internal/orgs/[id]` | 單一 org 詳情、強制變更方案 | 新 |
| `/internal/billing/events` | 金流 webhook 事件記錄 | 新 |

舊 `(admin)` 路由保留為相容導向 30 天，之後移除。

### 6.1 平台 Admin 營運能力地圖

平台 admin 的定位是看「租戶營運狀況」，不是看客戶的退貨明細。這個邊界必須保留：平台方可以看 org、方案、狀態、用量、帳務事件與 audit log，但不得跨租戶讀取訂單、消費者個資、退貨原因原文或圖片。

目前封閉 Beta 可接受的最小能力：

| 能力 | 狀態 | 判斷 |
|---|---|---|
| 手動建立 Beta org | 已落地 | 適合 1-5 個 Beta 客戶手動開通 |
| 租戶清單與方案狀態 | 已落地 | 可確認 plan / status / owner / seats |
| 當月退貨與 AI 用量 | 已落地 | 可做基本額度與成本觀察 |
| 單一租戶 detail | 已落地 | 可查成員、旗標、帳務欄位、audit log |
| MRR / trial pipeline / at-risk summary | Stage 2 前必備 | 營運者需要快速知道收入、試用轉付費潛力與流失風險 |
| billing 寫入工具 | Stage 2 前必備 | 付費後必須能手動補繳、停用、恢復、退費，且全數寫 audit log |
| past_due / AI 100% / 長期無登入警示 | Stage 2 前必備 | 需要主動 surface，不應靠人工巡清單 |
| trial → active 漏斗 | Stage 3 前必備 | 公開註冊後判斷產品與 onboarding 是否成立 |
| 平台公告與 email 群發 | Stage 3 前必備 | 用於額度、政策、維護與事故通知 |
| 多 platform admin 子角色 | Stage 3 前必備 | 客服、帳務、Owner 權限要分開，避免過度授權 |
| cron / webhook / billing reconciliation | 100+ 客戶前必備 | 規模化後需要對帳、監控與失敗重試 |

Stage 判斷：

| 階段 | 客戶數 | 平台 admin 是否足夠 |
|---|---:|---|
| 封閉 Beta | 1-5 | 勉強足夠，允許人工補洞 |
| 付費 Beta | 5-20 | 不足，必須先補 MRR、at-risk 與 billing 寫入 |
| 公開上線 | 20-100 | 不足，必須補漏斗、通知、分權與客戶健康度 |
| 規模化 | 100+ | 不足，必須補 cron/webhook 監控、計費對帳、客服 ticket 整合 |

付費 Beta 前最低實作順序：

1. Read-only 營運 summary：estimated active MRR、trial pipeline、at-risk org、AI 100% org。
2. At-risk rules：`past_due`、`suspended`、AI 100%、退貨量 100%、席次滿額、80% 用量預警。
3. Billing 寫入 RPC：手動標記補繳、停用、恢復、退款，所有變更需寫 `audit_logs`。
4. Billing event detail 與 retry SOP：先保留人工重送，等 webhook idempotency 與 provider sandbox 全綠再開 UI。
5. Trial conversion view：trial 即將到期、trial 已過期、已升級 active、未完成 onboarding。

> 2026-05-25 已先落地 read-only 營運 summary 與客戶健康度；billing 寫入工具仍屬 Stage 2 工作，未在封閉 Beta 直接開啟。

---

## 7. 計費流程

### 7.1 啟用付費（trial 結束或 Owner 主動升級）

```
/app/settings/billing 點 [升級到成長版]
  → 顯示方案、月費、首月起算日
  → 建立 ECPay 定期定額授權 session
      provider=ecpay
      amount=699
      period=Month
      frequency=1
      execTimes=99
  → 跳轉 ECPay 授權頁
  → 授權成功
      ECPay 回呼 webhook (PeriodReturnURL)
      建立 billing_events: type=subscription.authorized
      更新 subscriptions: status=active, provider=ecpay, provider_customer_id=...,
        current_period_start=now, current_period_end=now+1 month
      更新 organizations: status=active, plan=growth
  → 顯示成功頁 + 寄電子發票（透過 ECPay 發票 API）
```

### 7.2 每月扣款（自動）

```
ECPay 每月扣款日自動扣款
  → 成功
      webhook: subscription.invoice_paid
      延長 subscriptions.current_period_end += 1 month
      寫 billing_events
      開立電子發票（B2C 二聯 / B2B 三聯）
      寄發票通知 email
  → 失敗
      webhook: subscription.invoice_failed
      subscriptions.status = past_due
      organizations.status = past_due
      七天寬限期：仍可登入、看資料、不能新增退貨；AI 全部關閉
      第 4、7 天寄繳費提醒
      第 8 天 → suspended
          只能看資料、不能編輯
      第 30 天 → cancelled（除非 Owner 重新付款）
```

### 7.3 升降級

| 動作 | 生效時間 | 計費處理 |
|---|---|---|
| 升級（入門版 → 成長版 / 大量需求） | 下一個 billing cycle | MVP 不做 proration；封閉 Beta 可由 Platform Admin 手動即時調整 |
| 降級 | 下一個 billing cycle | 本期維持原方案額度，下期起套新方案 |
| 取消 | 期末取消 | 本期到期日仍可用，到期後 cancelled |
| 立即取消 + 退費 | 首次付款後 7 天內人工審核 | 需符合退費政策的低使用量條件；超過 7 天不退月費 |

### 7.4 AI Pack 加購（Stage 4+）

MVP 不實作 AI Pack，也不建立 `subscription_addons` 表。Stage 4+ 若要加購，建議採當月有效：

- AI Pack 10：NT$ 300 / 10 次
- AI Pack 50：NT$ 1,200 / 50 次
- AI Pack 200：NT$ 4,000 / 200 次

---

## 8. 訂閱與組織狀態機

### 8.1 `organizations.status`

```
trialing ──(trial 結束未付款)──▶ suspended
trialing ──(主動升級成功)─────▶ active
active ──(扣款失敗)────────────▶ past_due
past_due ──(7 天內補繳)───────▶ active
past_due ──(超過 7 天)─────────▶ suspended
suspended ──(30 天內補繳)─────▶ active
suspended ──(超過 30 天)──────▶ cancelled
任一狀態 ──(Owner 主動取消)──▶ cancelled
```

### 8.2 各狀態的可用範圍

| 狀態 | 登入 | 看資料 | 編輯 | 新增退貨 | AI | 邀請成員 | 升降級 |
|---|---|---|---|---|---|---|---|
| trialing | ✓ | ✓ | ✓ | ✓ | ✓（依方案） | ✓ | ✓ |
| active | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| past_due | ✓ | ✓ | ✓ | × | × | × | ✓（補繳） |
| suspended | ✓ | ✓ | × | × | × | × | ✓（補繳） |
| cancelled | ✓ | ✓（只讀 30 天） | × | × | × | × | ✓（重新啟用） |

---

## 9. AI 額度（最關鍵的成本控制）

### 9.1 計算單位

一次 AI 退貨分析 = 一份 `ai_analysis_reports`。
同樣資料（fingerprint）命中既有快取 → 不計入用量。

### 9.2 月度重置

每月 1 日 00:00 Asia/Taipei，cron 重置月度計數視圖。實際做法：
- 不刪 `ai_usage_events`。
- 計數查詢限定 `created_at` 落在 `[本月1日, 下月1日)` 區間。

### 9.3 用量檢查（每次 AI 呼叫前）

```ts
const limit = getOrgAIUsageLimit(org); // null = enterprise 無限
if (limit === null) proceed();
const usedThisMonth = await countAIUsage(orgId, currentPeriod());
const available = limit - usedThisMonth;
if (available <= 0) {
  // 402 Payment Required（升級）
  return { code: 'ai_quota_exceeded', limit, used: usedThisMonth };
}
```

UI 行為：
- 用量 ≥ 80% 顯示 banner「本月剩 X 次」。
- 用量 = 100% 阻擋按鈕並彈出 [升級方案] modal。

---

## 10. 資料模型補丁（在 023 之上）

需要新增的 migration `024_saas_commercial_v2.sql`（草稿，待授權後才套）：

```sql
-- 組織擴充
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,                   -- 統一編號
  ADD COLUMN IF NOT EXISTS invoice_carrier TEXT,          -- 載具
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 訂閱擴充（試用、取消排程）
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 邀請
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'viewer')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 發票
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_twd INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('issued', 'failed', 'void')),
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  invoice_number TEXT,                                   -- 電子發票字軌號
  issued_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 稽核
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs(org_id, created_at DESC);
```

並把所有既有業務表（returns、orders、ai_analysis_reports、ai_usage_events 等）補上：
- `org_id UUID NOT NULL REFERENCES organizations(id)`
- RLS policy「成員只看自己 org」
- 寫入路徑強制注入 `org_id`

> 這部分要逐表 audit，列出在 `migration 025_attach_org_id_to_business_tables.sql`，先 Draft，授權後分批套用。

---

## 11. Webhook 與 server actions

### 11.1 Webhook 端點

| Route | Provider | 用途 |
|---|---|---|
| `/api/billing/ecpay/webhook` | ECPay | 定期定額授權、扣款結果、發票 |
| `/api/billing/stripe/webhook` | Stripe | 預留，旗標關閉時回 404 |
| `/api/billing/tappay/webhook` | TapPay | 預留 |

共用流程：
1. 驗簽 → 失敗 401。
2. 寫 `billing_events`（unique by provider + event_id，防重放）。
3. 用 idempotent handler 更新 `subscriptions` / `invoices` / `organizations.status`。
4. 寄通知（升級成功、扣款失敗、即將到期等）。
5. 成功回 200。

### 11.2 主要 server actions

```
auth:
  - signupOrgWithOwner
  - acceptInvite
  - verifyPasswordRecoveryOtp
  - updateRecoveredPassword

org:
  - inviteMember / cancelInvite / removeMember / changeRole
  - updateOrgProfile / updateInvoiceInfo

billing:
  - startSubscription(plan)
  - changePlan(plan)
  - cancelAtPeriodEnd / resumeSubscription
  - listInvoices / downloadInvoice

usage:
  - getCurrentUsage
  - checkAndConsumeAI（給 AI 路徑用，atomic）

apiKeys (Stage 4+):
  - createApiKey / revokeApiKey / listApiKeys

internal (multi-tenant admin):
  - listOrgs / forceSetPlan / suspendOrg / resumeOrg / impersonate
```

---

## 12. 通知

| 事件 | 管道 | 收件人 |
|---|---|---|
| 註冊成功 | Email | 註冊者 |
| Trial 剩 3 天 / 1 天 | Email + 站內 | Owner |
| 升級成功 | Email + 站內 | Owner |
| 扣款成功（含發票） | Email | Owner（billing_email） |
| 扣款失敗 | Email + 站內 | Owner、Admin |
| AI 用量 80% / 100% | 站內 + Email | Owner、Admin |
| 邀請 | Email | 受邀者 |
| 平台公告 | 站內 | 全體成員 |

實作：以 `notifications` 表 + `email_queue`（既有可重用）+ Vercel cron 5 分鐘掃一次。

---

## 13. Feature flag 對應的開放節奏

| 階段 | 開啟旗標 | 對象 |
|---|---|---|
| Stage 0 內部測試 | `ai_usage_limit` | 公司測試帳號 |
| Stage 1 封閉 Beta | + `subscription_plan` | 2–5 個 Beta 客戶（手動開通） |
| Stage 2 付費 Beta | + `billing` | 同上，串接 ECPay 正式環境 |
| Stage 3 受限公開 | + `public_signup` | 開放公開註冊，預設建立入門版申請 |
| Stage 4 完整公開 | + `advanced_analytics` | 全方案、全功能 |
| Stage 5 國際 | + Stripe path enable | 海外客戶 |
| Stage 6 平台化 | + `multi_tenant_admin` | 內部運營後台完整 |

每次升 stage 都要：lint / typecheck / test / build 全綠 + 商業版 doctor 全綠 + 至少一個 Beta 客戶實際走過 happy path。

---

## 14. 法規與合規（必備清單）

- 服務條款 / 隱私權政策 / 退費政策 三頁完成。
- 個資法：登入紀錄、第三方 SDK 揭露、Cookie 同意 banner。
- 電子發票：透過 ECPay 發票模組，B2C/B2B 兩種版型。
- 統一編號 + 載具欄位（`organizations.tax_id`、`invoice_carrier`）。
- 首次訂閱付款後 7 天內可申請人工審核退費，但需同時符合：
  - AI 使用次數小於或等於方案月額度的 20%。
  - 退貨單建立筆數小於或等於方案軟限制的 5%。
  - 未匯出任何報表。
  - 未邀請任何成員。
- 月費續訂週期原則不退費；客戶可隨時取消下期續訂，並可用到本期結束。
- AI Pack 若於 Stage 4+ 啟用，一經使用不退。
- 資料刪除：Owner 點 [刪除組織] → 7 天 cooldown → 排程刪除 + 匯出 zip。
- 稽核紀錄至少保留 12 個月。

---

## 15. 開發里程碑（v2 三階段）

### Stage 1：封閉 Beta（手動開通，不接金流）— 3 週

| 任務 | 範圍 |
|---|---|
| S1.1 多租戶基礎 | 套用 `023` migration 到 SaaS Supabase；新增 `024_extend_member_roles.sql`；業務表 audit + `025_attach_org_id.sql` 草案 |
| S1.2 業務表掛 `org_id` + RLS | returns / return_items / return_images / orders / customers / shopee_returns / pickup_records / ai_analysis_reports / ai_usage_events |
| S1.3 登入後 org 解析 | middleware 注入 `org_id`；server actions 統一 guard；service_role 僅 server route |
| S1.4 平台 admin 後台 | `/internal/orgs` 手動建 org / 設 plan / 設 feature_flags |
| S1.5 邀請流程 | `organization_invites` + `/invite/[token]`；Owner 邀 Admin/Staff/Viewer |
| S1.6 AI 額度門禁 | `org.plan` × `ai_usage_events` 計數，100% 阻擋顯示「請聯絡客服升級方案」 |
| S1.7 跑通 2 個 Beta 客戶 | 真實匯入蝦皮資料，至少跑完一輪退貨流程與 AI 報告 |

### Stage 2：付費 Beta（接綠界 + 訂閱頁 + 發票）— 3 週

| 任務 | 範圍 |
|---|---|
| S2.1 Plans 頁 | `/pricing` + `/app/settings/billing` 升級流程 |
| S2.2 ECPay 定期定額 | 授權頁、`/api/billing/ecpay/webhook`、idempotent + billing_events |
| S2.3 訂閱狀態機 | trialing / active / past_due / suspended / cancelled 全鏈路（7 天 / 30 天寬限）|
| S2.4 電子發票 | 統編 + 載具欄位、ECPay 發票 API、`invoices` 表 |
| S2.5 通知（最小） | 扣款成功 / 失敗 / AI 100% / 邀請信，重用既有 `email_queue` |
| S2.6 法規三頁 | `/legal/terms`、`/legal/privacy`、`/legal/refund`（7 天內人工審核退費條件）|

### Stage 3：正式上線（公開註冊 + 完整自助）— 3 週

| 任務 | 範圍 |
|---|---|
| S3.1 公開註冊 | 開 `public_signup` 旗標；3 天 trial；onboarding 精靈 |
| S3.2 Landing + 行銷頁 | `/`、`/features/*`、`/contact`、FAQ |
| S3.3 Viewer 角色 + 進階分析 | `advanced_analytics` 旗標、成長版以上才可用 |
| S3.4 自助升降級 | 升級下個 cycle 生效（MVP 不做 proration）|
| S3.5 監控 + 備份 | Sentry、Vercel cron drill、SaaS DB 備份 SOP |

### 延後（Stage 4+）

- AI Pack 加購（50 次 / 200 次）
- API key（大量需求）
- Stripe / 國際金流
- 退貨筆數超額計費
- 升降級 proration
- 多平台 admin 完整功能（強制停權、impersonate）

### 合計

- Stage 1 → Stage 3 約 9 週，落在原 8–12 週目標內。
- 每個 Stage 結束都必須跑：`npm run saas:verify-checkout` / `saas:doctor` / `lint` / `typecheck` / `test:all` / `build` 全綠。

---

## 16. 安全邊界提醒

本規格實作期間：
- 所有 schema 變更先寫 migration，**不直接動 Supabase Dashboard**。
- ECPay / Stripe / TapPay credentials 屬於平台操作，先在 `.env.saas.local` 用 sandbox 測試，正式 credentials 須明確授權才寫入 Vercel。
- 不在 SaaS DB 放任何上市版 / 公司 production 資料；測試一律合成資料或脫敏。
- 不在 `master` 做任何 SaaS 商業化 commit；本規格全部在 `develop-saas`。

詳見 [`LIVE_PROTECTION_AND_SAAS_WORKFLOW.md`](./LIVE_PROTECTION_AND_SAAS_WORKFLOW.md) 與 [`SAAS_ARCHITECTURE_DECISION.md`](./SAAS_ARCHITECTURE_DECISION.md)。
