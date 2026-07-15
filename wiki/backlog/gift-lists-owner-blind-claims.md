---
title: Gift lists — guests claim items, owner stays blind
type: feature
priority: medium
flags: [review]
created: 2026-07-15
---

## What / why

A new kind of list, à la **lijstje.nl**: a wish/gift list the owner fills with desired items and shares.
**Guests (often not logged in, via the share link) can "tick"/claim an item** — "I'll get this one" — so
gifts aren't duplicated. Crucially, the **owner must NOT see** which items are claimed or by whom, so the
surprise is preserved. Guests generally *do* see each other's claims (to avoid duplicates); the owner
never does.

## Notes

This is privacy-critical and cuts across auth, sync, and the data model — it needs a design pass before
build. Grounding: [auth](../knowledge/domain/auth.md) (anonymous sessions + share/invite tokens),
[sync-model](../knowledge/architecture/sync-model.md) (Realtime broadcasts row changes — the leak risk),
[data-model](../knowledge/architecture/data-model.md), [server-modules](../knowledge/architecture/server-modules.md).

**Open design questions (resolve in the design pass):**
1. **List type/mode** — introduce a `type`/`mode` on lists ("standard" vs "gift"), or a per-list flag? This
   is the first "lists that work differently" — decide if it generalises to a list-type concept.
2. **Who can claim** — anonymous guests via a share/invite token (leaning yes; anonymous sessions already
   exist), or must guests have accounts? What stops the owner from claiming to peek?
3. **Owner-blindness (the hard part)** — claims live in a separate store, and the owner's reads **and**
   Realtime subscription must be server-side filtered to exclude claim rows. The current single
   `postgres_changes` channel would leak claims to the owner — needs per-viewer authorization (RLS /
   role-scoped channels / a claims-excluding read path). This must be enforced on the **server**, never
   just hidden in the client.
4. **Guest visibility** — do guests see each other's claims in realtime (yes, to prevent duplicates)?
   Then guests need a claim channel the owner is excluded from.
5. **Concurrency** — two guests claim the same item near-simultaneously: first-wins? show "already
   claimed"? Ties into the [sync overhaul](sync-single-roundtrip-overhaul.md) convergence work.
6. **Owner edits while claimed** — owner adds/removes/reorders items freely; a claimed item the owner
   deletes should handle gracefully.

Depends conceptually on a clean sync model — sequence after (or alongside) [sync-single-roundtrip-overhaul](sync-single-roundtrip-overhaul.md).
