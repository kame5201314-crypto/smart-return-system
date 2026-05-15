# SaaS 商業版架構決策

狀態：Accepted
日期：2026-05-15
修正原因：目前 AI 退貨系統已上市，上市版必須被保護，SaaS 改造不可直接影響既有使用者。

## 決策摘要

採用「單一 repo、雙長期分支、雙 Vercel Project、雙 Supabase Project」。

不複製第二份專案資料夾，也不建立第二個長期 repo。
原因是退貨管理、掃描、AI 分析與匯入規則仍是同一個產品核心；若複製兩份，bug fix、migration 與商業邏輯會快速分歧。

但因為目前系統已上市，`master` 必須視為穩定上市版，不再承接 SaaS 改造。

## 最終架構

```text
GitHub repo: smart-return-system
├─ master
│  ├─ 已上市穩定版
│  ├─ 只接受 critical bug fix / production hotfix
│  ├─ 目前 Vercel production 追這條
│  └─ 連 Supabase Internal / 現有 production DB
│
└─ develop-saas
   ├─ SaaS 商業版改造分支
   ├─ 計費、方案、用量限制、多租戶、封閉 Beta 都在這裡做
   ├─ 新 SaaS Vercel Project 追這條
   └─ 連全新的 SaaS Supabase Project
```

## 核心原則

- 不動已上市版：SaaS 改造不可直接進 `master`。
- 不複製資料夾：不要建立 `smart-return-system-saas` 這類第二份長期 codebase。
- 不共用資料庫：公司 / 既有 production 資料不可與 SaaS 客戶資料共用 Supabase Project。
- 不從 SaaS 分支回灌上市版：除非 SaaS 改造完成、穩定，並且另行決策全面切換。
- production 出事先 rollback：不要用 `git reset --hard` 或 force push 救火。

## 分支策略

只保留兩條長期分支：

```text
master
develop-saas
```

用途：

- `master`：已上市穩定版。只修 production bug、資安問題、資料安全問題。
- `develop-saas`：SaaS 改造主線。所有商業化功能在這裡開發與測試。

不採用長期 `main`、`production`、`release-saas` 三分支模型。
原因是目前 SaaS 改造會碰到核心邏輯，若多一條中介分支，容易產生「到底哪些 commit 要不要進上市版」的混亂。

## Bug Fix 同步規則

上市版 bug 一律先從 `master` 修：

```text
master 修 bug
↓
push 到 production
↓
確認 production 正常
↓
cherry-pick 同一個 bug fix 到 develop-saas
```

禁止反方向：

```text
develop-saas → master
```

除非該 commit 是明確、低風險、與 SaaS 改造無關的 hotfix，且已人工 review。

## 部署策略

### 已上市版

```text
master
↓
現有 Vercel production
↓
現有 Supabase Internal / production DB
```

規則：

- 目前上市版不可自動接收 SaaS 改造 commit。
- `master` 發版前必須跑 build、lint、typecheck、測試與 smoke check。
- destructive migration 必須先備份，且需有 forward-fix / rollback 計畫。

### SaaS 改造版

```text
develop-saas
↓
新 SaaS Vercel Project
↓
新 SaaS Supabase Project
```

規則：

- SaaS Vercel Project 只能追 `develop-saas`。
- SaaS DB 必須是全新 Supabase Project，不放公司既有資料。
- 初期只做封閉 Beta，人工開通，不開公開註冊。

## 環境隔離

Internal / 已上市版與 SaaS 必須分開：

- Vercel Project
- Supabase Project
- Gemini API key
- Cron secret
- Storage bucket
- Webhook URL
- Sentry / logging project
- Domain
- Billing / payment credentials

## 環境變數原則

`APP_MODE` 只用於部署安全檢查，不用來寫兩套產品邏輯。

允許：

```ts
if (APP_MODE === 'saas' && SUPABASE_URL.includes('internal')) {
  throw new Error('SaaS cannot connect to internal database');
}
```

避免：

```ts
if (APP_MODE === 'internal') {
  aiLimit = Infinity;
}
```

正確做法是用方案控制：

```ts
aiLimit = org.plan.aiMonthlyLimit;
```

公司內部帳號應視為 enterprise plan：

```text
plan = enterprise
aiMonthlyLimit = 999999
billingRequired = false
```

## Feature Flag 原則

SaaS 新功能應以 feature flag 漸進開放：

- billing
- public signup
- AI usage limit
- multi-tenant admin
- subscription plan enforcement

即使未來 SaaS 功能穩定，也不可一次全員開啟。
先開給 1-2 個 Beta 客戶，確認無問題後再擴大。

## AI 成本安全線

SaaS 上線前必須維持：

- Gemini 模型使用官方支援版本。
- 退貨 AI 僅分析文字資料，不分析圖片。
- 圖片 AI 路徑預設關閉，且有 feature flag 保護。
- AI 分析有用量計數。
- AI 分析有快取，避免同一月份同一資料重複送模型。
- AI 額度由 `org.plan` 控制，不提供真正無限額度。

## Migration 原則

所有 schema 變更必須進入 repo 的 migration 檔案，不可靠 Supabase Dashboard 長期手動改。

上市版規則：

- `master` migration 只允許必要 production 修復。
- destructive migration 必須先備份。
- migration 套用前後都要檢查核心資料筆數與欄位。

SaaS 規則：

- SaaS migration 從 `develop-saas` 管理。
- SaaS DB 使用全新 Supabase Project。
- 不可把公司 production 資料匯入 SaaS DB。

## 緊急應變

production 出事時：

1. 先用 Vercel Dashboard rollback 回上一個正常部署。
2. 確認使用者恢復服務。
3. 再回 repo 查問題。
4. 用正常 commit 修復。

禁止：

- `git reset --hard` 修 production 歷史。
- force push 到 `master`。
- 在 Supabase production 直接亂改 schema。

## 初期落地順序

1. 目前 `master` 視為已上市穩定版。
2. 對目前穩定版打 tag，例如 `internal-stable-2026-05-15`。
3. 從 `master` 建立 `develop-saas`。
4. 建立第二個 Vercel Project：SaaS。
5. 建立第二個 Supabase Project：SaaS。
6. 將 SaaS env 與 Internal env 完全分開。
7. SaaS 改造只在 `develop-saas` 做。
8. 上市版 bug 從 `master` 修，再 cherry-pick 到 `develop-saas`。

## 最終結論

採用：

- 一份 GitHub repo。
- 兩條長期分支：`master` + `develop-saas`。
- 兩個 Vercel Project。
- 兩個 Supabase Project。
- 上市版優先保護，SaaS 改造隔離進行。

不採用：

- 複製第二份專案資料夾。
- 兩個長期 repo。
- SaaS 改造直接推進 `master`。
- 公司資料與 SaaS 資料共用同一個 DB。
