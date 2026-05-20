# Codex Non-UI Scope

Codex 負責 UI 以外的 SaaS / 商業化底層工作。

## Ownership

Codex 負責：

- Supabase migration 設計與套用前檢查。
- `org_id` / RLS / tenant isolation。
- `getOrgContext()` 與 runtime org isolation。
- API routes。
- server actions。
- signup persistence / org creation backend。
- billing / ECPay webhook foundation。
- AI usage limit、AI cache、quota guard。
- feature flags。
- platform admin backend。
- tests、doctor、CI gate。
- docs / architecture / safety workflow。

## External Operation Rule

以下操作必須先明確取得使用者授權：

```text
git push
Supabase migration apply
Vercel deploy
Vercel env changes
GitHub branch protection writes
domain / billing / secret changes
```

目前已知阻塞：

- `GEMINI_API_KEY` 仍可能是 placeholder。
- SaaS migration 尚未套用到 `auyznbwtjvemyamujmgt`。
- SaaS DB password 需要由使用者在 Supabase Dashboard 重設或提供。
- 新 SaaS 空 DB 需要完整 migration chain `001_*` 到 `025_*`，不能只套 `023/024/025`。

## Coordination

Codex 若要改 UI 相關檔案，必須先看 `ACTIVE_WORK.md`，避免和 Claude 同時改同一批檔案。

## Routing Strategy

現階段不建立新的 `app/(app)` route group。

Authenticated SaaS app 先沿用既有：

```text
app/(admin)/**
```

理由：

- 現有 routes、middleware、proxy、auth guard 都已落在這個結構。
- 先做 SaaS backend / DB / billing / quota，避免 UI 與 routing migration 同時擴大風險。
- 未來若要從 `(admin)` 遷移到 `(app)`，由 Codex 另開 routing migration 任務處理。

Claude 可以 polish `app/(admin)` 內既有頁面，但不要搬移 route group。
