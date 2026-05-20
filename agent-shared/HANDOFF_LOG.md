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

