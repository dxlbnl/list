---
title: Sync redesign — fold pull into the editor's push; keep Realtime as the data channel
type: decision
status: draft
tags: [sync, redesign, cursor, round-trip, realtime, convergence, pull-in-push, updated-seq, backfill, latency]
---

Target: converge cross-device in <1s with **no extra round-trip**. Two independent moves:

**1. Fold pull into the editor's push.** `POST /api/sync` returns the ack **plus** the rows changed since
the caller's `cursor`, so one round-trip both persists and pulls — the editor never makes a separate pull.
Idle clients pull by POSTing empty `operations` + cursor. (This *removes* round-trips; it doesn't add one.)

**2. Keep Realtime as the data channel for peers — but fix it.** Peers keep receiving `payload.new`
**inline** (the Vercel-compatible replacement for the old SSE push — Vercel can't hold a long connection),
so a peer's update is **pushed** in one hop, not nudge-then-pulled. Fix it by applying `payload.new` only
under the [merge guard](sync-merge-model.md) (apply-iff-newer — kills the resurrection bug) and ordering by
`updated_seq`. The cursor delta is used **only** for the editor's push-fold and as **backfill** on
reconnect / missed event / cold start — never a steady-state pull. (We rejected demoting Realtime to a
nudge: it adds a round-trip on the receive path the user won't pay.)

**Two stamps, both row-level.** `updated_seq` (server-assigned monotonic, `nextval()` in the CTE) = the
**cursor** ("what have I seen"). A **row-level** LWW stamp (`updated_at`, ideally upgraded to an **HLC** so
client skew can't win) = "which write wins." Per-field LWW is **deferred** — see [sync-merge-model](sync-merge-model.md).

**Schema (additive).** `updated_seq bigint` on items+lists; `updated_at` on lists (today only `created_at` —
see [data-model](data-model.md)). Split: **cursor delta = item upserts + list renames; reconcile
(`GET /api/lists`) = membership + hard list-deletes** (a deleted row can't satisfy `updated_seq > cursor`;
soft item-deletes flow through the delta as rows with `deleted_at` set).

**Gift-list per-viewer, without a pull.** Owner-blindness doesn't require routing reads server-side: keep
claims in a **separate table** the owner isn't subscribed to / is RLS-denied on, so the owner's Realtime
never carries claim rows; guests get claim `payload.new` on their channel. If server-composed per-viewer
payloads are ever needed, use Supabase **Broadcast** to viewer-scoped channels (SSE-style control, still a
push). Normal lists pay nothing for this.

**Constraints (must not regress).** The delta `SELECT` + CTE must: coalesce same-id INSERT+UPDATE
(`sync-cte-insert-update-data-loss`); return the server-renamed slug (`slug-collision-sync-batch-failure`);
filter to `list_users` membership + force `created_by = user.id` (`sync-cte-upsert-lists-authz-hole`).

**Open decisions.** (1) LWW stamp: keep wall-clock `updated_at` or upgrade to HLC. (2) Cursor membership
changes too (needs a seq on `list_users`) or keep on reconcile (recommended, simpler).

**Migration.** 1) additive columns + `nextval()` in the CTE. 2) `POST /api/sync` accepts optional `cursor`,
returns `{results, changes, cursor}` (omit → old behaviour). 3) client tracks/advances the cursor, applies
`changes` **and** Realtime `payload.new` under the apply-guard. 4) cursor backfill on reconnect/gap; Realtime
stays inline.

**Why:** the editor's round-trip does double duty (persist + pull) and peers still get data pushed in one
hop — **same hop count as today**, but correct (guarded), ordered (`updated_seq`), and gap-healing
(backfill). Transport is here; the merge rule is [sync-merge-model](sync-merge-model.md).
