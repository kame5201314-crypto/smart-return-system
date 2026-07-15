# SaaS Google 登入與自助試用啟用手冊

狀態：外部基礎已設定，Production 目前 fail-closed，待修正後重新驗收
更新：2026-07-15

這份手冊只定義安全啟用順序，不授權變更 Google Cloud、
Supabase、Vercel、migration、env 或 Production deployment。

## 目標流程

1. 既有商家成員可用 Google 登入原工作區。
2. 無工作區且未用過試用的 Google 使用者，可建立一次 3 天試用。
3. Google 自助試用期間包含 1 次成功的真實 AI 分析；固定示範報告不呼叫
   Gemini、不扣額度。
4. 試用到期後只從 `trialing` 變為 `suspended`，保留唯讀查看。
5. 不自動扣款、不自動變成 `cancelled`、不刪除資料。

## 程式已完成

- Phase 1：Google OAuth PKCE start/callback、安全 `next` 路徑、商家/平台管理員分流。
- Phase 2：`/signup/complete`、自助試用 API、migration `040` 專用 RPC 草稿。
- Phase 3：scoped 到期 worker/cron、migration `041` RPC 草稿、暫停後唯讀提示。
- Phase 3 防誤停：migration `042` 草稿要求組織存在 Google 自助試用
  claim，避免自動排程誤停人工開通的 Beta 租戶。
- Rollout gate：自助試用不得在 Google Auth 或到期排程關閉時啟用。
- OAuth 導向來源：回呼與錯誤導向優先使用 `NEXT_PUBLIC_APP_URL`，不信任來訪 request host。
- 試用開通限流：驗證身分後、呼叫 service-role RPC 前，以使用者為單位做每小時 20 次的 best-effort 限流。
- 試用 AI 額度：migration `040` 使用 token-owned 原子 reservation，確保多個
  Vercel instance 同時請求時只有一個請求能取得 1 次額度。
- 額度結算：真實 Gemini 分析成功才完成 reservation；固定示範報告、快取、
  local fallback、解析失敗或其他失敗不扣額度並釋放 reservation。
- 中斷復原：未完成的 reservation 超過 10 分鐘可重新取得；不需要清理排程。
- 付費轉換：組織狀態轉為 `active` 後恢復依 Basic/Growth 方案計算的每月 AI 額度。
- 營運可見性：`/internal` 顯示自助試用來源、試用到期日與 AI `0/1`、
  `分析中` 或 `1/1`；read model 不讀取 reservation token。

## 外部設定順序

### 1. Google Cloud

Owner 建立 Web application OAuth client，只申請 `openid email profile`。

Google Cloud 的 authorized redirect URI 使用 Supabase Auth callback：

```text
https://auyznbwtjvemyamujmgt.supabase.co/auth/v1/callback
```

測試階段先用 Testing 模式與指定測試帳號，不要在未驗收前公開給所有
Google 帳號。

### 2. Supabase Auth

只在 SaaS project `auyznbwtjvemyamujmgt` 啟用 Google provider，填入 Google
Client ID/secret。不要變更 master/live/internal Supabase。

URL Configuration 允許：

```text
http://localhost:3001/auth/callback
https://smart-return-system-saas.vercel.app/auth/callback
```

Production Site URL 應是：

```text
https://smart-return-system-saas.vercel.app
```

Vercel Production 的 `NEXT_PUBLIC_APP_URL` 也必須是同一個穩定網址；不可
使用未列入 Supabase redirect allow-list 的其他 Vercel alias，否則 Supabase
會把 OAuth code 回傳到站點根目錄，應用程式無法在 `/auth/callback` 交換
session。

### 3. Phase 1：只開既有商家 Google 登入

Production 只設：

```text
ENABLE_GOOGLE_AUTH=true
ENABLE_GOOGLE_TRIAL_SIGNUP=false
ENABLE_TRIAL_EXPIRY_CRON=false
```

部署後只驗收既有商家登入，無工作區帳號應停在
`/signup/complete`，不建立組織。

### 4. Phase 2/3：套用 migration 與資料庫驗收

需要 Owner 分別明確授權，並只能作用於 SaaS project：

1. `040_saas_google_self_service_trial.sql`
2. `041_saas_scoped_trial_expiry.sql`
3. `042_saas_scope_trial_expiry_to_self_service.sql`

套用後驗證：

- `saas_self_service_trial_claims` 為 service-role only。
- `create_google_self_service_trial(...)` 僅 service role 可執行。
- `reserve_google_self_service_trial_ai_analysis(...)`、
  `complete_google_self_service_trial_ai_analysis(...)`、
  `release_google_self_service_trial_ai_analysis(...)` 僅 service role 可執行。
- `suspend_expired_trial_organization(...)` 僅 service role 可執行。
- `suspend_expired_trial_organization(...)` 對沒有
  `saas_self_service_trial_claims` 的人工 Beta 組織回傳
  `not_self_service_trial` 且不改狀態。
- migration history 依序記錄 `040`、`041` 與 `042`。
- `npm run saas:migration-plan:strict` 與 `npm run saas:schema-gate:strict` 通過。

### 5. Disposable QA 驗收矩陣

使用拋棄式測試組織與帳號，不碰正式客戶：

| 情境 | 預期 |
|---|---|
| 已有密碼帳號，以相同已驗證 Email 用 Google 登入 | 回到同一使用者/同一工作區；若產生重複使用者就停止 rollout |
| 不同 Google Email、無 membership | 到 `/signup/complete`，Phase 1 不自動建 org |
| active membership | 進入 `/analytics` 或安全的商家 `next` 路徑 |
| disabled membership | 不建立第二個試用，顯示工作區已停用 |
| 明確平台管理員 | 進入 `/internal`，不建試用 org |
| 重複 callback/code | 失敗關閉，不重複建立 session/org |
| `next=//evil.test` 或 `/internal/*` | 回 `/analytics`，不開放導向、不越權 |
| 同一 idempotency key 重送試用 | 回傳原 org，不建第二個 org |
| 自助試用首次查看 AI 頁 | 顯示 `0/1`，固定示範報告可查看且不呼叫 Gemini |
| 同時送出兩個真實 AI 分析 | 只有一個取得 reservation；另一個回分析進行中，不呼叫 Gemini |
| 真實 Gemini 分析成功 | 顯示 `1/1`，後續請求被拒絕 |
| Gemini/local fallback/解析失敗 | reservation 釋放，仍顯示 `0/1`，可安全重試 |
| 程序中斷留下 reservation | 10 分鐘內回分析進行中；逾時後可重新取得 |
| 試用轉成 active 付費方案 | 不再套 1 次試用限制，改用方案每月額度 |
| 平台營運後台查看自助試用租戶 | 顯示來源、到期日、AI 狀態，但不暴露 reservation token |
| 未到期 trial | 排程重跑不改狀態 |
| 已到期 trial | 只變 `suspended`，歷史資料仍可讀 |
| active/suspended/cancelled | 排程不改狀態、不刪資料 |

### 6. 啟用自助試用

只有前述驗收全過才設：

```text
ENABLE_GOOGLE_AUTH=true
ENABLE_GOOGLE_TRIAL_SIGNUP=true
ENABLE_TRIAL_EXPIRY_CRON=true
```

Production 必須同時有有效 `CRON_SECRET`、Sentry DSN 與正確 app URL。部署前跑：

```powershell
npm run saas:predeploy
```

目前 `040` 與 `041` 已套用；`042` 仍是未套用草稿。Google provider 已設定，
但 2026-07-15 實測發現 `NEXT_PUBLIC_APP_URL` 與允許的公開 callback 網址不一致，且
`041` 尚未排除人工 Beta 租戶。Production 三個 Google rollout flags 已回復
`false`。在 `NEXT_PUBLIC_APP_URL`、`042` 與新 HEAD 部署分別取得授權並完成
整套 disposable QA 前，旗標必須維持關閉。

## 回滾順序

1. 先將 `ENABLE_GOOGLE_TRIAL_SIGNUP=false`，阻止新試用建立。
2. 若到期排程異常，再將 `ENABLE_TRIAL_EXPIRY_CRON=false`。
3. 若 Google 登入本身異常，最後將 `ENABLE_GOOGLE_AUTH=false`，保留密碼登入。
4. 不回滾/刪除 `040/041/042` schema；以新 migration 修正。
5. 不刪除已建立的 org、membership、subscription 或試用 claim。

## 不在本次範圍

- ECPay、自動扣款、電子發票。
- Email provider 實寄。
- `suspended -> cancelled`。
- 任何自動資料刪除。
- 對 master/live/internal Supabase 的任何變更。
