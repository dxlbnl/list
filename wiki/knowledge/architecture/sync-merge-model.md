---
title: Sync merge model — one symmetric row-level LWW, applied on both surfaces
type: decision
status: accepted
tags: [sync, merge, crdt, lww, convergence, conflict-resolution, dexie, postgres, apply-guard, hlc]
---

The conflict-resolution rule must be **one rule applied identically wherever two versions of a row meet** —
on both the Dexie and Postgres [surfaces](sync-model.md). Today it isn't: the merge lives **only** in the
server CTE (row-level LWW via `updated_at` + per-field `COALESCE`, `+server.ts:96-104`); the **client apply
path has no merge** — Realtime and `pull` do a full-row `db.items.put` gated only by `isOperationPending`
(`sync.svelte.ts:160,362`). That asymmetry is the root of the "deleted item reappears" / stale-echo-revert
class: a late or reordered echo overwrites newer local state because nothing on the client checks "is this
older than what I have?".

**Decision.** Apply the **same row-level last-write-wins rule at every apply point** — server upsert, Realtime
apply, and `pull` apply: *write the row iff its stamp is newer than the local row's*. This makes Dexie a real
replica, not a dumb cache, and makes convergence independent of arrival order and of which surface saw a write
first. **One stamp per row, not per field.**

**Stamp = a row-level HLC (decided).** `updated_at` is client wall-clock, so skew corrupts LWW. Replace it
with a **hybrid logical clock**: `(physical, counter)`, monotonic and causally ordered even when a device's
clock is wrong (`physical = max(last, wall, received)`; tie → `counter++`). The [cursor](sync-redesign.md) is
a separate `updated_seq`. Two stamps, both per-row: "which write wins" (HLC) and "what have I seen" (seq).

**Per-field LWW: decided against (2026-07-16).** Because ops are field-scoped and the server `COALESCE`s per
field, concurrent edits to *different* fields already both survive when they arrive in edit-order (the normal
case). Per-field stamps close only the residual case — a slow/offline device's older edit landing *after* a
newer edit to the same item — at the cost of a stamp on every field, forever, on both surfaces. Not worth it
for a modest-size list app. Reopen only if real usage shows different-field loss.

**Not a document CRDT.** Yjs/Automerge are rejected: opaque binary updates can't be filtered per-viewer (the
gift-list need) and it's a rewrite for merge power a list app rarely needs. Row-level LWW enforced on both
surfaces + fractional-index [ordering](../domain/lists.md) is the right amount of CRDT.

**Why:** a CRDT's defining property is a merge run identically at **every** replica, so order and surface stop
mattering. List has that only server-side; making it symmetric (the client too) is what makes sync correct —
and row-level is the light, sufficient version. Transport is [sync-redesign](sync-redesign.md); this is how
replicas **merge**.
