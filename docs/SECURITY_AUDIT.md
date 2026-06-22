# SaaS 資安稽核報告（Security Launch Audit）

- 日期：2026-06-13
- 分支：`develop-saas`
- 方法：Claude 與 Codex **兩個獨立稽核**交叉驗證，結論零分歧。
- 性質：唯讀稽核。本文件只記錄稽核結論與待辦交辦，**不含任何後端程式修改**。
- Production 現況：`f634bc0` 部署於 `https://smart-return-system-saas.vercel.app`（Closed Manual Beta）。

---

## 1. Launch Gate 判定

| 階段 | 判定 | 說明 |
|---|---|---|
| **Closed Manual Beta（人工開通、免費）** | 🟢 **GREEN — 可上線** | 唯一上線前安全前置：owner 確認 production `ADMIN_PASSWORD` 強度（P0）。 |
| **公開註冊 / 付費 SaaS** | 🟡 **YELLOW — 暫不開放** | 需先完成 email provider、Billing/ECPay、資料刪除 SOP、公開註冊流程，以及 P1/P2 安全修正與部分 migration，且每項皆需 owner 另行授權。 |

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
| 公開寫入面驗證 | 消費者退貨 portal 寫入經 `customerReturnSchema`（zod）驗證 + 欄位長度上限 + 手機 regex | ✅ |
| ECPay webhook | `app/api/billing/ecpay/webhook/route.ts` + `CheckMacValue` 簽章驗證（Billing 目前停用） | ✅ |
| 相依套件漏洞 | `npm audit --omit=dev`：**0 high / 0 critical**，餘 1 low / 10 moderate（production deps）；high/critical 僅存在 dev-only 建置工具，不 ship 至 production | ✅ |

> **備份說明（需 owner 確認，非本稽核可驗證）**：repo 內已實作**應用層 backup cron gating**；但 Supabase **平台層的每日自動備份是否啟用**屬 Supabase Dashboard 設定，無法從 repo 驗證。owner 應於 Supabase Dashboard 確認 daily backup 已開啟。

---

## 3. 待處理項目（Priority）

### P0 — Owner 上線前必做（唯一安全前置）

- **確認 Vercel Production `ADMIN_PASSWORD` 為強密碼**：至少 12 字，不可為 `admin123`、生日、電話或常見字。這是 Closed Manual Beta 上線前唯一需要 owner 親自確認的安全項。

### P1 — Codex 後端修正（公開上市前必補；Manual Beta 建議一併處理）

1. **`scripts/fix-auth.ts` 弱密碼風險**
   - 現況：該 script 會建立/重設 `admin@example.com` 密碼為硬寫的 `admin888`（`scripts/fix-auth.ts:37`），並使用 service role key。
   - 風險：非 runtime route，但若誤對 SaaS production DB 執行，會製造「公開已知帳密」的管理員帳號。
   - 修法（擇一）：(a) 加 `APP_MODE=development/local` + `ALLOW_DEV_AUTH_FIX=true` 雙重 gate，缺任一即 `process.exit(1)`；或 (b) 刪除/封存該 script。
   - owner 並應確認 production SaaS DB 中 `admin@example.com` 帳號不存在，或已改強密碼/刪除。

2. **`app/api/internal/schema-drift-alert/route.ts` 改 fail-closed**
   - 現況：`SCHEMA_DRIFT_ALERT_TOKEN` 未設定時 `isAuthorized` 直接 `return true`（`route.ts:9-12`），形成 fail-open。
   - 現況風險等級：production 已設該 token（docs 確認），故非立即 blocker。
   - 修法：缺 token 時改回 `401/503`（fail-closed）；token **只接受 `x-schema-drift-token` header**，移除 query `?token=`（避免 token 進入 log/referrer）。

### P2 — 公開 / 收費前再做（非 Beta blocker）

- **CSP 強化**：`lib/security/headers.ts:7` 的 `script-src` 含 `'unsafe-inline' 'unsafe-eval'`（Next.js 常見妥協，且無 XSS sink，殘餘風險低）。正式公開後研究 nonce/hash CSP 逐步移除。
- **PDPA / 個資營運 SOP**（文件）：客戶要求刪除資料的流程、資料保留期限、誰能接觸消費者姓名/電話/地址、資料外洩通報流程。
- **平台 admin MFA / 2FA**：營運者帳號為最高價值帳號，公開上市前建議啟用雙因子。
- **其他強化**：帳號列舉防護（login/signup 失敗訊息一致化）、audit_logs 防竄改、上傳圖片 URL 的 SSRF 評估、WAF/bot 防護。

---

## 4. 明確「現在不要做」（除非 owner 另行授權）

- ❌ 不要開 `ENABLE_PUBLIC_SIGNUP=true`
- ❌ 不要啟用 Billing / ECPay（`ENABLE_BILLING`）
- ❌ 不要套用 draft migration `033` / `034` / `036`
- ❌ 不要為了自訂網域卡住 Beta — 先用 `https://smart-return-system-saas.vercel.app`

---

## 5. 建議執行順序

1. Owner 確認 Vercel Production `ADMIN_PASSWORD` 強度（P0）。
2. Codex 修 `scripts/fix-auth.ts`（P1）。
3. Codex 修 `schema-drift-alert` fail-closed（P1）。
4. Codex 跑 `lint / typecheck / test:all / saas:doctor / saas:rollout-check` 全綠。
5. 全部通過後，開始 Closed Manual Beta，**不再加新功能**。

---

## 6. Codex P1 Handoff（交辦清單與驗收標準）

> 以下兩項屬後端 / scripts / API scope，由 Codex 執行。UI（Claude）不碰。

### 任務 A：`scripts/fix-auth.ts` 弱密碼防護
- [ ] 加雙重 gate：`APP_MODE` 為 `development`/`local` **且** `ALLOW_DEV_AUTH_FIX=true` 才允許執行；否則立即 `process.exit(1)` 並印出拒絕訊息。（或刪除/封存該 script。）
- [ ] 驗收：在 `APP_MODE=saas`（或未設旗標）環境下執行該 script **必須拒絕**，不得對 production/SaaS DB 建立或重設任何帳號。

### 任務 B：`app/api/internal/schema-drift-alert/route.ts` fail-closed
- [ ] `SCHEMA_DRIFT_ALERT_TOKEN` 未設定時回 `401`（或 `503`），不再 `return true`。
- [ ] token 只從 `x-schema-drift-token` header 讀取。
- [ ] 移除 query `?token=` 讀取路徑。
- [ ] 驗收：缺 token 的請求回 401/503；帶錯 token 回 401；帶正確 header token 回 200。

### 共同驗收（Codex 完成後）
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:all`
- [ ] `npm run saas:doctor`
- [ ] `npm run saas:rollout-check`
- [ ] `git status` 乾淨
- [ ] commit + push `origin/develop-saas`

---

*本文件由 Claude（UI/docs）整理 Claude + Codex 雙方資安稽核共識；P1 程式修正交由 Codex 執行。記錄當下事實，commit 雜湊與 production 狀態會隨時間變動，後續以實際為準。*
