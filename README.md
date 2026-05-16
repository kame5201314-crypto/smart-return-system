# AI 退貨管理系統商業版

這個資料夾是 SaaS / 商業版改造用 checkout，必須和已上市舊版分開操作。

- 目前分支：`develop-saas`
- SaaS Vercel Project：`smart-return-system-saas`
- SaaS Vercel Project ID：`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`
- 已上市舊版 Vercel Project ID：`prj_aaRiMeML9D4G7U71QRDZYVonLH8h`

## 重要原則

- 不要在這個資料夾部署到已上市舊版 Vercel Project。
- 不要把 SaaS 專用 env 指到已上市舊版 Supabase。
- 不要把公司內部或已上市資料匯入 SaaS Supabase。
- 不要提交 `.env.saas.local`、`.env.local`、`.vercel/` 或任何金鑰。
- SaaS 部署只允許從 `develop-saas` 進行。
- 已上市舊版只在 `master` 修 critical bug，SaaS 改造不要 merge 回 `master`。

## 系統定位

本系統用於退貨流程管理與退貨文字資料分析，包含：

- 蝦皮 / 商城 / 其他退貨資料匯入
- 退貨訂單管理、驗貨、入庫、掃描、派車收件
- 買家備註、退貨原因、退貨原因備註與管理備註
- AI 退貨分析報告
- 掃描紀錄、未匹配掃描、掃描 KPI
- 備份、schema gate、部署前檢查與一致性檢查

## AI 成本與圖片路徑

退貨 AI 分析只應分析文字資料，不分析圖片。

- 文字模型：`gemini-2.5-flash-lite`
- SaaS 預設：`ENABLE_IMAGE_AI=false`
- 退貨 AI prompt 應只包含訂單、商品、貨號、退貨原因、買家備註、退貨原因備註、驗貨結果等文字欄位
- 舊的 `backend/` 圖片審查路徑不得在 SaaS 退貨分析流程中啟用

## 技術架構

- Frontend / Backend：Next.js App Router
- Database：Supabase Postgres
- AI：Google Gemini text model
- Deployment：Vercel
- Test：Vitest

## 本機開發

```bash
npm ci
npm run dev
```

常用檢查：

```bash
npm run lint
npm run typecheck
npm run test:all
npm run build
```

## SaaS 專用檢查

在商業版 checkout 先確認沒有連錯專案：

```bash
npm run saas:verify-checkout
```

查看目前 SaaS 上線準備狀態：

```bash
npm run saas:doctor
```

建立 `.env.saas.local` 後，才能執行 SaaS strict 檢查：

```bash
npm run saas:verify-env
npm run saas:doctor:strict
npm run saas:predeploy
```

`.env.saas.local` 請從 `.env.saas.example` 複製後填入 SaaS 專用值，不要使用已上市舊版 Supabase 或 Gemini key。

## 部署前必要條件

SaaS 正式部署前必須完成：

- 建立 SaaS 專用 Supabase Project
- 填入 SaaS 專用 Supabase URL / anon key / service role key
- 填入 SaaS 專用 Gemini API key
- Vercel Project production branch 確認為 `develop-saas`
- 跑過 `npm run saas:predeploy`
- 只對 SaaS Supabase 套用 migration
- 完成登入、匯入、退貨列表、退貨明細、掃描、AI 報告、備註、匯出 smoke test

## 相關文件

- `docs/LIVE_PROTECTION_AND_SAAS_WORKFLOW.md`
- `docs/SAAS_ARCHITECTURE_DECISION.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `docs/DEPLOYMENT_ROLLBACK_SOP.md`
