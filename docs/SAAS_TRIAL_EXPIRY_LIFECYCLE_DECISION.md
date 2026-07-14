# SaaS 試用到期生命週期決策

狀態：Accepted（2026-07-14 修訂）
日期：2026-07-08；修訂：2026-07-14
背景：`lib/saas/subscription-lifecycle.ts` 已定義完整的訂閱生命週期規則。Google 自助試用會提高租戶建立速度，因此達成原決策的自動化觸發條件；本次只啟用最小必要的「試用到期暫停」，不啟用完整付款或資料保留生命週期。

## 決策

Google 自助試用啟用時，以每日 scoped cron 處理到期租戶：

- 僅處理目前仍為 `trialing` 且 `trial_end <= now()` 的訂閱。
- 唯一允許的翻轉是 `trialing -> suspended`，原因固定為 `trial_expired`。
- 不處理 `active`、`past_due`、既有 `suspended` 或 `cancelled`。
- 不自動轉為 `cancelled`，不刪除任何客戶、會員、退貨或圖片資料。
- 每次成功暫停都寫入 `audit_logs`。
- `ENABLE_TRIAL_EXPIRY_CRON` 預設關閉；040、041 套用並完成 smoke test 後才能啟用。

## 理由

- `/internal` 已會在讀取時推導 `trial_expired`：租戶清單標紅「試用已到期」、列入需關注、詳情頁給出「請聯絡客戶決定轉付費或停用」建議動作。偵測與提醒層完整。
- 手動停權／恢復能力仍保留（migration 033 的 `suspend_org` / `resume_org`）。
- 狀態一旦變成 `suspended`，新增退貨、AI 分析、匯出即被 `assertSaaSOrgContext` 的 writable/exportable 閘門擋下。執法層完整。
- migration 041 的 RPC 會在同一交易內鎖定訂閱並再次確認狀態與到期時間，避免剛完成付款的租戶被競態誤停。
- 客戶暫停後仍能查看歷史資料與方案資訊，並看到升級與聯絡客服入口。

## 現行作業

1. cron 每日掃描已到期且仍為 `trialing` 的訂閱。
2. TypeScript worker 只接受 `resolveSaaSSubscriptionTimedStatus` 回傳 `trial_expired` 的候選。
3. migration 041 RPC 在資料庫交易內重新驗證後，原子更新 organization、subscription 並寫 audit log。
4. 平台管理員仍可於 `/internal` 人工恢復或處理付款。

## 啟用前置

1. migration 040 與 041 只套用到 SaaS Supabase project `auyznbwtjvemyamujmgt`。
2. Production 已設定有效 `CRON_SECRET`。
3. 先以旗標關閉狀態部署並確認 route 以成功略過回應 `trial_expiry_cron_disabled`。
4. 使用 disposable QA org 驗證：未到期不變、已到期轉 suspended、重跑冪等、active 不會被暫停。
5. 驗證通過後才設定 `ENABLE_TRIAL_EXPIRY_CRON=true`。

## 明確不做

- 不自動處理付款失敗或 `past_due`。
- 不執行 `suspended -> cancelled`。
- 不刪除任何資料，也不啟用 retention deletion。
- 不依賴 email provider；Email 實寄仍維持獨立旗標與 rollout。
- 不啟用 ECPay 或 public paid signup。

## 相關檔案

- `lib/saas/subscription-lifecycle.ts` — 生命週期判斷；scoped worker 只採用 trial_expired 分支
- `lib/saas/trial-expiry-worker.ts` — 到期候選與 scoped 執行器
- `app/api/cron/saas/trial-expiry/route.ts` — fail-closed cron route
- `lib/saas/subscription-access.ts` — 狀態→權限對照表
- `lib/saas/org-context.ts` — writable/exportable 閘門
- `supabase/migrations/033_saas_platform_billing_operations.sql` — 手動 suspend/resume
- `supabase/migrations/041_saas_scoped_trial_expiry.sql` — 交易內重新驗證與原子暫停
- `components/saas/workspace-access-banner.tsx` — 唯讀狀態與升級入口
- `components/internal/platform-labels.ts` — trial_expired 需關注文案
