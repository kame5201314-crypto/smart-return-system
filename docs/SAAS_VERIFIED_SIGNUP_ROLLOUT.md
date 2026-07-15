# SaaS 信箱／手機驗證註冊 Rollout

Last updated: 2026-07-15

## 目前狀態

- 本機程式已加入「信箱或台灣手機號碼 + 密碼 → 6 位數驗證碼 → 建立 3 天試用」流程。
- Google 登入保持原樣且使用獨立旗標，不會因 OTP 功能關閉而受影響。
- Email OTP 與 Phone OTP 使用獨立旗標，預設皆為 `false`。
- 驗證碼與密碼交由 Supabase Auth 處理；應用程式不產生、不保存、不記錄驗證碼或密碼。
- Cloudflare Turnstile token 直接傳給 Supabase Auth CAPTCHA 驗證；每次寄送或重送後都會失效並重新取得。
- Supabase Auth CAPTCHA 是 project-wide；Email／手機與平台管理員登入頁都已接上
  Turnstile。legacy 管理員 cookie 驗證不呼叫 Supabase，但仍保留相同的前端挑戰；
  Supabase platform-admin principal 則會把 token 傳入密碼登入端點。
- Migration `044_saas_verified_identity_self_service_trial.sql` 目前只是草稿，尚未套用到任何資料庫。
- 尚未設定 Custom SMTP、SMS provider、Turnstile 或 Production env，因此目前 Production 不會顯示新註冊入口，也不能實際收取驗證碼。

## 功能旗標與 readiness 標記

```env
ENABLE_EMAIL_OTP_SIGNUP=false
ENABLE_PHONE_OTP_SIGNUP=false
SAAS_AUTH_CAPTCHA_READY=false
SAAS_VERIFIED_SIGNUP_MIGRATION_READY=false
SAAS_EMAIL_OTP_PROVIDER_READY=false
SAAS_PHONE_OTP_PROVIDER_READY=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

入口只有在下列條件同時滿足時才會顯示：

1. 對應 channel 的 `ENABLE_*_OTP_SIGNUP=true`。
2. `SAAS_AUTH_CAPTCHA_READY=true` 且有真實 Turnstile site key。
3. Migration 044 已在 SaaS project 驗證完畢，才可標記 `SAAS_VERIFIED_SIGNUP_MIGRATION_READY=true`。
4. 對應 Custom SMTP 或 SMS provider 已實測，且 readiness 標記為 `true`。
5. 3 天試用到期 cron 仍保持啟用。

不得填 placeholder，也不得把 Turnstile secret、SMTP/SMS token、Supabase service-role key 寫入 Git 或聊天。

## 外部設定前置條件

### Email OTP

1. 準備寄件網域並完成 DNS 驗證。
2. 在 Supabase Auth 設定 production-grade Custom SMTP；內建 SMTP 不作正式客戶寄送。
3. 將 signup confirmation email template 改成顯示 `{{ .Token }}` 的 6 位數驗證碼。
4. 將 Supabase OTP length 明確固定為 6，與 UI／測試契約一致。
5. 確認 Email confirmation 保持開啟，不能讓 signup 直接產生 session。
6. 實測寄送、錯碼、過期、重送、既有帳號與 spam folder 情境。

### Phone OTP

1. 選定 Supabase 支援的 SMS provider，準備正式或 sandbox 帳號與台灣發送能力。
2. 僅允許本產品目前支援的台灣 `+8869XXXXXXXX` 手機格式。
3. 啟用 provider 的地理權限、費用上限、fraud protection 與 Supabase Auth rate limits。
4. 將 Supabase OTP length 明確固定為 6。
5. 實測台灣各主要電信、錯碼、過期、重送、封鎖與費用告警。

### CAPTCHA

1. 在 Cloudflare Turnstile 建立 Production widget，加入正式網域。
2. 將 public site key 放入 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`。
3. 只在 Supabase Auth Dashboard 安全設定 Turnstile secret；不得放入 repo。
4. 驗證 Supabase Auth CAPTCHA 已啟用後，才可將 `SAAS_AUTH_CAPTCHA_READY=true`。
5. 啟用後立即驗證既有 Email 密碼登入、Phone 密碼登入、signup 與 password
   reset；這些 Supabase Auth endpoints 共用 CAPTCHA 設定。

官方參考：

- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)

## Migration 044

Migration 044 會：

- 保留 migrations `040`–`043` 既有資料與 Google RPC signature。
- 在 trial claim 加入 `identity_provider` 與 normalized phone。
- 讓 phone-only trial 的 Email 欄位保持 `NULL`，不建立假 Email。
- 從 `auth.users` 與 `auth.identities` 在資料庫端重新驗證已確認的 provider/contact。
- 用 user、verified Email、verified phone 與 idempotency advisory locks 防止重複建立工作區。
- 繼續使用同一 trial claim，因此現有「AI 僅一次」及「到期唯讀」防線自然涵蓋 OTP 試用。
- 只允許 service role 執行 verified provisioning RPC。

已知身份限制：若 Email 帳號與 Phone 帳號是兩個沒有經 Supabase identity
linking 合併的不同 `auth.users`，系統無法僅靠 Email／門號證明兩者是同一真人。
Migration 044 仍會分別防止相同 user、相同 verified Email 或相同 verified
phone 重複領取；跨 channel 的同一人合併必須走受控 identity linking，不能由
應用程式猜測或自動接管另一個帳號的工作區。

套用順序必須是 migration-first、app-second；migration 只可在 SaaS project `auyznbwtjvemyamujmgt` 取得明確授權、備份與審查後執行。不得重跑 `040`–`043`。

## 上線順序

1. 先完成 Custom SMTP 或 SMS、Turnstile、模板與 provider 測試。
2. 以獨立備份與 dry-run 審查 migration 044。
3. 取得 owner 對「僅 SaaS project 044」的明確授權後套用並驗證 schema/RPC/grants。
4. 先部署含登入 Turnstile 支援的程式，但維持 CAPTCHA readiness 與兩個
   OTP feature flags 為 `false`。
5. 設定 public site key，再於同一維護窗口啟用 Supabase Auth CAPTCHA 與
   `SAAS_AUTH_CAPTCHA_READY=true`；立刻 smoke test 舊客戶密碼登入，避免鎖住使用者。
6. 維持 OTP flags 關閉，確認 Google、Email 密碼登入與管理員登入均正常。
7. 先只開 Email OTP，執行 disposable account 完整驗收。
8. 驗證 Google 重複登入不建立第二租戶、AI 只能成功一次、到期仍可讀但不可寫、商家不可進 `/internal`。
9. Email 穩定後，再單獨評估 Phone OTP 與簡訊成本/fraud 風險。

任何 deploy、migration、Vercel/Supabase/env/provider 設定仍需個別明確授權。
