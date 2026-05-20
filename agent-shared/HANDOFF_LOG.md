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
