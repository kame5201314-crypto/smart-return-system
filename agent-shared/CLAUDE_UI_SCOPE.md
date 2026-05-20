# Claude UI Scope

Claude 只負責 UI / UX / frontend polish。請只在商業版 checkout 與 `develop-saas` 分支工作。

## Allowed

Claude 可以修改：

```text
app/**/page.tsx
app/**/layout.tsx
components/**
styles/**
public/**
app/globals.css
```

允許的工作：

- 公開商業網站 UI polish。
- SaaS app 內部頁面 UI。
- 退貨後台 SaaS 化視覺調整。
- responsive layout。
- empty / loading / error states。
- 表格、filter、tabs、cards、forms 的視覺與互動。
- icon、spacing、typography、Tailwind class。
- mock UI，但必須清楚標示為 demo/mock，不接真資料。

## Do Not Touch

Claude 不要修改：

```text
app/api/**
lib/actions/**
lib/saas/**
lib/config/**
lib/supabase/**
scripts/**
supabase/**
.github/**
.env*
package.json
package-lock.json
```

Claude 不要執行：

```text
supabase db push
supabase migration up
vercel deploy
vercel env
gh api branch protection writes
git push master
git push --force
```

Claude 不要做：

- 不要接 Supabase migration。
- 不要改 RLS / org_id / tenant isolation。
- 不要改 API route 或 server action 邏輯。
- 不要新增 billing / webhook 真實金流邏輯。
- 不要寫入 secret。
- 不要部署 production。

## UI Contract

UI 可以先接既有 props、static mock data 或 demo state，但不要假裝已接正式後端。

如果需要後端資料，請在 `HANDOFF_LOG.md` 留下：

- 需要的 route / action。
- 需要的資料 shape。
- loading / empty / error 狀態。
- 權限或方案限制需求。

