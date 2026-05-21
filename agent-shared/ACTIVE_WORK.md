# Active Work

用來避免 Claude / Codex 同時改同一批檔案。

更新格式：

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
Commit: (awaiting push)
Scope: Task 3 (safe subset) + Task 5 RWD audit
New component:
- components/saas/page-header.tsx
Modified pages:
- app/(admin)/logistics/page.tsx (header → PageHeader)
- app/(admin)/settings/page.tsx (header → PageHeader)
Status: done
Notes: Task 5 RWD audit = PASS (no breakage). Task 3 limited to safe pages; returns/shopee-returns/pickup/orders/analytics deferred (large client components in Codex backend hot zone). Gate all green.
```

## Recent Completed

```text
Owner: Claude
Commit: (awaiting push)
Scope: Task 1 + 2 (partial) - SaaS settings & platform admin UI polish
New components:
- components/saas/demo-data-banner.tsx
- components/saas/usage-progress.tsx
- components/internal/nav-link.tsx
Modified pages:
- app/(admin)/settings/billing/page.tsx (banner)
- app/(admin)/settings/usage/page.tsx (banner + UsageProgress)
- app/(admin)/settings/team/page.tsx (banner + invite helper)
- app/internal/layout.tsx (NavLink with active state)
- app/internal/orgs/page.tsx (banner + UsageProgress + disabled-button helper)
- app/internal/orgs/[id]/page.tsx (banner + disabled-button helper)
- app/internal/billing/events/page.tsx (banner + disabled-button helper)
Status: done
Notes: UI-only. Build initially failed because lucide icon function was passed from server layout to client NavLink — fixed by switching to iconName string + client-side icon map. Gate all green after fix.
```

```text
Owner: Claude
Commit: 927bf1a
Scope: Task 4 - Empty / loading / error states (first wave)
Files:
- app/not-found.tsx (NEW)
- app/(admin)/loading.tsx (NEW)
- app/(admin)/error.tsx (NEW)
- app/(admin)/returns/loading.tsx (NEW)
- app/(admin)/returns/[id]/loading.tsx (NEW)
- app/(admin)/shopee-returns/loading.tsx (NEW)
- app/(admin)/shopee-returns/[id]/loading.tsx (NEW)
- app/(customer)/portal/loading.tsx (NEW)
- app/(customer)/portal/error.tsx (NEW)
Status: done
Notes: UI-only, no data layer changes. Gate all green.
```

```text
Owner: Codex
Commit: docs(saas): clarify shared agent boundaries
Scope: Clarify Claude/Codex split edge cases and route group strategy
Files:
- agent-shared/**
Status: done
Notes: Current route strategy is to keep authenticated SaaS app pages in app/(admin).
```

```text
Owner: Codex
Commit: 92dcdd5
Scope: Create shared agent coordination folder
Files:
- agent-shared/**
Status: done
Notes: No UI/backend runtime changes in this task.
```

```text
Owner: Codex
Commit: 15e61c1
Scope: Repair commercial website copy
Files:
- app public marketing pages
- components/marketing/**
- lib/saas/public-signup.ts
Status: done
```
