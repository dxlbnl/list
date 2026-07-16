---
title: Sync merge model — one symmetric row-level LWW, applied on both surfaces
type: decision
status: draft
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

**Stamp: comparable, not wall-clock.** `updated_at` is client wall-clock, so skew corrupts LWW. Use a
**row-level HLC** (or at minimum keep `updated_at` as the LWW field, upgrade later); the [cursor](sync-redesign.md)
is a separate `updated_seq`. Two stamps, both per-row: "which write wins" and "what have I seen".

**Per-field LWW is deferred, not default.** Per-field stamps help only one narrow case — concurrent edits to
**different** fields of the **same** row arriving out of order (row-level LWW then reverts the older field
wholesale). Rare and low-stakes in a list app (usually different rows; self-heals), and it costs a stamp per
field in storage/wire/code. Do row-level now; add per-field **only if** a real collision (most plausibly
reorder-vs-edit on one item) proves painful — and then only for the colliding fields.

**Not a document CRDT.** Yjs/Automerge are rejected: opaque binary updates can't be filtered per-viewer (the
gift-list need) and it's a rewrite for merge power a list app rarely needs. Row-level LWW enforced on both
surfaces + fractional-index [ordering](../domain/lists.md) is the right amount of CRDT.

**Why:** a CRDT's defining property is a merge run identically at **every** replica, so order and surface stop
mattering. List has that only server-side; making it symmetric (the client too) is what makes sync correct —
and row-level is the light, sufficient version. Transport is [sync-redesign](sync-redesign.md); this is how
replicas **merge**.
