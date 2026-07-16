---
title: Cursor-delta transport — fold pull into the push response
type: feature
priority: high
flags: [review]
created: 2026-07-16
---

## What / why

Implement **Design A** from [sync-redesign](../knowledge/architecture/sync-redesign.md): make
`POST /api/sync` **also return the authoritative rows changed since the caller's cursor**, so
one round-trip both persists and pulls — the core fix for cross-device convergence lagging past
~1s (push and pull are separate channels today).

**Additive migration.** Add `updated_seq bigint` (one Postgres sequence, `nextval()` in the
CTE on every insert/update) on **items + lists**, and `updated_at` on **lists** (today lists
have only `created_at`, so renames have no LWW/cursor column at all).

**API.** `POST /api/sync` accepts an optional `cursor` and returns `{ results, changes, cursor }`
where `changes` = member-visible rows with `updated_seq > cursor`. One trip persists + pulls;
an idle client pulls by POSTing an **empty** `operations` array with its cursor; **omitting**
the cursor preserves the old behaviour (backward-compatible). The delta `SELECT` runs on
committed rows, so it must not regress the CTE fixes: coalesce same-id INSERT+UPDATE before
returning, return the **server-renamed** slug, and filter strictly to `list_users` membership.

**Client.** Track and advance the cursor (persisted in Dexie/localStorage) and apply `changes`
under the Stage-0 [apply-guard](sync-apply-lww-guard.md).

**Split** (cursor delta returns rows; deletes/membership have no row to return): **cursor
delta = item upserts + list renames**; **membership + hard list-deletes stay on reconcile**
(`GET /api/lists` + `reconcileAllLists`). Item deletes are soft, so they flow through the delta
as normal rows with `deleted_at` set.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 1 (Transport)**. Depends on
the Stage-0 [apply-guard](sync-apply-lww-guard.md); enables [sync-realtime-as-nudge](sync-realtime-as-nudge.md)
and the per-viewer filtering that gift lists require. Coordinates with the Stage-0 server CTE
cards ([insert+update coalesce](sync-cte-insert-update-data-loss.md),
[slug rename](slug-collision-sync-batch-failure.md),
[authz](sync-cte-upsert-lists-authz-hole.md)) whose fixes the delta `SELECT` inherits.

Atoms: [sync-redesign](../knowledge/architecture/sync-redesign.md) (Design A + cursor mechanism
+ open decisions), [sync-model](../knowledge/architecture/sync-model.md),
[data-model](../knowledge/architecture/data-model.md) (schema),
[async-sync-testing](../knowledge/testing/async-sync-testing.md) (latency-budget assertions).
Validate against the [async harness](sync-async-test-harness.md): B converges within <1s virtual
after A commits, in a single round-trip.

`flags: [review]`: additive schema migration + a new `/api/sync` request/response contract.
</parameter>
