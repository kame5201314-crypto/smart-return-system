# SaaS 安全移植交接摘要 — `saas-security-port`

> 狀態快照。本文件本身是 docs-only commit,描述的是 **7 個安全修復 commit**(`ed13a50` … `b9ce723`)。
> 全部在本機分支 `saas-security-port`,**尚未 push**。

---

## 0. TL;DR

- **分支**:`saas-security-port`,base = `origin/develop-saas`(遠端正式線)。
- **內容**:7 個 P0/P1 安全修復 commit(本文件為額外的 docs commit)。
- **結論**:**P0/P1 程式側移植已在 `saas-security-port` 收口**。但**多租戶 SaaS 仍不可正式上市** —— 還有 Supabase migration、`return-images` bucket 轉 private、正式 env secrets、strict gates、部署 smoke test 等**外部步驟**未完成(見 §3、§5)。
- **限制**:全程未 push / deploy / merge / rebase / reset,未動 Supabase / env / migration / bucket。

---

## 1. 分支血緣(重要,先看這段避免混淆)

```
origin/develop-saas  ── 遠端「正式線」(已部署的 base)
        └── saas-security-port  ── 從 origin/develop-saas 開出,疊上 7 個安全 commit(本次工作)

local develop-saas (bfc92ae)  ── 過時的本機分歧線:ahead 12 / behind 145 of origin/develop-saas
```

- `saas-security-port` 是從 **`origin/develop-saas`**(真正的遠端線)開出來的,不是從舊的本機 `develop-saas`。
- 舊的本機 `develop-saas`(12 個 commit)是一條**過時、已分歧**的線;它那 12 個 commit 的內容,遠端 `origin/develop-saas` 多半已用**不同實作**涵蓋。本次移植就是把「遠端真正還缺」的修復,重新做到遠端線上。
- **整合時請勿合併 / rebase 舊的本機 `develop-saas`**,它應被視為 dead-end(日後可單獨丟棄)。

---

## 2. 七個安全修復 commit 與解掉的風險

| # | commit | 項目 | 解掉的風險 | 主要檔案 |
|---|---|---|---|---|
| 1 | `ed13a50` | Shopee `.or()` injection sanitization | `searchShopeeReturnScanCandidates` 把原始關鍵字內插進 PostgREST `.or()` 字串 → **filter 注入**。改成參數化 `.eq` / `.ilike` 雙查詢 + escape LIKE 萬用字元 + 去重。 | `lib/actions/shopee-returns.actions.ts` |
| 2 | `3b760d9` | release gate / schema-drift fail-closed + 移除 CI 常態 BYPASS | 任何 `*_BYPASS` 在 production/strict 下可讓 gate 通過;`schema-drift-alert` 缺 token 時 `return true`(對所有人放行)。改成 production/strict bypass **fail-closed**、CI 移除常態 BYPASS、缺 token → **503**、header-only + constant-time。 | `scripts/predeploy/*.mjs`、`app/api/internal/schema-drift-alert/route.ts`、`.github/workflows/quality-gates.yml` |
| 3 | `a751470` | session secret 移除 service-role fallback | admin / upload session 簽章密鑰會 fallback 到 `SUPABASE_SERVICE_ROLE_KEY`(及彼此)→ 單一密鑰外洩即可偽造 session。改成各自 dedicated secret、≥32、**fail-closed**。 | `lib/auth/admin-session.ts`、`lib/upload/security.ts` |
| 4 | `690e716` | return-images signed URL + 刪除同步刪檔 | 退貨圖片以**永久 public URL** 讀取,且刪退貨單時 Storage 檔案殘留(孤兒 PII)。新增共用 helper:讀取改**短效 signed URL**(相容 legacy)、刪除時 best-effort 同步刪 Storage、`deleteImage` 改由 org-scoped DB 推導路徑(不信任 client)。 | `lib/storage/return-images.ts`(新)、`lib/actions/return.actions.ts`、`lib/actions/upload.ts` |
| 5a | `213dc84` | portal 三因子查詢 + 租戶隔離(資料層) | 未驗證的顧客 portal 以**全站 phone / 單號**查詢 → 跨租戶 PII 外洩。新增 `resolvePortalOrg(slug)`(fail-closed);`searchReturnForPortal({orgSlug,phone,requestNumber})` 三因子 + org-scoped + signed URL + 剝除 phone;`submitCustomerReturn` 以 slug 綁租戶;舊 `searchReturnsByPhone` / `searchReturnByNumber` **永久 fail-closed**。 | `lib/saas/portal-tenant.ts`(新)、`lib/actions/customer-return.actions.ts` |
| 5b | `8431584` | portal 路由 `/portal/[orgSlug]` + 舊頁 PII-free | 申請 / 查詢頁掛在非租戶 URL。新增 `/portal/[orgSlug]`(申請,送 orgSlug)、`/portal/[orgSlug]/track/query`(三因子);舊 `/portal`、`/portal/apply`、`/portal/track/query` 改成**不含 PII 的靜態說明頁**。 | `app/(customer)/portal/**` |
| 5c | `b9ce723` | portal upload session 綁租戶 | upload session **未綁租戶**:token 無 orgId、signed-url fallback 到 `staging/{draftId}` 與 `getOrgContext`、submit 接受非 org 前綴 → 跨租戶 staging。改成:session route `resolvePortalOrg(orgSlug)` fail-closed(400 INVALID_STORE)、token 帶 orgId、signed-url 無 orgId token → 401 MISSING_ORG 且路徑恆為 `staging/{orgId}/{draftId}/`、submit 斷言 `token.orgId === slug-resolved orgId` 且拒絕 `..` 路徑。 | `app/api/v1/upload/{session,signed-url}/route.ts`、`lib/actions/customer-return.actions.ts`、`app/(customer)/portal/[orgSlug]/page.tsx` |

**整體 diffstat(vs `origin/develop-saas`)**:34 files changed, +3105 / −1985。

### 驗證紀錄
- 每個 commit 前都跑過:`typecheck`(tsc --noEmit)、`lint`(eslint)、`test:all`、`prebuild:encoding`、`safety:agent-boundary`(以授權任務分支旗標 `ALLOW_OTHER_BRANCH_WORK`)。
- item 4 / 5a / 5b / 5c 各做了**多代理對抗審查**(security / correctness / completeness + 逐項獨立查證):合計 **0 個非 nit 問題**;所有 nit 不是已採納(5a rate-limit、5c token-org 斷言、5c `..` 防禦)就是已記錄(5b 舊 dashboard 死連結)。
- 最終 `test:all`:scripts-backend 26 · unit 447 · e2e 4 · integration 5,全綠。`next build` 產生的 `/portal*`、`/api/v1/upload/*` 路由正確。

---

## 3. 仍需外部授權 / 外部環境的事項(程式側無法自動完成)

| 項目 | 說明 | 風險若不做 |
|---|---|---|
| **Supabase migrations** | 正式 DB 需有 `organizations.slug`、`return_images.storage_path`、各業務表 `org_id` 等欄位(本次程式碼預期它們存在)。 | slug 解析 / org-scoped 查詢 / 圖片路徑會在 runtime 出錯。 |
| **`return-images` bucket 轉 private + storage policy** | 圖片讀取已全面走 signed URL、staging 已全 org-scoped,**現在轉 private 是安全的**。 | bucket 仍 public 時,舊 public URL 物件理論上仍可被直接存取。 |
| **正式 env secrets** | `ADMIN_SESSION_SECRET`、`UPLOAD_SESSION_SECRET`(各 ≥32)、`SCHEMA_DRIFT_ALERT_TOKEN` 等。 | admin 登入 / 上傳 / 告警端點會 fail-closed(預期的安全行為,但功能不可用)。 |
| **Strict gates / 部署** | `saas:schema-gate:strict`、`saas:predeploy`、Vercel production 設定。 | — |
| **push / 整合** | 把 `saas-security-port` 整合進 `origin/develop-saas`(見 §4)。 | — |

---

## 4. 建議的整合方式(整進 `origin/develop-saas`)

**建議:開 PR(`saas-security-port` → `develop-saas`)。**

```
# 1) push 安全分支(不碰任何既有分支)
git push -u origin saas-security-port        # 不要 --force

# 2) 在 GitHub 開 PR:base = develop-saas,compare = saas-security-port
#    讓 quality-gates.yml(CI)在 PR 上跑 lint / typecheck / test:all / 預部署 gate
```

原則:
- **不要 force push**、**不要 rebase/merge 舊的本機 `develop-saas`(12 commit 的過時線)**。
- `saas-security-port` 是從 `origin/develop-saas` 開出,7 個 commit 可直接 fast-forward 或以 PR squash/merge 進去 —— 由你決定 merge 策略。
- 若偏好不開 PR,也可直接 `git push origin saas-security-port` 後在本機快轉 `develop-saas`;但**開 PR 較佳**,可留審查紀錄並讓 CI gate 把關。

---

## 5. 上線前 checklist(多租戶正式上市)

- [ ] 套用 Supabase migrations(`org_id` / `slug` / `storage_path` 等),並用 `saas:schema-gate:strict` 驗證。
- [ ] `return-images` bucket 轉 **private** + 設定 storage policy。
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
# 看這 7 個 commit
git log --oneline origin/develop-saas..saas-security-port

# 看完整 diff
git diff origin/develop-saas...saas-security-port

# 跑全部驗證(本機)
npm run typecheck && npm run lint && npm run test:all && npm run prebuild:encoding
ALLOW_OTHER_BRANCH_WORK=I_UNDERSTAND_THIS_IS_A_NONSTANDARD_BRANCH npm run safety:agent-boundary
```
