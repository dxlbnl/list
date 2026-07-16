---
title: Upgrade row-level LWW to a per-field LWW-Map
type: feature
priority: low
flags: []
created: 2026-07-16
---

## What / why

**Deferred / optional** — do row-level LWW first ([sync-apply-lww-guard](sync-apply-lww-guard.md)); only
pick this up **if** a real different-field collision (most plausibly reorder-vs-edit on one item) proves
painful in use, and then only for the colliding fields. Per-field stamps cost a stamp per field in
storage/wire/code for a rare, self-healing case.

Upgrade the row-level last-write-wins to **per-field LWW-registers** (an LWW-Map: one stamp per
field) so concurrent edits to **different** fields always merge instead of one being rejected
wholesale. Today a concurrent `done`-toggle and `name`-edit that arrive out of stamp order make
the older write's whole row lose, dropping the other field's change too.

Apply the **same** rule — *write field iff incoming stamp > my field's stamp* — at **every**
apply point: the server upsert **and** the client apply (Realtime + pull). Key the registers on
a **comparable server stamp** (`updated_seq` / HLC), **not** wall-clock `updated_at`, so
"greater" is deterministic across replicas and offline edits.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 2 (Merge correctness)**.
**Depends on** the Stage-0 [apply-guard](sync-apply-lww-guard.md) (this generalizes its
row-level guard to per-field) and the Stage-1 [cursor](sync-cursor-delta-transport.md) (the
`updated_seq` stamp the registers key on).

Atoms: [sync-merge-model](../knowledge/architecture/sync-merge-model.md) (the LWW-Map decision;
why per-field, why a comparable stamp, why not a document CRDT),
[data-model](../knowledge/architecture/data-model.md),
[async-sync-testing](../knowledge/testing/async-sync-testing.md). Validate against the
[async harness](sync-async-test-harness.md): concurrent different-field edits both survive.

`flags: [review]`: changes the merge contract on both the server and client surfaces.
</parameter>
