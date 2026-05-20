# Agent Shared Workspace

這個資料夾是商業版 `develop-saas` 的 Codex / Claude 協作區。

用途：

- Claude 負責 UI / UX / frontend polish。
- Codex 負責非 UI 工作：DB schema、RLS、API、server actions、billing、AI quota、tests、CI gate、文件與安全邊界。
- 所有協作紀錄、待辦與交接都集中在此資料夾。

固定工作資料夾：

```text
D:\AI專案\AI退貨系統商業版_2026.5.16
```

固定分支：

```text
develop-saas
```

禁止操作：

```text
D:\AI專案\AI退貨管理系統\smart-return-system
master
Vercel Production
Supabase Production / internal DB
```

每次開始前都要執行：

```powershell
Get-Location
git status -sb
git remote -v
git branch -vv
npm run safety:agent-boundary
```

如果看到未提交變更，先停下回報，不要自行還原。

## Files

- `CLAUDE_UI_SCOPE.md`：Claude 可做與不可做的 UI 範圍。
- `CODEX_NON_UI_SCOPE.md`：Codex 負責的非 UI 範圍。
- `TASK_BOARD.md`：共同任務板。
- `ACTIVE_WORK.md`：目前誰正在碰哪些檔案，避免衝突。
- `HANDOFF_LOG.md`：每次交接紀錄。

