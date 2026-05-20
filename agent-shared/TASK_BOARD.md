# Shared Task Board

狀態標記：

- `todo`
- `in_progress`
- `blocked`
- `done`

## Claude UI Tasks

| Status | Task | Notes |
|---|---|---|
| todo | Empty / loading / error states | 建議 Claude 先做；可新增 `app/**/loading.tsx`, `error.tsx`, `not-found.tsx` |
| todo | SaaS app 內部 settings UI polish | 使用既有 `app/(admin)/settings/**`，不要新建 `app/(app)` |
| todo | Platform admin UI polish | 使用既有 `app/internal/**`；只做 mock UI，不接 live data |
| todo | 退貨後台 SaaS 化視覺整理 | 不改 server action，不改 API |
| todo | Mobile responsive QA | 公開頁與 app 內部頁 |

Current routing decision:

```text
Use existing app/(admin) for authenticated SaaS app pages.
Do not create app/(app) in Claude UI work.
```

## Codex Non-UI Tasks

| Status | Task | Notes |
|---|---|---|
| blocked | SaaS migrations apply | 等 SaaS DB password + 使用者授權；新空 DB 要 `001_*` 到 `025_*` |
| todo | signup persistence backend | 需 migration 套用後接 `organization_invites` / org creation flow |
| todo | platform admin live data wiring | 需 DB migration 與 feature flag 授權 |
| todo | billing foundation | ECPay env / webhook / idempotency；正式金流需測試金鑰與授權 |
| todo | AI quota enforcement hardening | 確認所有 AI entrypoint 都走 org.plan quota |
| todo | SaaS predeploy strict gate | 需 Gemini key 與 migration 狀態確認 |

## Shared Rules

- 新功能不要直接全量開啟。
- UI 可先 mock，但必須清楚標示。
- 後端不可假資料上正式路徑。
- 不要操作上市版資料夾。
- 不要推 `master`。
