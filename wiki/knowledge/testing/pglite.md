---
title: pglite — in-process Postgres integration harness
type: decision
status: accepted
tags: [testing, pglite, postgres, integration, drizzle, sync-cte, auth]
---
DB-integration tests run against real Postgres **in-process** via `@electric-sql/pglite` — no Docker, no network. `src/lib/test/pglite.ts` exports `createTestDb()`, which boots a fresh PGlite instance and applies the project's Drizzle schema (`src/lib/server/db/schema.ts`) as DDL by diffing an empty schema against the current one (via `drizzle-kit/api`), so the harness stays in lock-step with `schema.ts` with no checked-in migrations. Each call is an **isolated** database (returns `{ db, client, close }`); call it once per suite/test. Use it for the high-risk raw-SQL surfaces — the [sync CTE](../architecture/server-modules.md) (`/api/sync`) and `auth.ts` (session merge). See [test-setup](test-setup.md) and [the-rules](../project/the-rules.md).

**Why:** this is decision D1. Docker/Testcontainers **won't run inside the dev container**, so an in-process Postgres is the only way to test the raw SQL against a real engine rather than a mock — and the sync CTE and `mergeUsers` are exactly the code whose failure modes (silent data loss, authz holes) a mock would never catch. Deriving DDL from `schema.ts` rather than a fixed dump means the harness can't drift from the real schema.
