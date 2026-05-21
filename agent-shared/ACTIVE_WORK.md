# Active Work

Use this file to avoid Claude / Codex editing the same files at the same time.

This file is Codex-maintained. Claude should not edit it directly; Claude should declare task scope in the chat or commit message, and Codex records it here after handoff.

This is a coordination log, not a hard git lock. In one shared working tree, prefer serialized work: one agent finishes, commits, and pushes before the next agent starts.

Update format:

```text
Owner:
Started:
Scope:
Files:
Status:
Notes:
```

## Current

```text
Owner: none
Started:
Scope:
Files:
Status:
Notes: Ready for the next agent to claim a task before editing.
```

## Recent Completed

```text
Owner: Claude
Commit: f0a937a
Scope: Task 3 safe subset + Task 5 RWD audit
Files:
- components/saas/page-header.tsx
- app/(admin)/logistics/page.tsx
- app/(admin)/settings/page.tsx
Status: done
Notes: UI-only. Large client-heavy admin pages remain deferred.
```

```text
Owner: Claude
Commit: f216cc8
Scope: Task 1 + 2 partial - SaaS settings and platform admin UI polish
Files:
- components/saas/demo-data-banner.tsx
- components/saas/usage-progress.tsx
- components/internal/nav-link.tsx
- app/(admin)/settings/billing/page.tsx
- app/(admin)/settings/usage/page.tsx
- app/(admin)/settings/team/page.tsx
- app/internal/layout.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- app/internal/billing/events/page.tsx
Status: done
Notes: UI-only. Build issue from server-to-client icon prop was fixed by using an iconName string.
```

```text
Owner: Claude
Commit: 927bf1a
Scope: Task 4 - Empty / loading / error states
Files:
- app/not-found.tsx
- app/(admin)/loading.tsx
- app/(admin)/error.tsx
- app/(admin)/returns/loading.tsx
- app/(admin)/returns/[id]/loading.tsx
- app/(admin)/shopee-returns/loading.tsx
- app/(admin)/shopee-returns/[id]/loading.tsx
- app/(customer)/portal/loading.tsx
- app/(customer)/portal/error.tsx
Status: done
Notes: UI-only, no data layer changes.
```

```text
Owner: Codex
Commit: 6863003
Scope: Shared review checklist
Files:
- agent-shared/REVIEW_CHECKLIST.md
- agent-shared/README.md
- agent-shared/TASK_BOARD.md
Status: done
Notes: Added handoff, commit, and push checklist.
```
