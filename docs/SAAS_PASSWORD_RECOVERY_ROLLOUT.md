# SaaS 密碼復原 Rollout

Last updated: 2026-07-17

## Repository 狀態

- Commit `efe50ee` 已在 `develop-saas` 加入信箱／手機驗證碼密碼復原。
- Commit `36e21fd` 已補上 legacy 管理員密碼登入的 Cloudflare Turnstile
  server-side Siteverify；client widget 不再是該路徑的唯一防線。
- Commit `54bbeb7` 讓 legacy 管理員密碼設定在每次請求時讀取，並穩定完整
  單元測試中的 auth action 回歸案例。
- 兩個復原旗標預設皆為 `false`，本次沒有 deploy、migration、Vercel/Supabase
  env、SMTP、SMS provider 或 Production 設定變更。
- Google Production rollout 已完成，且不受這兩個獨立旗標影響。
- 寄送與重送前會讀取禁止快取的
  `/api/saas/password-recovery/readiness`；舊頁面、rolling deploy、網路失敗
  或不可信回應都會在呼叫 Supabase Auth 前 fail closed。
- Migration `044` 只服務 Email／Phone 自助註冊與試用建立；既有帳號的密碼
  復原不依賴 `044`，不得因此提前或重複套用 migration。

## 功能旗標

```env
ENABLE_EMAIL_PASSWORD_RECOVERY=false
ENABLE_PHONE_PASSWORD_RECOVERY=false
SAAS_AUTH_CAPTCHA_READY=false
SAAS_EMAIL_OTP_PROVIDER_READY=false
SAAS_PHONE_OTP_PROVIDER_READY=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

只有對應 provider 已完成正式寄送、CAPTCHA 已完成全登入面驗收，才可開啟
channel 旗標。`TURNSTILE_SECRET_KEY` 是 Vercel server-only secret，只供本應用
程式驗證 legacy 管理員登入；Supabase Auth 使用的是 Supabase Dashboard 內的
另一份 Turnstile secret。兩者都不得寫入 Git、文件或聊天。

## 流程契約

### Email

1. `/forgot-password` 將 CAPTCHA token 與正規化 Email 交給
   `resetPasswordForEmail()`。
2. 寄送回應一律使用相同繁中訊息，避免洩漏帳號是否存在。
3. 使用者輸入 6 位數驗證碼；server action 以 `verifyOtp(type: 'recovery')`
   驗證，且必須取得新的 session 與相符的 confirmed user。
4. Supabase recovery email template 必須使用 `{{ .Token }}` 顯示 6 位數碼；
   預設 magic-link 模板不符合目前 UI，未實寄驗收前不得開旗標。

### Phone

1. `/forgot-password` 使用 `signInWithOtp()`，固定
   `shouldCreateUser: false`、`channel: 'sms'`，避免復原流程建立新帳號。
2. server action 以 `verifyOtp(type: 'sms')` 驗證，並確認 verified phone 與
   使用者 ID 一致。
3. 僅接受台灣 `+8869XXXXXXXX` 格式；SMS provider、台灣路由、費用上限與
   fraud protection 必須先驗收。

### 更新密碼

- OTP 驗證成功後，server 會簽發綁定 user ID、10 分鐘有效、HttpOnly、
  SameSite=Strict 的復原證明。
- `/reset-password` 不是 public route；一般 Google／密碼登入 session 沒有該
  復原證明時會回到 `/forgot-password`。
- 密碼更新只透過再次驗證該證明的 server action 執行；成功後消耗證明並
  global sign-out。若 global sign-out 失敗，會嘗試 local sign-out，且不會
  對使用者宣稱所有裝置已登出。
- OTP、密碼、Turnstile token、provider secret 均不寫入 URL、storage、log、
  Git 或聊天。

## 安全控制

- 寄送階段使用泛化回應防止帳號列舉；只有 CAPTCHA 與明確 rate-limit 錯誤
  可顯示可操作提示。
- client 提供 60 秒重送倒數與每次重新取得 CAPTCHA；真正的安全邊界仍是
  Supabase/provider server rate limits，不能只依賴前端倒數。
- OTP 驗證必須回傳新的 session/user；缺 session、`getUser()` 失敗、user ID
  或 verified contact 不符時 fail closed，並清除已建立的 recovery session。
- server action 再次檢查 channel feature flag，無法只靠直接呼叫 action
  繞過關閉狀態。
- client 寄送與重送會再次確認 server-side channel readiness；readiness API
  只回傳 Email／Phone 兩個布林值，不公開 site key、provider、env 或 migration
  細節，且回應一律 `no-store`。
- legacy 管理員 Siteverify 驗證 token 長度、provider 回應、`password_login`
  action 與由 `NEXT_PUBLIC_APP_URL` 推導的 hostname；逾時或網路錯誤均 fail
  closed，且不 retry／不輸出 provider payload。

## 上線順序

1. 先部署程式，但維持兩個 password recovery flags 與 OTP signup flags 為
   `false`。
2. 在 Cloudflare 建立 Production widget；Vercel 設定 public site key 與
   server-only secret，Supabase Dashboard 另設 Auth CAPTCHA secret。
3. 完成 Custom SMTP／SMS provider、六碼模板、rate limit、費用告警與實寄
   測試，再標記對應 provider readiness。
4. 先啟用 `SAAS_AUTH_CAPTCHA_READY=true`，立即 smoke test Google、既有 Email
   密碼、Phone 密碼、legacy 管理員與 Supabase platform-admin principal。
5. 只開一個 recovery channel，使用 disposable account 測試寄送、錯碼、
   過期、重送、不存在帳號、一般 session 不可進 reset、更新後 global logout。
6. 觀察錯誤率與 abuse 後，才評估第二個 channel。

任何 deploy、env/secret、Supabase Auth、SMTP/SMS provider 或 migration 操作都
需要另外明確授權。不得重跑已套用的 migrations `040`–`043`。
