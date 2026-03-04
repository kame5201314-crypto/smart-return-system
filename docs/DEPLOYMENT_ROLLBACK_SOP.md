# Deployment Rollback SOP

本文件用於 production 發版失敗或異常時的快速回滾。

## 1. 觸發條件

- 核心流程無法使用（掃描、入庫、AI 報告）
- `Quality Gates` 或 `Production Smoke` 持續紅燈
- `schema-gate` 顯示必要欄位缺失

## 2. 一鍵回滾（應用程式）

1. 到 Vercel 專案 `smart-return-system`
2. 在 Deployments 清單找到上一個健康版本
3. 點 `...` -> `Promote to Production`（或 `Instant Rollback`）
4. 確認 production URL 已切回舊版

## 3. 一鍵回滾（Git）

當需要把 master 也回退到穩定點，使用：

```bash
git checkout master
git pull origin master
git revert <bad_commit_sha> --no-edit
git push origin master
```

說明：

- 優先使用 `git revert`，避免破壞歷史。
- 不使用 `git reset --hard` 回退 production 歷史。

## 4. 資料庫回滾原則

- Migration 不做 destructive rollback（避免資料遺失）
- 先以「修正 migration」或「forward-fix」處理
- 針對 retention / archive 類功能，資料先搬移到 archive，再刪除主表舊資料

## 5. 回滾後驗證清單

1. `npm run test:all`
2. `npm run maintenance:smoke-shopee-scan -- --base-url=https://<production-domain>`
3. 驗證以下頁面可操作：
   - 蝦皮退貨掃描
   - 派車收件掃描
   - AI 分析報告
4. SQL 檢查：
   - `shopee_returns.is_scanned` / `is_inbound` 狀態正常
   - `shopee_scan_events` 有新資料寫入
   - `scan_audit_logs` 有狀態更新紀錄

## 6. 事故紀錄（必填）

- 事故開始時間（台灣時間）
- 影響範圍
- 根因
- 回滾版本 / commit SHA
- 修復 PR 連結
- 防呆改進項目
