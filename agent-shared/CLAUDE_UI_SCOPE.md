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

## Edge Cases

### Server Component Pages

`app/**/page.tsx` 屬於 Claude 可改範圍，但只限 UI：

- 可以改 JSX、layout、className、copy、icons、visual states。
- 可以新增 loading / empty / error UI。
- 不要改 Supabase query、server action call、auth guard、redirect 邏輯或資料 shape。
- 若 UI 需要新的資料欄位，請在 `HANDOFF_LOG.md` 寫清楚需要的資料 shape，交給 Codex 接後端。

### Components With Server Actions

`components/**` 可改 UI，但若 component 已 import server action：

- 可以改 props 命名、顯示邏輯、按鈕位置與 event handler 接線。
- 不要改 server action 本體。
- 不要新增新的 mutation action import。
- 需要新 action 時，請交給 Codex。

### Additional UI Files

Claude 可以新增或修改：

```text
app/**/loading.tsx
app/**/error.tsx
app/**/not-found.tsx
app/**/template.tsx
app/**/opengraph-image.tsx
lib/utils.ts
```

`lib/utils.ts` 只允許維持 UI class helper，例如 `cn()`；不要放 business logic。

### Root Config

以下檔案看起來和 UI 有關，但先由 Codex owner，Claude 要動前請 HANDOFF：

```text
tailwind.config.ts
postcss.config.mjs
next.config.*
tsconfig.json
package.json
package-lock.json
```

### Route Group Strategy

目前 authenticated SaaS app 暫時沿用既有：

```text
app/(admin)/**
```

不要新建 `app/(app)`，也不要搬移現有 route group。等 Codex 另開 routing migration 任務時再處理。

Claude 可以 polish 既有：

```text
app/(admin)/settings/**
app/internal/**
```

但不要改 auth / middleware / proxy / route protection。

### Mock Data

mock data 放這兩種位置之一：

```text
components/mock/**
app/**/mock.ts
```

請加上明確註記：

```ts
// MOCK: replace with real SaaS data after backend wiring.
```

mock UI 不要讀 `.env*`，不要打 API，不要寫 DB。
