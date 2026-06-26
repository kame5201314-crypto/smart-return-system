# 商家組織多帳號管理 P1 — 規格與分工

- 日期：2026-06-13
- 分支：`develop-saas`
- 狀態：Backend/UI 已實作；migration `037_saas_team_invite_status.sql` 已於 2026-06-26 套用到 SaaS project `auyznbwtjvemyamujmgt`，`organization_invites.status` schema 缺口已解除；剩餘驗收為 `/settings/team` 瀏覽器 QA。
- 範圍：商家組織內成員管理的四項操作。**不含**平台管理員 DB 自助（P2）、MFA（P3）、email provider、public signup、billing。

## 範圍（4 項操作）

1. 成員改角色（owner/admin/staff/viewer）
2. 成員停用 / 移除
3. pending invite 撤銷
4. invite 重送 / 重新產生邀請連結

## 2026-06 QA 修正：P1 已由 `037` 補齊 invite status schema

- `organization_members` 已有 `role` 欄位（`024`）→ 改角色為 UPDATE。
- `organization_members` 已有 `status` 欄位，`'disabled'` 已是合法值（`032` 席次計算用 `COALESCE(status,'active') <> 'disabled'` 排除停用成員）→ 停用為 UPDATE。
- `organization_invites` 在程式層 / invite-policy 已支援 `pending/accepted/expired/revoked`，但實際 `024` DB schema 沒有 `status` 欄位。
- `audit_logs` 表已存在，既有 action 範例 `member.invited`（`032`）。

→ P1 的 member role / disable 可用既有 schema；invite revoke / resend 需要 `supabase/migrations/037_saas_team_invite_status.sql` 補 `organization_invites.status`，並在欄位存在後刷新 invite accept/create RPC。`037` 已於 2026-06-26 在 owner 明確授權後套用到 SaaS Supabase project `auyznbwtjvemyamujmgt`，可重新進行真實 DB 的邀請撤銷/重送 QA。

---

## A. 使用者故事

- 商家 owner/admin 可調整成員角色。
- 商家 owner/admin 可停用成員。
- owner **不能**把自己降權或停用自己。
- **不允許**停用 / 降權「最後一位 active owner」。
- staff/viewer **不能**管理成員（看得到清單，但無操作）。
- pending invite 可撤銷。
- expired / pending invite 可重送或重新產生邀請連結（取得新 token）。

## B. 權限規則（後端與前端皆須套）

| 規則 | 說明 |
|---|---|
| 僅 owner/admin 可管理團隊 | `requirements.roles: ['owner','admin']` + `writable: true` |
| owner 可管理 admin/staff/viewer | 含指派/降為任一角色 |
| admin 可管理 staff/viewer | admin **不可**管理 owner、不可把人升為 owner |
| 禁止自我降權/停用 | 操作者不可對「自己」做會失去 owner/admin 權限的動作 |
| 保護最後一位 owner | 不可停用/降權使 org 失去最後一位 active owner |
| 一律限定 org_id | 所有查詢與寫入以 `org_id` + member/invite id 為條件，不可只用 id（防 IDOR） |
| 一律寫 audit log | 每個寫入動作都記錄 actor、target、action、org_id |
| 同源防護 | 所有 mutating route 先過 `rejectCrossSiteRequest(request)` |

> 權限矩陣（誰可對誰）：
> | 操作者 \ 目標 | owner | admin | staff | viewer |
> |---|---|---|---|---|
> | owner | ⚠️ 不可動自己 | ✅ | ✅ | ✅ |
> | admin | ❌ | ✅(不可升 owner) | ✅ | ✅ |
> | staff/viewer | ❌ | ❌ | ❌ | ❌ |

---

## C. Codex 後端交辦（最小 API / server action）

> 既有慣例（請沿用，勿自創）：
> - org 守衛：`getOrgContext({ requirements: { roles: ['owner','admin'], writable: true } })`（注意是 `requirements.roles` / `requirements.writable`，非扁平）。
> - 同源：mutating route 先呼叫 `rejectCrossSiteRequest(request)`（見 `app/api/saas/team/invites/route.ts`）。
> - 既有檔：`lib/saas/team-invite-route.ts`、`lib/saas/settings-team-data.ts`、`lib/saas/invite-creation.ts` / `invite-policy.ts`。
> - audit：寫入 `audit_logs`，action 命名延續 `member.*` / `invite.*`。

| Route | 動作 | 重點檢查 |
|---|---|---|
| `PATCH /api/saas/team/members/[id]` | 改 `role`（與/或 `status`） | org_id+id 查詢；B 全部權限規則；last-owner 保護；禁自我降權；audit `member.role_changed` |
| `POST /api/saas/team/members/[id]/disable` | 停用成員（`status='disabled'`） | 同上；禁停用自己；禁停用最後 owner；audit `member.disabled` |
| （選）`DELETE /api/saas/team/members/[id]` | 移除成員 | 若採「移除」而非「停用」需定義語意（建議 Beta 先做停用，移除列為次階段）；audit `member.removed` |
| `POST /api/saas/team/invites/[id]/revoke` | 撤銷 pending invite（`status='revoked'`） | org_id+id；僅 pending 可撤；撤銷後不可再接受；audit `invite.revoked` |
| `POST /api/saas/team/invites/[id]/resend` | 重送 / 重新產生 token | 產新 token + 新 expiry；回新連結；seat/pending 上限檢查；audit `invite.resent` |

後端額外要求：
- 每個 route 回傳結構沿用既有 `{ success, data?, error?, code? }`。
- 錯誤碼分類：`role_forbidden` / `last_owner` / `self_demotion` / `seat_limit` / `not_found` / `invalid_request`。
- 補 unit tests + backend tests（涵蓋 last-owner、自我降權、跨 org IDOR、admin 不可動 owner、撤銷後不可接受）。
- 更新 `agent-shared/UI_BACKEND_CONTRACTS.md` 的 team DTO（members 列要帶「目前操作者可對此列做哪些動作」的旗標，避免 UI 自行推斷權限）。

> **建議 DTO 強化**：`TeamSettingsView.members[]` 每列加 `actions: { canChangeRole, canDisable, disabledReason? }`，`invites[]` 每列加 `actions: { canRevoke, canResend }`。讓 UI 直接依後端旗標 enable/disable 按鈕，權限判斷單一真相在後端。

---

## D. Claude UI 範圍（`app/(admin)/settings/team/page.tsx` + components）

- 成員表格每列：
  - 角色欄改為「變更角色」下拉/選單（依該列 `actions.canChangeRole` enable）
  - 加「停用」按鈕（依 `actions.canDisable` enable；`disabledReason` 作 tooltip）
  - owner 自己那列：危險操作 disable
  - 最後一位 owner：停用/降權 disable
- 邀請中（pending）每列：「複製連結」「撤銷」「重新產生」三動作。
- 互動：所有危險操作（改角色、停用、撤銷）走 **confirm dialog**；成功/失敗 **toast**。
- 狀態：loading / error / empty 沿用既有 `SettingsStateCard` 四態。
- 重新產生 invite 後：顯示新連結 + 複製按鈕（沿用 `team-invite-form.tsx` 的複製 UX）。
- RWD：成員表格窄螢幕不破版（沿用 `<Table>` overflow / 必要時加 `min-w`）。
- 文案：全繁中，沿用 `ROLE_LABEL` / `MEMBER_STATUS_LABEL` / `INVITE_STATUS_LABEL`。
- **UI 不自行判斷權限**：一律依後端 DTO 的 `actions.*` 旗標決定按鈕狀態（單一真相在後端）。

---

## E. 驗收標準

- owner 可邀請、改角色、停用 staff。
- admin 可管理 staff/viewer，但不能改 owner、不能升人為 owner。
- staff/viewer 看得到清單但所有操作 disable。
- 不能停用/降權自己。
- 不能停用/降權最後一位 active owner。
- invite 撤銷後不可再被接受。
- invite 重送/重新產生後可取得新連結，舊連結失效。
- 所有操作只影響目前 org（跨 org id 應 404/403）。
- 每個寫入都有 audit log 紀錄。
- `npm run lint` / `typecheck` / `test:all` / `saas:doctor` 通過。

---

## F. 分工

| 角色 | 負責 |
|---|---|
| **Codex** | API、server action、權限檢查、last-owner/自我降權保護、audit log、unit/backend tests、`agent-shared/UI_BACKEND_CONTRACTS.md` 的 team DTO 契約（含每列 `actions` 旗標） |
| **Claude** | UI、互動、文案、RWD、loading/error/empty、toast/confirm dialog、依後端旗標 enable/disable |

**明確不做**：migration `036`、平台管理員 DB 自助（P2）、MFA（P3）、email provider、public signup、billing/ECPay。

**已完成**：migration `037_saas_team_invite_status.sql` 已套用到 SaaS Supabase project `auyznbwtjvemyamujmgt`。後續若要部署包含此功能的 runtime，仍需 owner 另行授權部署。

## 建議實作順序

1. Codex 先定 DTO 契約（members/invites 每列 `actions` 旗標）+ 後端 route + tests。
2. Codex 交接（在 `agent-shared/UI_BACKEND_CONTRACTS.md` 寫清 DTO/route/錯誤碼）。
3. Claude 接 UI（依旗標渲染，不自行判權）。
4. 各自 gate 全綠後 commit/push。

> 依「先 contract 後 UI」紀律：權限規則（尤其 last-owner 保護）後端契約未定前，UI 不先實作，避免做錯。
