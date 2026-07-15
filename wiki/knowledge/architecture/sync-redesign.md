---
title: Sync redesign — fold pull into the push response via a server cursor
type: decision
status: draft
tags: [sync, redesign, cursor, round-trip, realtime, convergence, pull-in-push, updated-seq, per-viewer-filter, latency]
---

Target: a change **converges cross-device in <1s, ideally one client→server round-trip**. The core defect
today is that **push and pull are separate channels** ([sync-model](sync-model.md)): `POST /api/sync`
returns only per-op *write status*, so a client can't learn other clients' changes in the same trip —
cross-device convergence rides the async Supabase Realtime echo or the coarse fallback loop
([sync-latency](sync-latency.md)).

**Recommendation (Design A).** Make `POST /api/sync` **also return the authoritative rows changed since the
caller's cursor** — one trip both persists *and* pulls. A passive/idle client pulls by POSTing an
**empty** `operations` array with its cursor. **Realtime demotes to a nudge**: on any `postgres_changes`
event the client just triggers a cursor-pull instead of applying `payload.new` inline — so the server
(not the client, not a broadcast) decides what each viewer may see. Add a ~1s short-poll of the focused
`activeListIds` as the guaranteed-latency path when Realtime is degraded.

**Cursor mechanism.** `updated_at` is a poor cursor: it is **client wall-clock** (set in `actions.ts`,
consumed as LWW in the CTE), so a skewed client can write a past timestamp a peer's cursor has already
passed. Use a **server-assigned monotonic `updated_seq bigint`** (from one Postgres sequence, set via
`nextval()` in the sync CTE on every insert/update) as the cursor; keep `updated_at` for LWW. Cursor =
max `updated_seq` the client has applied (persisted in Dexie/localStorage); the delta `SELECT` returns
member-visible rows with `updated_seq > cursor`. This **decouples "which write wins" (LWW by `updated_at`)
from "what has the client seen" (cursor by `updated_seq`)**. Caveat: sequences can commit out of
commit-order under concurrency (a small missed-row window) — the periodic reconcile backstops it.

**Schema change required (additive).** `items` and `lists` need `updated_seq bigint` (+ `lists` also needs
an `updated_at` — today it has only `created_at`, so list renames have no LWW/cursor column at all — see
[data-model](data-model.md)). **Hard deletes and membership changes have no row to return** (a deleted row
can't satisfy `updated_seq > cursor`); keep those on the existing reconcile path (`GET /api/lists` +
`reconcileAllLists`). Item deletes are **soft** ([soft-deletes](../domain/soft-deletes.md)) so they flow
through the delta as normal rows with `deleted_at` set. Split cleanly: **cursor delta = item upserts +
list renames; reconcile = list membership + hard list-deletes.**

**Alternatives.** (B) *Keep Realtime primary, fix cursoring:* on each Realtime event do a cursor-pull
instead of trusting inline `payload.new` — fixes drift + the per-viewer leak, needs `updated_seq`, but
convergence still gated by Realtime reliability (CHANNEL_ERROR / JWT-refresh gaps). Good **migration
stepping-stone**. (C) *Short-poll right after push, no cursor fold:* trivial, but only the editor polls —
does nothing for the *other* device; rejected as a primary. (D) *Broadcast the merged result over
Realtime:* removes replication lag but a shared broadcast channel **cannot be per-viewer filtered**, so it
leaks — rejected.

**Constraints the design MUST respect.** The delta `SELECT` runs on committed rows, so it inherits the
CTE fixes and must not regress them: coalesce same-id INSERT+UPDATE before returning
(`sync-cte-insert-update-data-loss`); return the **server-renamed** slug so a client learns its rename in
one trip (`slug-collision-sync-batch-failure` — this design *helps* here); filter the delta strictly to
`list_users` membership and land the `created_by = user.id` INSERT fix (`sync-cte-upsert-lists-authz-hole`).
**Per-viewer filtering is a hard requirement** for the planned owner-blind gift lists:
because the delta is a server-side `SELECT`, claim rows can be excluded per viewer (owner never receives
guests' claims) — the very leak an inline-`payload.new` Realtime subscription can't prevent. This is the
strongest argument for Design A.

**Open decisions for the user.** (1) Cursor column: server `updated_seq` sequence (recommended, skew-proof)
vs an `updated_at` watermark + id tie-break (no new column on items, but client-clock fragile). (2) Add the
~1s short-poll for focused lists (guaranteed <1s, more requests) or rely on the Realtime nudge alone
(cheaper, Realtime-dependent). (3) Whether membership changes also get cursored (needs a timestamp/seq on
`list_users`) or stay on the reconcile path (simpler; the recommendation).

**Migration path.** 1) additive migration: `updated_seq` on items+lists, `updated_at` on lists, set via
`nextval()` in the CTE. 2) `POST /api/sync` accepts optional `cursor`, returns `{ results, changes, cursor }`
(omit cursor → old behaviour, backward-compatible). 3) client tracks + advances the cursor, applies
`changes` under the existing pending-wins guard. 4) flip Realtime handlers to cursor-pull (fixes the leak).
5) optional focused short-poll. 6) keep the 10s loop + reconcile as deep backstop.

**Why:** folding pull into the push response collapses two async channels into one authorized,
server-filtered round-trip — the only way to make convergence both fast (<1s) and *safe* (per-viewer),
which the current inline-Realtime pull can be neither reliably nor for gift lists. A server-assigned
monotonic cursor is the piece that makes a delta pull correct without trusting client clocks.
