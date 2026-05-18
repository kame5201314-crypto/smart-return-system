# AGENTS.md

## Language

- Default response language: Traditional Chinese (`zh-TW`).
- Keep code, identifiers, commands, file paths, and environment variable names as-is.

## Critical Production Boundary

This repository contains an already-live return management system. Treat the live version as protected production.

Do not modify, commit to, push to, deploy, migrate, or otherwise change the live version unless the user explicitly says the change is for the live/production/master version.

## Fixed Work Areas

| Purpose | Path | Expected branch | Rule |
|---|---|---|---|
| Live return system | `D:\AI專案\AI退貨管理系統\smart-return-system` | `master` for live work, `develop-saas` for SaaS work in this checkout | Do not touch `master` unless explicitly instructed. |
| SaaS commercial version | `D:\AI專案\AI退貨系統商業版_2026.5.16` | `develop-saas` | SaaS changes belong here or on `develop-saas`. |
| AI listing system | Any `AI自動上架` path | unrelated | Do not read/write unless the user explicitly asks for that project. |

If the current folder, branch, or remote does not match the requested task, stop and report the mismatch.

## Mandatory Preflight Before Any Write

Before editing files, committing, pushing, deploying, running migrations, or changing platform settings, run and inspect:

```powershell
Get-Location
git status -sb
git remote -v
git branch -vv
npm run safety:agent-boundary
```

If there are unexpected local changes, stop and ask the user how to proceed. Never revert changes you did not make unless the user explicitly requests it.

## Operation Classes

Readonly analysis:

- Reading files, `git status`, `git log`, `rg`, and non-mutating inspections are allowed after preflight.

Reversible local changes:

- Editing files, adding docs, local test/build runs, and local commits may be done on `develop-saas` when the user asks to complete work.
- Do not make reversible local changes on `master` unless explicitly instructed.

Irreversible or external changes:

- `git push`, Vercel deploy/promote/rollback, Supabase migrations, production DB changes, GitHub branch protection settings, billing settings, domain settings, and secret/env changes require explicit user authorization.
- When in doubt, prepare exact instructions or commands for the user instead of executing.

## Branch Rules

- `master` = live/protected version.
- `develop-saas` = SaaS/commercial work.
- Bug fixes for the live product start from `master`, then are cherry-picked to `develop-saas` only after the live fix is intentional.
- SaaS-only features must not be merged into `master` until the user explicitly decides to release them to the live product.
- Never force-push `master`.
- Never push `develop-saas` changes to `master`.

## Production Incident Rule

If production is broken, restore service first:

1. Use Vercel rollback from the dashboard.
2. Confirm the live site works.
3. Then inspect logs, commits, and migrations.
4. Fix with a new commit.

Do not use `git reset --hard` or force push as the first response to a production incident.

## Reference Docs

- `docs/LIVE_PROTECTION_AND_SAAS_WORKFLOW.md`
- `docs/SAAS_ARCHITECTURE_DECISION.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `docs/GITHUB_BRANCH_PROTECTION_SETUP.md`
