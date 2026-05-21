# Claude UI Scope

Claude owns UI / UX / frontend polish only.

## Allowed Paths

Claude may edit:

```text
app/**/page.tsx
app/**/layout.tsx
app/**/loading.tsx
app/**/error.tsx
app/**/not-found.tsx
app/**/template.tsx
app/**/opengraph-image.tsx
components/**
styles/**
public/**
app/globals.css
lib/utils.ts
```

`lib/utils.ts` is allowed only for UI helpers such as `cn()`. Do not add business logic there.

## Allowed Work

- Public SaaS marketing page polish.
- Authenticated SaaS app page polish.
- Admin page visual polish.
- Responsive layout.
- Empty / loading / error states.
- Table, filter, tab, card, form, and navigation UI.
- Icons, spacing, typography, and Tailwind classes.
- Mock UI, as long as it is clearly marked as mock/demo.

## Do Not Touch

Claude must not edit:

```text
agent-shared/**
app/api/**
lib/actions/**
lib/saas/**
lib/config/**
lib/supabase/**
scripts/**
supabase/**
.github/**
.env*
tailwind.config.ts
postcss.config.mjs
next.config.*
tsconfig.json
package.json
package-lock.json
```

Root config changes require Codex handoff.
`agent-shared/**` is Codex-maintained to avoid claim-file conflicts. Claude should report task scope and handoff notes in the chat or commit message instead of editing shared coordination files.

## Do Not Execute

Claude must not run:

```text
supabase db push
supabase migration up
vercel deploy
vercel env
gh api branch protection writes
git push origin master
git push --force
```

## Server Component Edge Cases

`app/**/page.tsx` can contain server-side data loading. Claude may change the UI layer only:

- OK: JSX, className, copy, icons, visual states.
- OK: loading / empty / error rendering.
- Not OK: Supabase query body, server action call, auth guard, redirect logic, or data shape changes.

If UI needs new data, write the requested shape in `HANDOFF_LOG.md` or `UI_BACKEND_CONTRACTS.md`.

## Components With Actions

If a component imports a server action:

- OK: props, display logic, button placement, and event handler wiring.
- Not OK: server action implementation.
- Not OK: adding a new mutation action import without Codex handoff.

## Route Group Strategy

Current strategy:

```text
Use app/(admin) for authenticated SaaS app pages.
Do not create app/(app) yet.
Do not move existing routes between route groups.
```

Claude may polish existing pages under:

```text
app/(admin)/**
app/internal/**
```

Do not change middleware, proxy, route protection, or auth behavior.

## Mock Data

Mock data may live in:

```text
components/mock/**
app/**/mock.ts
```

Use this comment:

```ts
// MOCK: replace with real SaaS data after backend wiring.
```

Mock UI must not read `.env*`, call APIs, or write to a database.
