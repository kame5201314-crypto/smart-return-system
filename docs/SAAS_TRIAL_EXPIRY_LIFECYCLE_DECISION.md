# SaaS 試用到期生命週期決策

狀態：Accepted
日期：2026-07-08
背景：`lib/saas/subscription-lifecycle.ts` 的 `resolveSaaSSubscriptionTimedStatus` 已定義完整的到期翻轉規則（試用到期→suspended、扣款失敗 7 天寬限→suspended、suspended 滿 30 天→cancelled）並有完整單元測試，但沒有任何 runtime 程式呼叫它。本文件記錄這是有意識的產品決策，不是實作缺口。

## 決策

Manual Beta 期間維持人工跟進與人工停權，**不接 trial expiry 自動翻轉**。

任何審查、稽核或 AI 工具若掃到「`resolveSaaSSubscriptionTimedStatus` 無 runtime caller」，應視為符合本決策的現況，不要當成 bug 修復或自行接上排程。

## 理由

- `/internal` 已會在讀取時推導 `trial_expired`：租戶清單標紅「試用已到期」、列入需關注、詳情頁給出「請聯絡客戶決定轉付費或停用」建議動作。偵測與提醒層完整。
- 手動停權／恢復的後端能力已存在（migration 033 的 `suspend_org` / `resume_org`，含審計）。
- 狀態一旦變成 `suspended`，新增退貨、AI 分析、匯出即被 `assertSaaSOrgContext` 的 writable/exportable 閘門擋下。執法層完整。
- 到期未停權的實際暴險有封頂：AI 額度依方案上限計量（10／25 次月）、退貨量為軟上限，損失是營收漏損而非成本失控。
- Beta 期自動停權反而有把「願意付費但還在溝通中」的客戶誤鎖的風險。

## 現行作業（Manual Beta）

1. 人工查看 `/internal` 需關注清單。
2. 試用到期後，人工聯絡客戶：續費、延長試用、或停用。
3. 需要停用時，由平台管理員執行 `suspend_org`。

## 觸發條件（碰到任一項即動工自動化）

1. ECPay 定期定額上線（生命週期自動化與金流同批實作，`past_due` 寬限規則此時才有意義）。
2. 租戶數多到無法每天人工看 `/internal` 需關注清單。
3. 第一次發生「到期租戶大量使用但未被發現」的實例。

## 動工時的實作範圍（一次做完整生命週期）

- 每日 cron（Supabase scheduled function 或 Vercel cron）呼叫既有 `resolveSaaSSubscriptionTimedStatus` 翻轉狀態。
- 寫入 `billing_events` 留審計軌跡。
- 接上 email 通知佇列（migration 034）通知客戶到期／停權／取消。
- 在 `assertSaaSOrgContext` 的 writable/exportable 路徑加讀取時防漏判斷，排程漏跑也擋得住。
- **前置決策**：`cancelled` 之後的資料保留／刪除政策。自動化一開，`suspended` 滿 30 天會自動變 `cancelled`，必須先定義資料何時刪除、如何通知，再啟用自動翻轉。

## 相關檔案

- `lib/saas/subscription-lifecycle.ts` — 到期翻轉規則（未接 runtime，本決策）
- `lib/saas/subscription-access.ts` — 狀態→權限對照表
- `lib/saas/org-context.ts` — writable/exportable 閘門
- `supabase/migrations/033_saas_platform_billing_operations.sql` — 手動 suspend/resume
- `supabase/migrations/034_saas_notification_email_queue.sql` — email 通知佇列
- `components/internal/platform-labels.ts` — trial_expired 需關注文案
