# SaaS Google 登入與自助試用啟用手冊

狀態：程式基礎已完成，Production 尚未啟用  
更新：2026-07-14

這份手冊只定義安全啟用順序，不授權變更 Google Cloud、
Supabase、Vercel、migration、env 或 Production deployment。

## 目標流程

1. 既有商家成員可用 Google 登入原工作區。
2. 無工作區且未用過試用的 Google 使用者，可建立一次 14 天試用。
3. 試用到期後只從 `trialing` 變為 `suspended`，保留唯讀查看。
4. 不自動扣款、不自動變成 `cancelled`、不刪除資料。

## 程式已完成

- Phase 1：Google OAuth PKCE start/callback、安全 `next` 路徑、商家/平台管理員分流。
- Phase 2：`/signup/complete`、自助試用 API、migration `040` 專用 RPC 草稿。
- Phase 3：scoped 到期 worker/cron、migration `041` RPC 草稿、暫停後唯讀提示。
- Rollout gate：自助試用不得在 Google Auth 或到期排程關閉時啟用。
- OAuth 導向來源：回呼與錯誤導向優先使用 `NEXT_PUBLIC_APP_URL`，不信任來訪 request host。
- 試用開通限流：驗證身分後、呼叫 service-role RPC 前，以使用者為單位做每小時 20 次的 best-effort 限流。

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

套用後驗證：

- `saas_self_service_trial_claims` 為 service-role only。
- `create_google_self_service_trial(...)` 僅 service role 可執行。
- `suspend_expired_trial_organization(...)` 僅 service role 可執行。
- migration history 依序記錄 `040` 與 `041`。
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

## 回滾順序

1. 先將 `ENABLE_GOOGLE_TRIAL_SIGNUP=false`，阻止新試用建立。
2. 若到期排程異常，再將 `ENABLE_TRIAL_EXPIRY_CRON=false`。
3. 若 Google 登入本身異常，最後將 `ENABLE_GOOGLE_AUTH=false`，保留密碼登入。
4. 不回滾/刪除 `040/041` schema；以新 migration 修正。
5. 不刪除已建立的 org、membership、subscription 或試用 claim。

## 不在本次範圍

- ECPay、自動扣款、電子發票。
- Email provider 實寄。
- `suspended -> cancelled`。
- 任何自動資料刪除。
- 對 master/live/internal Supabase 的任何變更。
