# 上市版保護與 SaaS 改造工作規範

日期：2026-05-15
狀態：Active
目的：保護目前已上市的 AI 退貨系統，避免 SaaS 商業化改造影響既有使用者。

## 目前執行狀態

已完成：

- 已把目前上市穩定版鎖定在 tag：`internal-stable-2026-05-15`。
- 已建立 SaaS 改造分支：`develop-saas`。
- 已將 SaaS 改造工作推到 `develop-saas`，`master` 保持上市版穩定狀態。
- 已在 `develop-saas` 加上 GitHub Actions quality gate，包含 lint、typecheck、完整測試與 build。

尚未由程式碼自動完成、需在外部平台操作：

- 建立第二個 Vercel Project：SaaS 專用。
- 建立第二個 Supabase Project：SaaS 專用。
- SaaS Vercel Project 的 production branch 必須設定為 `develop-saas`。
- SaaS Vercel Project 必須使用 SaaS Supabase env，不可使用公司 production Supabase env。
- SaaS Gemini API key、cron secret、webhook、logging/Sentry、domain、billing credentials 都需與上市版分開。

## 重要紀錄

目前 AI 退貨系統已上市，`master` 必須視為 production 穩定版。
任何 SaaS 商業化、訂閱制、多租戶、計費、公開註冊、方案限制等改造，都不可直接進入 `master`。

本 repo 不複製第二份專案資料夾，也不拆成第二個長期 repo。
正確做法是：同一份 repo，使用分支、部署環境與資料庫隔離風險。

## 分支角色

```text
master
```

用途：

- 已上市穩定版。
- 目前 production 使用。
- 只接受 critical bug fix、資安修復、資料安全修復。
- 不接受 SaaS 改造功能。

```text
develop-saas
```

用途：

- SaaS 商業版改造。
- 計費、方案、用量限制、多租戶、封閉 Beta、商業版 onboarding 都在此分支進行。
- 連接新的 SaaS Vercel Project 與新的 SaaS Supabase Project。

## 嚴格禁止

- 不可把 SaaS 改造 commit 直接推到 `master`。
- 不可從 `develop-saas` 直接 merge 回 `master`。
- 不可 force push 到 `master`。
- 不可用 `git reset --hard` 修改 production 歷史。
- 不可把公司 production 資料匯入 SaaS DB。
- 不可讓 SaaS Vercel Project 連到公司 production Supabase。
- 不可讓公司 production Vercel Project 連到 SaaS Supabase。

## 立即保護動作

SaaS 改造開始前，先對目前穩定版打 tag：

```bash
git checkout master
git pull
git tag internal-stable-2026-05-15
git push origin internal-stable-2026-05-15
```

建立 SaaS 改造分支：

```bash
git checkout master
git checkout -b develop-saas
git push -u origin develop-saas
```

## Bug Fix 流程

上市版 bug 修復流程：

```text
1. 從 master 修 bug
2. 跑 build / lint / typecheck / test
3. push master
4. 確認 production 正常
5. cherry-pick 同一個 bug fix 到 develop-saas
6. push develop-saas
```

範例：

```bash
git checkout master
# 修 bug
git commit -m "fix: ..."
git push

git checkout develop-saas
git cherry-pick <bug-fix-commit-hash>
git push
```

## SaaS 功能開發流程

```text
1. checkout develop-saas
2. 開發 SaaS 功能
3. 跑 build / lint / typecheck / test
4. push develop-saas
5. 部署到 SaaS Vercel Project
6. 使用 SaaS Supabase 測試
```

SaaS 功能不得回到 `master`，除非日後另行決策正式切換產品架構。

## 發版前檢查

任何推到 `master` 的 production 修復，至少要通過：

```bash
npm run build
npm run lint
npx tsc --noEmit
npm run test:unit
```

如果時間緊急，仍需至少完成：

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
```

並手動 smoke check：

- 登入後台。
- 蝦皮退貨列表可載入。
- 退貨明細可載入。
- 掃描狀態與入庫狀態仍分開。
- AI 分析可產生或讀取歷史報告。

## Production 出事時

先救服務，不先改 git。

正確順序：

1. 到 Vercel Dashboard rollback 到上一個正常 deployment。
2. 確認使用者可正常使用。
3. 再回本機檢查 commit、logs、migration。
4. 用新的修復 commit 解決問題。

禁止：

```bash
git reset --hard
git push --force
```

## Feature Flag 原則

SaaS 新功能要可開關，避免一次影響所有使用者。

應用範圍：

- public signup
- billing
- subscription plan
- AI usage limit
- advanced analytics
- multi-tenant admin

原則：

- 先對 1-2 個 Beta 客戶開。
- 確認穩定後再擴大。
- 出問題先關 flag，不急著 rollback 程式碼。

## 資料安全

- 公司 production DB 不可作為 SaaS 測試 DB。
- SaaS 測試資料需使用合成資料或脫敏資料。
- migration 必須進 repo，不可靠 Dashboard 手動長期維護。
- destructive migration 前必須備份。

## 時程限制

`develop-saas` 不應長期拖延。
目標是在 8-12 週內做到可封閉付費 Beta。

若 SaaS 改造超過 3 個月仍未完成，需重新檢討範圍，避免 `master` 與 `develop-saas` 分歧過大。

## 最終規則

```text
master = 保護上市版
develop-saas = SaaS 改造
bug fix = master 先修，再 cherry-pick 到 develop-saas
SaaS 功能 = 只進 develop-saas
production 出事 = Vercel rollback 先救火
```
