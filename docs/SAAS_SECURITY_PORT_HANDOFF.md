# SaaS 安全移植交接摘要 — `saas-security-port`

> 狀態快照。本文件本身是 docs-only commit,描述的是 **10 個安全修復 commit**(`ed13a50` … `69ccceb`)+ 交接文件 commit(本檔)。
> 全部在本機分支 `saas-security-port`,**尚未 push**(遠端 `origin/saas-security-port` 仍停在舊交接文件 `d1bfb34`,落後本機 **4 個 commit**:3 個安全修補 `ed4dadb` / `612af91` / `69ccceb` + 本份文件更新)。
>
> 2026-06-21 更新:經獨立 34-agent 對抗審查,補上 3 個原自審漏掉的 medium 殘留修補(`ed4dadb` / `612af91` / `69ccceb`),安全 commit 由 7 → 10。

---

## 0. TL;DR

- **分支**:`saas-security-port`,base = `origin/develop-saas`(遠端正式線)。
- **內容**:10 個 P0/P1 安全修復 commit(本文件為額外的 docs commit)。前 7 個為初次移植;後 3 個(`ed4dadb` / `612af91` / `69ccceb`)是獨立對抗審查發現「初次移植漏做完整」後補上的 medium 殘留修補。
- **結論**:**P0/P1 程式側移植已在 `saas-security-port` 收口**。但**多租戶 SaaS 仍不可正式上市** —— 還有 Supabase migration、`return-images` bucket 轉 private(且需移除 anon public-read policy)、正式 env secrets、strict gates、部署 smoke test 等**外部步驟**未完成(見 §3、§5)。
- **限制**:全程未 push / deploy / merge / rebase / reset,未動 Supabase / env / migration / bucket。

---

## 1. 分支血緣(重要,先看這段避免混淆)

```
origin/develop-saas  ── 遠端「正式線」(已部署的 base)
        ├── saas-security-port (本機 HEAD = 本份 docs commit;最新安全程式碼 commit = 69ccceb)  ── 從 origin/develop-saas 開出,疊上 10 個安全 commit + 2 個交接文件 commit
        └── origin/saas-security-port (d1bfb34)  ── 遠端分支:只到「7 安全 commit + 初版交接文件」,落後本機 4 個 commit(3 安全修補 + 1 文件更新),尚未 push

local develop-saas (bfc92ae)  ── 過時的本機分歧線:ahead 12 / behind 145 of origin/develop-saas(dead-end,勿合併)
```

- `saas-security-port` 是從 **`origin/develop-saas`**(真正的遠端線)開出來的,不是從舊的本機 `develop-saas`。
- 舊的本機 `develop-saas`(12 個 commit)是一條**過時、已分歧**的線;它那 12 個 commit 的內容,遠端 `origin/develop-saas` 多半已用**不同實作**涵蓋。本次移植就是把「遠端真正還缺」的修復,重新做到遠端線上。
- **整合時請勿合併 / rebase 舊的本機 `develop-saas`**,它應被視為 dead-end(日後可單獨丟棄)。

---

## 2. 十個安全修復 commit 與解掉的風險

| # | commit | 項目 | 解掉的風險 | 主要檔案 |
|---|---|---|---|---|
| 1 | `ed13a50` | Shopee `.or()` injection sanitization | `searchShopeeReturnScanCandidates` 把原始關鍵字內插進 PostgREST `.or()` 字串 → **filter 注入**。改成參數化 `.eq` / `.ilike` 雙查詢 + escape LIKE 萬用字元 + 去重。 | `lib/actions/shopee-returns.actions.ts` |
| 2 | `3b760d9` | release gate / schema-drift fail-closed + 移除 CI 常態 BYPASS | 任何 `*_BYPASS` 在 production/strict 下可讓 gate 通過;`schema-drift-alert` 缺 token 時 `return true`(對所有人放行)。改成 production/strict bypass **fail-closed**、CI 移除常態 BYPASS、缺 token → **503**、header-only + constant-time。 | `scripts/predeploy/*.mjs`、`app/api/internal/schema-drift-alert/route.ts`、`.github/workflows/quality-gates.yml` |
| 3 | `a751470` | session secret 移除 service-role fallback | admin / upload session 簽章密鑰會 fallback 到 `SUPABASE_SERVICE_ROLE_KEY`(及彼此)→ 單一密鑰外洩即可偽造 session。改成各自 dedicated secret、≥32、**fail-closed**。 | `lib/auth/admin-session.ts`、`lib/upload/security.ts` |
| 4 | `690e716` | return-images signed URL + 刪除同步刪檔 | 退貨圖片以**永久 public URL** 讀取,且刪退貨單時 Storage 檔案殘留(孤兒 PII)。新增共用 helper:讀取改**短效 signed URL**(相容 legacy)、刪除時 best-effort 同步刪 Storage、`deleteImage` 改由 org-scoped DB 推導路徑(不信任 client)。 | `lib/storage/return-images.ts`(新)、`lib/actions/return.actions.ts`、`lib/actions/upload.ts` |
| 5a | `213dc84` | portal 三因子查詢 + 租戶隔離(資料層) | 未驗證的顧客 portal 以**全站 phone / 單號**查詢 → 跨租戶 PII 外洩。新增 `resolvePortalOrg(slug)`(fail-closed);`searchReturnForPortal({orgSlug,phone,requestNumber})` 三因子 + org-scoped + signed URL + 剝除 phone;`submitCustomerReturn` 以 slug 綁租戶;舊 `searchReturnsByPhone` / `searchReturnByNumber` **永久 fail-closed**。 | `lib/saas/portal-tenant.ts`(新)、`lib/actions/customer-return.actions.ts` |
| 5b | `8431584` | portal 路由 `/portal/[orgSlug]` + 舊頁 PII-free | 申請 / 查詢頁掛在非租戶 URL。新增 `/portal/[orgSlug]`(申請,送 orgSlug)、`/portal/[orgSlug]/track/query`(三因子);舊 `/portal`、`/portal/apply`、`/portal/track/query` 改成**不含 PII 的靜態說明頁**。 | `app/(customer)/portal/**` |
| 5c | `b9ce723` | portal upload session 綁租戶 | upload session **未綁租戶**:token 無 orgId、signed-url fallback 到 `staging/{draftId}` 與 `getOrgContext`、submit 接受非 org 前綴 → 跨租戶 staging。改成:session route `resolvePortalOrg(orgSlug)` fail-closed(400 INVALID_STORE)、token 帶 orgId、signed-url 無 orgId token → 401 MISSING_ORG 且路徑恆為 `staging/{orgId}/{draftId}/`、submit 斷言 `token.orgId === slug-resolved orgId` 且拒絕 `..` 路徑。 | `app/api/v1/upload/{session,signed-url}/route.ts`、`lib/actions/customer-return.actions.ts`、`app/(customer)/portal/[orgSlug]/page.tsx` |
| 6 | `ed4dadb` | tenant-preview cookie 移除 service-role fallback | 獨立審查發現 `a751470` 漏掉的同類點:`platform-tenant-preview.ts` 的 cookie HMAC 仍以 `ADMIN_SESSION_SECRET \|\| SUPABASE_SERVICE_ROLE_KEY`(且無長度檢查)簽章 → service-role key 外洩即可偽造 `platform_tenant_preview` cookie。改成只認 `ADMIN_SESSION_SECRET`、≥32、缺/短 fail-closed(throw);verify 缺密鑰回 null 而非 500。 | `lib/saas/platform-tenant-preview.ts` |
| 7 | `612af91` | `SAAS_SCHEMA_GATE_BYPASS` production/strict fail-closed | `3b760d9` 硬化了 4 個 predeploy gate,但漏了 SaaS 版的 `check-saas-schema-readiness.mjs`(bypass 無條件 `return 0`,連算好的 `strict` 都沒用)。改成 strict 下 bypass → `return 1`,只 non-strict local/dev 放行(鏡像 `predeploy/schema-gate.mjs`)。 | `scripts/saas/check-saas-schema-readiness.mjs` |
| 8 | `69ccceb` | customer submit 停止寫永久 public URL | `690e716` 漏掉流量最大的寫入點:`submitCustomerReturn` 兩條分支(pre-upload move / base64)仍用 `getPublicUrl()` 把永久 public URL 寫進 `return_images.image_url`。改寫短效 signed URL,`storage_path` 仍為讀取 source-of-truth(`image_url` 為 NOT NULL,簽不出時 fallback 空字串)。bucket 轉 private 仍為外部步驟。 | `lib/actions/customer-return.actions.ts` |

**整體 diffstat(vs `origin/develop-saas`,純安全程式碼,不含本交接文件)**:38 files changed, +3301 / −2012。其中後 3 個 medium 修補(`ed4dadb` … `69ccceb`)為 6 files、+197 / −28。

### 驗證紀錄
- 每個 commit 前都跑過:`typecheck`(tsc --noEmit)、`lint`(eslint)、對應單元/後端測試;最後跑 `test:all`、`safety:agent-boundary`(以授權任務分支旗標 `ALLOW_OTHER_BRANCH_WORK`)。
- 前 7 個 commit:item 4 / 5a / 5b / 5c 各做了多代理對抗審查,合計 0 個非 nit 問題。
- 後 3 個 commit(`ed4dadb` / `612af91` / `69ccceb`)來自一次**獨立 34-agent 對抗審查**(7 個逐 fix 審查 + 5 個跨切面獵捕,每個發現再逐項 adversarial 驗證):確認前 7 個的主要安全目標都成立,但抓到 3 個「自審漏做完整」的 medium 殘留(tenant-preview service-role fallback、SaaS schema gate bypass、customer submit 永久 public URL),已全部修補 + 補測試。其餘 low/nit(portal 限流以 phone 為 key、`ALERT_CONFIG_STRICT` 一致性、CI 視為 strict、兩個缺測試覆蓋)**暫不處理,避免 PR 變胖**。
- 最終全套(於最新安全程式碼 commit `69ccceb`)全綠:`typecheck` exit 0 · `lint` exit 0 · `test:all`(unit **452** · e2e 4 · integration 5 · backend 含新 saas-schema-gate bypass 測試)· `safety:agent-boundary` passed。

---

## 3. 仍需外部授權 / 外部環境的事項(程式側無法自動完成)

| 項目 | 說明 | 風險若不做 |
|---|---|---|
| **Supabase migrations** | 正式 DB 需有 `organizations.slug`、`return_images.storage_path`、各業務表 `org_id` 等欄位(本次程式碼預期它們存在)。 | slug 解析 / org-scoped 查詢 / 圖片路徑會在 runtime 出錯。 |
| **`return-images` bucket 轉 private + 移除 anon public-read policy** | 圖片讀取已全面走 signed URL、staging 已全 org-scoped、customer submit 也已停止寫永久 public URL(`69ccceb`),**現在轉 private 是安全的**。⚠ 只把 `public=false` 不夠:還要砍掉 `supabase/setup.sql` 那條 anon `Allow public read` storage policy;且 `setup.sql` / `scripts/check-storage.ts` 會把 `public:true` 重設回去,手動 flip 會被還原。 | bucket 仍 public 時,物件可被未授權直接存取(PDPA)。 |
| **正式 env secrets** | `ADMIN_SESSION_SECRET`、`UPLOAD_SESSION_SECRET`(各 ≥32)、`SCHEMA_DRIFT_ALERT_TOKEN` 等。 | admin 登入 / 上傳 / 告警端點會 fail-closed(預期的安全行為,但功能不可用)。 |
| **Strict gates / 部署** | `saas:schema-gate:strict`、`saas:predeploy`、Vercel production 設定。 | — |
| **push / 整合** | 把 `saas-security-port` 整合進 `origin/develop-saas`(見 §4)。 | — |

---

## 4. 建議的整合方式(整進 `origin/develop-saas`)

**建議:開 PR(`saas-security-port` → `develop-saas`)。**

```
# 1) push 安全分支(fast-forward 更新既有遠端分支;遠端現停在 d1bfb34,本機 ahead 4:3 修補 + 1 文件)
git push origin saas-security-port           # 不要 --force

# 2) 在 GitHub 開 PR:base = develop-saas,compare = saas-security-port
#    讓 quality-gates.yml(CI)在 PR 上跑 lint / typecheck / test:all / 預部署 gate
```

原則:
- **不要 force push**、**不要 rebase/merge 舊的本機 `develop-saas`(12 commit 的過時線)**。
- `saas-security-port` 是從 `origin/develop-saas` 開出,10 個安全 commit(+ 交接文件)可直接 fast-forward 或以 PR squash/merge 進去 —— 由你決定 merge 策略。
- 若偏好不開 PR,也可直接 `git push origin saas-security-port` 後在本機快轉 `develop-saas`;但**開 PR 較佳**,可留審查紀錄並讓 CI gate 把關。

### PR body 草稿

```text
## 安全移植:saas-security-port → develop-saas

把 origin/develop-saas 上仍缺的 P0/P1 安全修復補齊,共 10 個安全 commit(+ 2 個交接文件)。不含舊本機 develop-saas 的 12 個過時 commit。

### 修了什麼
- P0 注入:移除 shopee scan 的 PostgREST .or() filter injection
- 上市安全閘:release gate / schema-drift 在 production/strict fail-closed、移除 CI 常態 *_BYPASS、SAAS_SCHEMA_GATE_BYPASS 也補上 fail-closed
- 密鑰:admin / upload / tenant-preview session 簽章不再 fallback 到 SUPABASE_SERVICE_ROLE_KEY,缺/短密鑰 fail-closed
- PII:退貨圖片改短效 signed URL、刪單同步刪 Storage、customer submit 不再寫永久 public URL
- 多租戶 portal:/portal/[orgSlug] 三因子(slug + phone + request_number)+ 資料層 org 隔離 + 上傳 session 綁租戶;舊全站 phone/單號查詢永久 fail-closed

### 驗證
typecheck / lint / test:all(unit 452 · e2e 4 · integration 5)/ safety:agent-boundary 全綠;經獨立 34-agent 對抗審查。

### 還沒做(外部步驟,非本 PR)
- return-images bucket 轉 private + 移除 anon public-read policy
- 正式 env secrets(ADMIN_SESSION_SECRET / UPLOAD_SESSION_SECRET ≥32、SCHEMA_DRIFT_ALERT_TOKEN)
- Supabase migrations、strict gates、Vercel smoke test

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 5. 上線前 checklist(多租戶正式上市)

- [ ] 套用 Supabase migrations(`org_id` / `slug` / `storage_path` 等),並用 `saas:schema-gate:strict` 驗證。
- [ ] `return-images` bucket 轉 **private**:同時**移除 anon `Allow public read` storage policy**(只改 `public=false` 不夠),並注意 `setup.sql` / `scripts/check-storage.ts` 會把 `public:true` 重設回去。
- [ ] 設定正式 env secrets(`ADMIN_SESSION_SECRET`、`UPLOAD_SESSION_SECRET` ≥32、`SCHEMA_DRIFT_ALERT_TOKEN`…)。
- [ ] 開啟 strict gates(`saas:schema-gate:strict` / `migration-plan:strict` / `saas:predeploy`),確認 production bypass 已 fail-closed。
- [ ] 把 `saas-security-port` 整合進 `origin/develop-saas`(§4)。
- [ ] Vercel preview 部署 + **smoke test**:
  - [ ] `/portal/{slug}` 申請(含照片上傳:session 帶 orgSlug → signed-url orgId-scoped → submit 成功)。
  - [ ] `/portal/{slug}/track/query` 三因子查詢(正確查得、錯 phone/單號/slug 查無、跨租戶查不到)。
  - [ ] 圖片以 signed URL 顯示;bucket private 後仍可讀。
  - [ ] 刪退貨單後 Storage 檔案同步移除。
- [ ] 確認 Sentry / 監控在 production 收得到事件。

---

## 6. 快速指令

```bash
# 看這 10 個安全 commit(+ 交接文件)
git log --oneline origin/develop-saas..saas-security-port

# 看完整 diff
git diff origin/develop-saas...saas-security-port

# 跑全部驗證(本機)
npm run typecheck && npm run lint && npm run test:all && npm run prebuild:encoding
ALLOW_OTHER_BRANCH_WORK=I_UNDERSTAND_THIS_IS_A_NONSTANDARD_BRANCH npm run safety:agent-boundary
```
