# SaaS 資安稽核報告（Security Launch Audit）

- 原始稽核：2026-06-13；完成狀態更新：2026-07-16
- 分支：`develop-saas`
- 方法：Claude 與 Codex **兩個獨立稽核**交叉驗證，結論零分歧。
- 性質：原始稽核為唯讀；本次同步已完成修正與驗收證據。
- Production 現況：2026-07-16 唯讀檢查顯示 Ready deployment
  `dpl_2szSTLaacjvu9yw2DMEhn1QUWJw3`，網址
  `https://smart-return-system-saas.vercel.app`（Google 免費自助試用 + 人工付費
  Beta）；Vercel
  inspect 未提供可歸屬的 Git SHA。既有 Google 自助試用已上線；新的登入頁註冊
  入口／文案 `dd27745` 已推送但尚未部署，`160a3fa`、`39b8c9f` 為測試 commit。

---

## 1. Launch Gate 判定

| 階段 | 判定 | 說明 |
|---|---|---|
| **Google 免費自助試用 + 人工付費 Beta** | 🟢 **GREEN — 已上線** | Google 三天試用已公開；付費轉換及非 Google 帳號仍維持人工控管。 |
| **Google trial 以外的 Email/Phone／付費公開 rollout** | 🟡 **YELLOW — 暫不開放** | 需先完成 email provider、Billing/ECPay、法務定稿與實際資料保留／刪除責任人、對應 auth rollout，以及 P1/P2 安全修正與部分 migration，且每項皆需 owner 另行授權。 |

兩個獨立稽核對以上判定**完全一致**。

---

## 2. 已驗證通過的安全控制（Verified Controls）

以下控制經本次稽核實際查證，確認存在且正確：

| 控制 | 證據 | 狀態 |
|---|---|---|
| 多租戶 RLS 隔離 | `supabase/migrations/`：15 個檔含 RLS、**148 條 `CREATE POLICY`**、338 處 `org_id` 參照 | ✅ |
| 租戶隔離硬化 P0/P1/P2 | Shopee、取件（pickup）、客戶 portal、upload/signed-url 隔離；backup/cron gating（`/api/cron/backup` 需 `SAAS_BACKUP_ORG_ID`、平台維運 cron 需 `ENABLE_PLATFORM_MAINTENANCE_CRON`） | ✅ |
| 平台 admin API 守衛 | `/api/internal/saas/*` 每個 route 皆呼叫 `requirePlatformAdminAccess`（2–3 處）。例外：`schema-drift-alert`（token 控管，見 P1）。 | ✅（一例外） |
| HTTP 安全標頭 | `lib/security/headers.ts`：CSP、HSTS（`max-age=63072000; includeSubDomains; preload`）、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy`，全站套用（`next.config.ts` `headers()`） | ✅ |
| Sentry 設定 | `next.config.ts`：`silent`、`telemetry: false`、`removeDebugLogging`、sourcemaps 受 `SENTRY_AUTH_TOKEN` 控制；Production env 已設 `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | ✅ |
| 機密未外洩 | git 全歷史無 `.env*` 提交；`.gitignore` 保護 `.env*`、`.vercel/`、`.env.saas.local` | ✅ |
| 前端無敏感金鑰 | `NEXT_PUBLIC_*` 僅 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`APP_URL`、`CONTACT_EMAIL`（anon key 設計上即公開）；service role key 未以 `NEXT_PUBLIC_` 暴露 | ✅ |
| 無 XSS sink | 全專案 0 個 `dangerouslySetInnerHTML` | ✅ |
| Rate limiting（真實程式碼） | `lib/auth/admin-login-rate-limit.ts`、`lib/actions/auth.ts`、`lib/actions/customer-return.actions.ts`、`app/api/saas/signup`、`app/api/v1/upload/*` | ✅ |
| Legacy admin CAPTCHA | Commits `36e21fd`、`063633b`：server-side Siteverify 驗證 token、`password_login` action、trusted hostname、timeout；一般挑戰失敗在密碼比對前 fail closed 並計入 rate limit，provider/configuration outage 不會鎖住正常管理員 | ✅（repo，未 deploy） |
| 密碼復原與註冊 session 安全 | Commits `efe50ee`、`91d1b1c`、`679f067`：泛化寄送回應、`shouldCreateUser=false`、new-session/user/contact match、10 分鐘 signed HttpOnly proof、失敗 session cleanup、同步防重送、guarded reset action，且 global sign-out 失敗不誤報成功 | ✅（repo，flags off） |
| 公開寫入面驗證 | 消費者退貨 portal 寫入經 `customerReturnSchema`（zod）驗證 + 欄位長度上限 + 手機 regex | ✅ |
| ECPay webhook | `app/api/billing/ecpay/webhook/route.ts` + `CheckMacValue` 簽章驗證（Billing 目前停用） | ✅ |
| 相依套件漏洞 | Commits `d411a4b`、`44bd903`：production high/critical CI gate；`npm audit --omit=dev` 與完整 audit 均為 0 low / 4 moderate / **0 high / 0 critical**。剩餘 Next/PostCSS 與 ExcelJS/UUID 路徑需 breaking change，不使用 `--force` 自動修正 | ✅ |

> **備份說明（需 owner 確認，非本稽核可驗證）**：repo 內已實作**應用層 backup cron gating**；但 Supabase **平台層的每日自動備份是否啟用**屬 Supabase Dashboard 設定，無法從 repo 驗證。owner 應於 Supabase Dashboard 確認 daily backup 已開啟。

---

## 3. 待處理項目（Priority）

### P0 — Owner 上線前必做（唯一安全前置）

- **持續確認 Vercel Production `ADMIN_PASSWORD` 為強密碼**：至少 12 字，不可為 `admin123`、生日、電話或常見字。這是現行 Google trial + 人工付費 Beta 的平台管理員安全前置。

### P1 — Codex 後端修正（已完成）

1. **`scripts/fix-auth.ts` 弱密碼風險：完成**
   - Commit `632d11e` 加入 `APP_MODE=development/local` 與
     `ALLOW_DEV_AUTH_FIX=true` 雙重 gate，移除硬寫密碼，並要求
     `DEV_ADMIN_FIX_PASSWORD` 至少 12 字。
   - 純函式回歸測試證明 SaaS/Production、缺旗標及錯誤值全部拒絕；
     測試沒有連線或寫入任何 Supabase project。

2. **`schema-drift-alert` fail-closed：完成**
   - Commit `632d11e` 讓缺 server token 回 503、缺/錯 token 回 401，且只
     接受 `x-schema-drift-token` header；query token 不再授權。
   - Route 回歸測試涵蓋缺設定、缺 header、錯 header、query token 與正確
     header 共 5 條路徑。

### P2 — 公開 / 收費前再做（非 Beta blocker）

- **CSP 強化**：`lib/security/headers.ts:7` 的 `script-src` 含 `'unsafe-inline' 'unsafe-eval'`（Next.js 常見妥協，且無 XSS sink，殘餘風險低）。正式公開後研究 nonce/hash CSP 逐步移除。
- **PDPA / 個資營運 SOP**：repo-side 草案已完成於
  `docs/SAAS_PRIVACY_DPA_DELETION_SOP.md`；剩餘項目是 owner／法務核准，並填入
  真實資料保留期限、責任人與 subprocessor 資料。
- **平台 admin MFA / 2FA**：營運者帳號為最高價值帳號，公開上市前建議啟用雙因子。
- **其他強化**：密碼復原的帳號列舉防護已完成；login/signup 其餘失敗訊息
  仍需持續檢查一致性。另追蹤 audit_logs 防竄改、上傳圖片 URL 的 SSRF
  評估、WAF/bot 防護。

---

## 4. 明確「現在不要做」（除非 owner 另行授權）

- ❌ 不要開 `ENABLE_PUBLIC_SIGNUP=true`
- ❌ 不要啟用 Billing / ECPay（`ENABLE_BILLING`）
- ❌ 不要套用 draft migration `034` / `036` / `044`；不要重跑已套用的 `030`、
  `033`、`035` 或 `037`–`043`
- ❌ 不要為了自訂網域卡住 Beta — 先用 `https://smart-return-system-saas.vercel.app`

---

## 5. 建議執行順序

1. `fix-auth` 與 `schema-drift-alert` P1 已完成並有回歸測試。
2. Google 免費自助試用 + 人工付費 Beta 已上線；SHA-attributable
   `a29f725` deployment 的 Production smoke 16/16，錯誤 log 為 0。
3. Owner 仍應持續維持強 `ADMIN_PASSWORD`，並確認 Supabase 平台層 daily
   backup 設定。
4. 公開付費前再完成 Email、Billing/ECPay、法務/個資與 MFA 等 P2 工作。

---

## 6. Codex P1 Completion Record

- [x] dev-auth 雙重 gate、無硬寫密碼與 fail-closed 純函式測試。
- [x] schema-drift server token 必填、header-only token 與 route 回歸測試。
- [x] Email/Phone password recovery 使用短效 server proof 並防帳號列舉。
- [x] legacy admin Turnstile 已補 server-side Siteverify；rollout flags 仍關閉。
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:all`（含 UI suite）
- [x] `npm run build`
- [x] commit `632d11e` 已推送 `origin/develop-saas`

在該次 auth-hardening 驗收時，乾淨副本沒有 `.env.saas.local`，因此當時沒有
偽造 placeholder 來重跑 env-backed doctor/rollout strict gates；下一次獲授權的
外部 rollout 應在安全取得 SaaS-only env 後執行完整 predeploy。

---

*本文件由 Claude（UI/docs）整理 Claude + Codex 雙方資安稽核共識；P1 程式修正交由 Codex 執行。記錄當下事實，commit 雜湊與 production 狀態會隨時間變動，後續以實際為準。*
