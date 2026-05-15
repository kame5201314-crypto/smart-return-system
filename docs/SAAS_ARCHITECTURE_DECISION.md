# SaaS 商業版架構決策

狀態：Accepted
日期：2026-05-15

## 決策摘要

採用「單一 codebase、雙 Vercel Project、雙 Supabase Project」。

公司內部版與對外 SaaS 版共用同一份 GitHub 程式碼，但部署、資料庫、API key、環境變數與網域完全分開。

## 最終架構

```text
GitHub repo: smart-return-system
├─ main
└─ release-saas

Vercel Project: smart-return-internal
├─ 追 main
├─ 可自動部署
├─ APP_MODE=internal
├─ 連 Supabase Internal
└─ 公司內部網域

Vercel Project: smart-return-saas
├─ 追 release-saas
├─ 不直接追 main
├─ APP_MODE=saas
├─ 連 Supabase SaaS
└─ 對外商業網域
```

## 不採用的方案

### 不共用同一個資料庫

公司內部資料不可與 SaaS 客戶資料放在同一個 Supabase Project。

原因：
- SaaS 客戶的流量、慢查詢或錯誤 migration 不應影響公司日常營運。
- 公司內部資料包含營運資訊、客戶資訊、SKU 與流程資料，不應進入客戶共用資料庫。
- 多租戶資料外洩風險會大幅提高。

### 不複製兩份專案資料夾

不要建立長期分叉的第二份 codebase。

原因：
- bug fix 需要改兩邊，容易漏改。
- migration 與商業邏輯會逐漸分歧。
- 半年後會變成兩套產品，維護成本失控。

## 分支策略

只保留兩個長期分支：

```text
main
release-saas
```

用途：
- `main`：公司內部版與主要開發線。
- `release-saas`：SaaS production 部署閘門。

不長期維護 `staging`、`saas-beta` 等多個分支。測試環境應使用 Vercel Preview 或獨立 staging project，不靠長期分支分叉。

## 部署流程

```text
開發與修復
↓
merge / push 到 main
↓
internal Vercel Project 自動部署
↓
公司內部使用 1-2 週
↓
確認穩定
↓
fast-forward merge main 到 release-saas
↓
saas Vercel Project 部署
```

鐵則：
- SaaS Project 不可直接自動追 `main`。
- 未在 internal 跑滿觀察期的新功能，不推 SaaS production。
- 緊急資安修復可縮短觀察期，但仍需先確認 build、lint、typecheck 與 smoke test。

## 環境變數原則

`APP_MODE` 只用於部署層面的安全檢查，不用來寫兩套產品邏輯。

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

正確做法：

```ts
aiLimit = org.plan.aiMonthlyLimit;
```

公司內部帳號應視為 enterprise plan：

```text
plan = enterprise
aiMonthlyLimit = 999999
billingRequired = false
```

## 必要環境隔離

Internal 與 SaaS 必須分開：

- Vercel Project
- Supabase Project
- Gemini API key
- Cron secret
- Storage bucket
- Webhook URL
- Sentry / logging project
- Domain
- Billing / payment credentials

## Migration 原則

所有 schema 變更必須進入 repo 的 migration 檔案，不可靠 Supabase Dashboard 長期手動改。

建議順序：

```text
local/dev
↓
internal Supabase
↓
觀察 1-2 週
↓
SaaS Supabase
```

規則：
- migration 寫一次，套兩邊。
- internal 先套。
- SaaS 後套。
- destructive migration 必須先有備份與 rollback / forward-fix 計畫。

## 功能限制原則

功能開關分兩類：

### 部署層級功能

適合用 env var 控制：

```text
ENABLE_PUBLIC_SIGNUP
ENABLE_BILLING
ENABLE_IMAGE_AI
APP_MODE
```

### 方案層級功能

應該用 `org.plan` 控制：

```text
AI monthly limit
user seat limit
import monthly limit
retention days
advanced analytics
```

不要因為 internal / SaaS 不同，就在程式碼中寫出兩套分支邏輯。

## AI 成本安全線

SaaS 上線前必須完成：

- Gemini 模型維持在官方支援版本。
- 退貨 AI 僅分析文字資料，不分析圖片。
- 圖片 AI 路徑預設關閉，且有 feature flag 保護。
- AI 分析有用量計數。
- AI 分析有快取，避免同一月份同一資料重複送模型。
- AI 額度由 `org.plan` 控制，不提供真正無限額度。

## 資料安全規則

- 公司資料不可匯入 SaaS DB。
- SaaS 測試資料必須使用合成資料或脫敏資料。
- SaaS 客戶資料不可回灌 internal DB。
- 每半年做一次 Supabase 備份還原演練。

## Fail-fast 防呆

應在啟動或 build 階段檢查：

- `APP_MODE=saas` 不可連 internal Supabase URL。
- `APP_MODE=internal` 不可開啟 public signup。
- `ENABLE_IMAGE_AI` 預設必須為 false。
- SaaS production 必須使用 SaaS Gemini key。
- Internal production 必須使用 internal Supabase。

## 初期落地順序

1. 完成產品安全線。
2. 維持 internal production 正常使用。
3. 建立 `release-saas` 分支。
4. 建立第二個 Vercel Project：SaaS。
5. 建立第二個 Supabase Project：SaaS。
6. 套用完整 migration 到 SaaS Supabase。
7. 建立測試 tenant 與 enterprise/internal plan 設定。
8. 封閉付費 Beta，人工開通帳號，不開公開註冊。

## 最終結論

採用：

- 一份 GitHub repo。
- `main` + `release-saas`。
- 兩個 Vercel Project。
- 兩個 Supabase Project。
- 公司版先跑，SaaS 版後推。
- 功能限制走 `org.plan`，環境安全走 `APP_MODE`。

不採用：

- 同一個資料庫同時服務公司與 SaaS 客戶。
- 複製兩份專案資料夾長期維護。
- SaaS production 自動追 `main`。
