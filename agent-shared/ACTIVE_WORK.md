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
Commit: (uncommitted, awaiting user approval)
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
Notes: UI-only, no data layer changes. Gate all green (lint 0 errors, typecheck pass, 137 tests pass, build 53 pages). See HANDOFF_LOG for details.
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
