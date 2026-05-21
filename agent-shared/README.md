# Agent Shared Workspace

This folder is the shared coordination area for the SaaS commercial branch.

Purpose:

- Claude owns UI / UX / frontend polish.
- Codex owns non-UI work: database, RLS, API routes, server actions, billing, AI quota, tests, CI gates, safety docs, and platform setup analysis.
- Codex is the single maintainer for `agent-shared/**`.
- Claude should read this folder, but should not edit it. Claude handoff notes belong in the chat or commit message; Codex records durable coordination notes here.
- All durable coordination notes, task ownership, and handoffs live here.

Required branch:

```text
develop-saas
```

Protected areas:

- Do not work in the live production checkout.
- Do not push to `master`.
- Do not deploy Vercel Production.
- Do not apply Supabase migrations without explicit approval and target project confirmation.
- Do not commit secrets.

Required preflight before any write:

```powershell
Get-Location
git status -sb
git remote -v
git branch -vv
npm run safety:agent-boundary
```

Files:

- `CLAUDE_UI_SCOPE.md`: Claude UI ownership rules.
- `CODEX_NON_UI_SCOPE.md`: Codex non-UI ownership rules.
- `TASK_BOARD.md`: shared task board.
- `ACTIVE_WORK.md`: current file ownership to avoid conflicts.
- `HANDOFF_LOG.md`: handoff history.
- `REVIEW_CHECKLIST.md`: checklist before handoff, commit, and push.
- `UI_BACKEND_CONTRACTS.md`: data contracts between Claude UI mocks and Codex backend wiring.

Rule of thumb:

- If it changes what users see, Claude can usually own it.
- If it changes data, security, auth, billing, AI cost, API behavior, migrations, or platform state, Codex owns it.

Concurrency rule:

- Prefer serialized work in one shared working tree: one agent edits, commits, and pushes before the next agent starts.
- `agent-shared/**` is a coordination log, not a hard git lock.
- Do not rely on two agents editing `ACTIVE_WORK.md` at the same time; that can overwrite the claim itself.
- Claude declares file scope in the chat or commit message. Codex updates `agent-shared/**` after the handoff.
