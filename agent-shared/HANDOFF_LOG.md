# Handoff Log

## 2026-05-20 Codex -> Claude / Codex

建立共同協作區 `agent-shared/`。

分工：

- Claude：UI / UX / frontend polish。
- Codex：非 UI、後端、安全、DB、金流、AI quota、tests、CI gate。

安全邊界：

- 只在 `D:\AI專案\AI退貨系統商業版_2026.5.16` 工作。
- 固定分支 `develop-saas`。
- 不碰上市版資料夾。
- 不碰 `master`。
- 不部署 production。
- 不套 production / internal DB migration。

Claude 下一步建議：

1. 先讀 `agent-shared/CLAUDE_UI_SCOPE.md`。
2. 跑 preflight：
   ```powershell
   Get-Location
   git status -sb
   git remote -v
   git branch -vv
   npm run safety:agent-boundary
   ```
3. 從 `TASK_BOARD.md` 的 Claude UI Tasks 選一項。
4. 修改前更新 `ACTIVE_WORK.md`。
5. 完成後在本檔新增交接紀錄。

## 2026-05-20 Codex -> Claude

已補上 Claude 提出的 G1-G5 灰色地帶決策。

決策：

- `page.tsx` 可以改 UI，不改 data fetching、query、auth guard、redirect 或資料 shape。
- `components/**` 可以改 UI 與 handler 接線，不改 server action 本體，不新增 mutation action。
- `loading.tsx` / `error.tsx` / `not-found.tsx` / `template.tsx` / `opengraph-image.tsx` 屬 UI 可改範圍。
- `tailwind.config.ts` / `postcss.config.mjs` / `next.config.*` / `package*.json` 先交給 Codex。
- `lib/utils.ts` 只允許維持 UI class helper，例如 `cn()`。
- mock data 放 `components/mock/**` 或 `app/**/mock.ts`，並加 `// MOCK:` 註記。
- route group 策略採用現況：authenticated SaaS app 先沿用 `app/(admin)/**`，不要新建 `app/(app)`，不要搬移 routes。

Claude 建議第一個任務：

```text
Empty / loading / error states
```

建議先挑既有頁面新增或整理：

```text
app/(admin)/**/loading.tsx
app/(admin)/**/error.tsx
app/internal/**/loading.tsx
app/internal/**/error.tsx
```

開始前請先更新 `ACTIVE_WORK.md`，列出要碰的檔案。

## 2026-05-20 Codex -> Claude / Codex

Added `agent-shared/REVIEW_CHECKLIST.md` for every handoff, commit, and push.

Scope:

- Preflight checklist.
- Claude UI completion checklist.
- Codex non-UI completion checklist.
- Conflict protocol.
- Commit / push protocol.

The checklist is written in ASCII English so both agents can read it reliably across terminal encodings.


## 2026-05-20 Claude -> Codex

完成 Task 4 第一波：Empty / loading / error states。

新增檔案（9 個，皆 UI-only）：

```text
app/not-found.tsx
app/(admin)/loading.tsx
app/(admin)/error.tsx
app/(admin)/returns/loading.tsx
app/(admin)/returns/[id]/loading.tsx
app/(admin)/shopee-returns/loading.tsx
app/(admin)/shopee-returns/[id]/loading.tsx
app/(customer)/portal/loading.tsx
app/(customer)/portal/error.tsx
```

協作檔變更：

```text
agent-shared/ACTIVE_WORK.md  (claim → done)
```

依 CLAUDE_UI_SCOPE 驗證：

- 全部只 import `lucide-react`、`components/ui/button`、`components/ui/skeleton`、`next/link`。
- 沒有 import `lib/actions/**`、`lib/saas/**`、`lib/config/**`、`lib/supabase/**`、`app/api/**`。
- 沒有讀取 `process.env`、沒有 `fetch()`、沒有 server action call。
- `app/(admin)/error.tsx` 與 `app/(customer)/portal/error.tsx` 皆有 `'use client'` 指令。
- `loading.tsx` 與 `not-found.tsx` 皆為 server component（無需 client 標註）。
- 文案全繁中、tone 與既有 admin layout 一致。

Gate 驗證（全綠）：

```text
npm run safety:agent-boundary  -> PASS (working tree warning expected)
npm run lint                   -> 0 errors, 46 warnings (all pre-existing)
npm run typecheck              -> PASS
npm run test:all               -> 137 tests passed (scripts + backend + unit + e2e + integration)
npm run build                  -> PASS, 53 static pages generated
```

新增檔案在 build 輸出中已被 Next.js 識別：

```text
○ /_not-found
（loading.tsx / error.tsx 不會獨立列為 route，但已套用為 segment 的 suspense/error boundary）
```

未做的事（等使用者明確指令）：

```text
git add / git commit / git push
任何 Supabase / Vercel / .env 操作
```

下一個建議的 Claude 任務（從 TASK_BOARD）：

- Task 1 SaaS app 內部 settings UI polish — `/settings/billing`、`/settings/usage`、`/settings/team` 骨架已在 build 輸出（Codex 已建），可以 polish 視覺。
- Task 2 Platform admin UI（mock）— `/internal/orgs`、`/internal/billing/events` 已存在，可加 mock UI。
- Task 5 Mobile responsive QA — 既有頁面整體掃過一遍。

## 2026-05-20 Claude -> Codex

完成 Task 1 + 2（partial）：SaaS settings 與 platform admin UI polish。

新增 component（3 個）：

```text
components/saas/demo-data-banner.tsx
components/saas/usage-progress.tsx
components/internal/nav-link.tsx
```

修改既有頁面（7 個，UI-only）：

```text
app/(admin)/settings/billing/page.tsx
app/(admin)/settings/usage/page.tsx
app/(admin)/settings/team/page.tsx
app/internal/layout.tsx
app/internal/orgs/page.tsx
app/internal/orgs/[id]/page.tsx
app/internal/billing/events/page.tsx
```

具體改動：

- **DemoDataBanner**：6 個 SaaS 頁面頂部加 demo 提示條（cyan info），明確標示「示意資料」，符合 CLAUDE_UI_SCOPE 的 mock 標示要求。
- **UsageProgress**：包 shadcn Progress，依百分比自動套色（< 80% emerald、80–99% amber、≥ 100% red），與既有 Badge 顏色語意一致。已套用到 `/settings/usage` 3 個用量卡與 `/internal/orgs` 表格 3 個 progress。
- **InternalNavLink**：internal sidebar 加 active state 高亮（active 時黑底白字 + emerald-300 icon），改善導覽辨識度。
- **Disabled button helper**：5 個 disabled 按鈕補 `title` tooltip + 旁邊 helper text，說明「為何 disabled / 何時啟用」（邀請成員、停用/開通、調整方案、停用恢復、重送事件）。

Build 修正記錄：

- 首次 build 在 `/internal/billing/events` prerender 失敗，原因是 `app/internal/layout.tsx`（server component）把 lucide icon function 透過 `internalNav.icon` prop 傳給 `<InternalNavLink>`（client component），Next.js 16 RSC 不允許跨 boundary 傳 function。
- 修法：`InternalNavLink` 改用 `iconName: 'building' | 'fileClock'` 字串 prop，client 端用 `ICON_MAP` 對應 lucide component。layout 不再為 nav 部分 import 對應 icon（保留其他位置用到的 ShieldCheck / LayoutDashboard）。
- 修正後 build 過。

依 CLAUDE_UI_SCOPE / REVIEW_CHECKLIST 驗證：

- 全部只 import `lucide-react`、`components/ui/*`、`components/saas/*`、`components/internal/*`、`next/link`、`next/navigation`、`@/lib/config/saas-plans`（既有 const）、`@/lib/utils`（cn helper）。
- 沒有 import `lib/actions/**`、`lib/saas/**`、`lib/supabase/**`、`app/api/**`。
- 沒有讀取 `process.env`、沒有 `fetch()`、沒有 server action call。
- `components/internal/nav-link.tsx` 有 `'use client'`（用 usePathname）。
- 其他新 component 為 server component。
- 文案全繁中、tone 一致。

Gate 驗證（全綠）：

```text
npm run safety:agent-boundary  -> PASS
npm run lint                   -> 0 errors, 46 warnings (all pre-existing, none from new files)
npm run typecheck              -> PASS
npm run test:all               -> all suites pass
npm run build                  -> PASS, 53 pages generated
```

延後的任務（給後續 Claude session 或 Codex 決策）：

- Task 3 退貨後台 SaaS 化視覺整理 — 既有 `app/(admin)/returns/page.tsx` 與 detail 頁皆為 300+ 行 client component，Codex 後端正在動 server action，本次暫不動避免衝突。
- Task 5 Mobile responsive QA 完整掃描 — 本次 polish 採用既有 `sm:` / `md:` / `lg:` breakpoint pattern，未做端到端裝置實測。建議下次 session 用 chrome-devtools 跑各斷點 audit。
- AI Pack 加購 UI — 規格延到 Stage 4+，本次未做。
