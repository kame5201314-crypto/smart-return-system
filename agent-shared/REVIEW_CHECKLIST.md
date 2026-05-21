# Review Checklist

Use this checklist before every Claude / Codex handoff, commit, or push.

## 1. Preflight

Run these commands before starting work:

```powershell
Get-Location
git status -sb
git remote -v
git branch -vv
npm run safety:agent-boundary
```

Required state:

- Current path is the SaaS checkout root documented in `agent-shared/README.md`.
- Current branch is `develop-saas`.
- Remote points to `kame5201314-crypto/smart-return-system`.
- There are no unexpected local changes.
- `npm run safety:agent-boundary` passes.

If there are local changes from another agent, stop and report. Do not revert them.

## 2. Claude UI Completion Checklist

Claude should verify these before handing off a UI task:

- Only UI-owned paths were changed.
- No changes under `app/api/**`, `lib/actions/**`, `lib/saas/**`, `lib/config/**`, `supabase/**`, or `scripts/**`.
- No new Supabase query, server action, billing logic, secret read, or external API call was added.
- `error.tsx` has `'use client'` when it uses hooks or event handlers.
- Mock data is marked with `// MOCK:`.
- Copy is readable and has no garbled text.
- Responsive states were checked.

Recommended gate:

```powershell
npm run safety:agent-boundary
npm run lint
npm run typecheck
npm run test:all
npm run build
```

After completion, update:

- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

## 3. Codex Non-UI Completion Checklist

Codex should verify these before handing off a non-UI task:

- No file currently claimed by Claude was changed.
- API, action, or DB schema changes include focused tests when risk is non-trivial.
- New behavior is gated by plan, feature flag, or role where appropriate.
- SaaS logic is not hard-coded to `APP_MODE`.
- No secrets were written or committed.
- No Supabase migration was applied without explicit user approval and target project confirmation.
- No Vercel Production deployment was triggered.

Recommended gate:

```powershell
npm run safety:agent-boundary
npm run saas:doctor
npm run lint
npm run typecheck
npm run test:all
npm run build
```

After completion, update:

- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- Relevant `docs/*.md` status files

## 4. Conflict Protocol

If Claude and Codex need to edit the same file:

1. Mark the owner in `ACTIVE_WORK.md`.
2. The second agent should not edit the file yet.
3. The second agent should write the requested change in `HANDOFF_LOG.md`.
4. After the owner commits, fetch/pull and inspect the diff before continuing.
5. If a conflict already exists, do not run `git reset --hard`; report it to the user.

## 5. Commit / Push Protocol

Before committing:

```powershell
git status -sb
git diff --stat
git diff --check
```

Commit message prefixes:

```text
feat(saas/ui): ...
fix(saas/ui): ...
feat(saas): ...
fix(saas): ...
docs(saas): ...
test(saas): ...
```

Only push this branch:

```powershell
git push origin develop-saas
```

Never run:

```powershell
git push origin master
git push --force
vercel deploy --prod
supabase db push
```
