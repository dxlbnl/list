# B6: Test coverage audit

**Report owner**: researcher (B6) · **Date**: 2026-06-03 · **Status**: research, read-only

This audit walks the codebase area-by-area, ranks the tests the project would
actually benefit from, and lists the latent bugs surfaced along the way. The bar
is **risk × value** — a test only earns its place if it would have caught a
known/suspected bug, locks down a load-bearing invariant, or characterises code
that is about to be refactored (B4, B5). It is **not** a coverage drive.

The wiki was read first (per the workflow's PreToolUse hook). Several material
divergences between the wiki and the code were found and are listed in
[Latent bugs surfaced](#latent-bugs-surfaced) — these are themselves bugs in the
single-source-of-truth and should be reconciled by `/wiki-sync` after the
manager triages this report.

---

## Triage by area

### 1. Sync CTE on the server (`src/routes/api/sync/+server.ts`)
**Highest-risk surface in the codebase.** A single ~125-line raw-SQL CTE
performs all batched writes (lists, items, list_users, deletes) atomically with
per-row authorization filters. Failure modes here are silent data loss or
authz holes — both observed during this audit (see L1, L2 below).
**Testable**: yes, ideal pglite-integration target. `createTestDb()` boots the
real Drizzle schema; the route module imports `db` from `$lib/server/db`, so a
focused test can substitute the pglite db or invoke the CTE SQL directly.
Friction: the route hand-builds `event` for `RequestHandler`; easier path is to
extract the CTE into a callable function or to test by POSTing through a
SvelteKit handler shim. **Highest value-per-test in the codebase.**

### 2. Auth & session merging (`src/lib/server/auth.ts`)
`getSession`, `createAnonymousSession`, and `mergeUsers` are the load-bearing
identity surface. `mergeUsers` does multi-step list/list_users surgery with no
transaction wrapping — slug-collision logic, FK cascade interactions, and the
final `delete users` step. A regression here silently destroys user data on
login. **Testable**: pglite-integration, low friction; the functions take an
event/db and return promises.

### 3. Client actions layer (`src/lib/client/actions.ts`)
The single mutation entry point. Tiny but load-bearing — every write that
appears to "just work" in the UI flows through here. `renameGroup` and
`deleteGroup` already do the `"GENERAL" → ""` translation correctly (this is
relevant to B4 — see L7 below). The actions layer is where rank/groupName
invariants are stamped. **Testable**: node-tier with the `fake-indexeddb`
client setup (already wired in `setup.client.ts`), or browser-tier. Friction:
each action calls `syncManager.processQueue()` which fetches `/api/sync`;
tests need to stub `fetch`.

### 4. Sync engine (`src/lib/client/sync.svelte.ts`)
Largest single module (385 lines), most complex client logic. Owns:
push queue with `pushPromise` deduplication, pull with last-write-wins,
`reconcileAllLists`, Supabase Realtime subscribe + token refresh, online/offline
recovery. The 4xx handling branches (400 = drop batch, 401/403 = logout) are
particularly dangerous — a misclassified error wipes the user's queued work.
The `isOperationPending` helper does `db.syncQueue.toArray()` on **every**
incoming realtime event (perf risk for shared lists with chatter). **Testable**:
hard. Mostly browser-tier via component harness with `fake-indexeddb` + mocked
`fetch`/Supabase. The decision branches (LWW, pending-wins, server-deletion
propagation) are unit-testable in isolation if extracted.

### 5. Validation transforms (`src/lib/validations.ts`)
Single source of truth for wire/DB/client. The Zod `.transform()` chains do
camelCase → snake_case conversion and ISO-string dates. **Silent failure mode**:
a `.partial()` schema accepts undefined for any field; the transform passes
undefined through to JSON.stringify which omits the key; the resulting JSON
hits the CTE with NULL columns. This is the mechanism behind L1 (data-loss
bug). **Testable**: trivial node-unit. High value because the schemas are
where wire/DB/client invariants are encoded.

### 6. Group semantics (`renameGroup` / `deleteGroup` + inline `onRename`)
Two interacting layers: `actions.ts` does the `"GENERAL" → ""` translation;
`+page.svelte` (line ~360) passes the display string through unchanged.
Because `actions.ts` does its own translation, B4's described bug
("inline path skips translation → rename is a no-op") **may already not
trigger** — the actions layer catches it. This needs to be characterised by
a test before B4's fix, otherwise B4 will write a test that already passes
and the team won't know what was actually broken. See L7. **Testable**: node
tier on `actions.ts` directly (with `fake-indexeddb`).

### 7. Slug routing & disambiguation (`src/routes/[slug]/+page.ts`,
`createList`, `getEffectiveSlug` in `+page.svelte`, `join/[slug]/[token]/+server.ts`)
Four call sites all independently apply the `{slug}--{userId[0..8]}` rule.
Easy to drift out of sync. `actions.ts:createList` only checks **local**
Dexie for slug collisions — server-side `unique(created_by, slug)` failure
would error the entire sync batch (see L5). **Testable**: node-tier unit
tests for `slugify`/`isReservedSlug`/`getEffectiveSlug`; pglite-integration
for the join+collision path.

### 8. Soft-delete & restore
Soft-delete itself (`deleteItem` sets `deletedAt`) is implemented and trivially
testable. **The "restore" UX described in `wiki/features/soft-deletes.md` does
not exist in the code** — there is no creatable-select search input, no
"clear deletedAt" path anywhere. (See L8.) Once the wiki is reconciled or the
feature is filed, tests would attach to the actions function that restores.
**Testable**: trivial once a behaviour exists to test.

### 9. Rate limiting (`src/lib/server/ratelimit.ts`)
Single atomic upsert; the CASE expression for window reset is the only
non-trivial logic. Cheap pglite test pays for itself if the project ever
adds more rate-limit gates (currently only `/login` + `/api/auth/clone`).
**Testable**: pglite-integration, trivial.

### 10. Supabase JWT signing (`src/lib/server/supabase-auth.ts`)
ES256 PKCS8 import + JWT sign. Returns empty string `""` on every failure
(no throw) — silent breakage. `console.error` is used directly, bypassing the
shared logger (violates the architecture.md Rules — see L4). **Testable**:
node-unit with a synthetic ES256 PEM, decode and assert the claims/header. Low
value otherwise — the library does the cryptographic work. The right test is
on the *contract* (claims set, kid in header, audience/role).

### 11. UI components (`ListGroup`, `UserMenu`, dialogs, …)
Most are presentational. The two with real logic worth a browser-tier test:
- `ListGroup` rename/delete dialogs (the buttons that trigger the group
  rename pathway B4 fixes).
- `+page.svelte` (slug) `handleDndConsider`/`handleDndFinalize` — DnD reorder
  rewrites all ranks 0..N-1 every drop (NOT the float-midpoint logic the wiki
  describes; see L6). The current implementation is correctness-wise fine but
  is a moving target B5/future-work will likely touch.

---

## Proposed test items (prioritized)

Each row lists: tier · scope · what it locks down. Items above the cut line
should be filed as backlog cards.

| # | Test | Tier | Scope | Risk mitigated / before-B4-or-B5 |
|---|------|------|-------|----------------------------------|
| T1 | **Sync CTE drops a partial-data UPDATE when the matching INSERT is in the same batch** (`addItem` + `updateItem(done:true)` flushed together → item silently lost). Verify against pglite that a coalesced INSERT+UPDATE batch results in a row with `name`/`rank` set. | pglite integration | multi-area (validations + CTE) | Catches **L1** — high-confidence latent data-loss bug. |
| T2 | **Sync CTE authz on `upsert_lists` rejects INSERT-with-arbitrary-`created_by`** from a non-owner. (Currently the `NOT EXISTS` clause lets a new list be inserted with any `created_by`.) | pglite integration | single (CTE) | Catches **L2** — authz hole, low severity but real. |
| T3 | **`renameGroup("GENERAL", "Produce")` on items with `groupName: ""` updates them to `"Produce"`** — this is the regression test B4's spec already names. Filing as part of B4's tests-first phase (NOT a separate item) but should be written **with the live `onRename` path** (i.e. exercise the inline call from `+page.svelte`, not just `actions.ts`), because `actions.ts` already does the translation and a test of `actions.ts` alone would pass without proving anything. See **L7**. | browser/Svelte | multi-area (component + actions) | **MUST land as part of B4.** Without exercising the component path, B4's tests-first will be vacuous. |
| T4 | **Characterise current "group disappears when emptied" behaviour** — assert that after `deleteItem` on the last item of a group, that group name no longer appears in `sortedGroupNames`. This locks the current behaviour so B5 (persist empty groups) has a red regression test to flip. | browser/Svelte | single (page) | **MUST land before B5.** Provides the before/after pivot for B5's spec. |
| T5 | **`mergeUsers` transfers lists + list_users and survives slug collisions** — pglite test that creates source user with N lists (some colliding with target's slugs), runs `mergeUsers`, asserts: all lists owned by target, no FK orphans, slug-collision list got the `-{nanoid(4)}` suffix, source user deleted, cascade did not nuke transferred lists. | pglite integration | single (auth.ts) | Locks down R6 (anonymous→verified merge). Highest-impact silent breakage if regressed. |
| T6 | **Sync CTE LWW: stale `UPDATE` (older `updated_at`) is ignored** — pglite-seed an item with `updated_at=T1`, send an UPDATE op with `updated_at=T0<T1`, assert the row is unchanged and the op is reported `ignored`. Covers conflict resolution behaviour from `architecture/data-flow.md`. | pglite integration | single (CTE) | Locks the conflict-resolution invariant referenced everywhere in the wiki. |
| T7 | **Sync CTE: soft-delete (`UPDATE deleted_at`) is preserved across subsequent UPDATEs that don't carry `deleted_at`** — the COALESCE on `deleted_at` is the only thing preventing "tick done after delete restores the item". | pglite integration | single (CTE) | Catches a regression that would un-delete items on toggle. R5. |
| T8 | **Validation transforms drop `undefined` correctly** — node-unit on `itemSyncDataSchema` showing that a partial update (`{ id, done, updatedAt }`) transforms to a wire object with `list_id`/`name`/`rank`/`group_name` absent (not `null`). Documents the contract that the CTE relies on. Pair with **T1** — once T1 forces the CTE fix, T8 ensures the validator continues to behave the way the fix assumes. | node unit | single (validations) | Foundation for T1; cheap. |
| T9 | **`createList` slug-collision branch picks a non-reserved, non-colliding fallback** — node-unit on `actions.ts:createList` with seeded Dexie state. Covers the existing local-dedup logic and surfaces the **server-side** collision gap (see L5) when paired with T10. | node (fake-indexeddb) | single (actions) | Low standalone value; high value as a foundation for T10. |
| T10 | **Sync CTE handles `unique(created_by, slug)` collision gracefully** — pglite test that simulates the same user creating "groceries" on two devices (two INSERTs with the same `created_by`+`slug`, different ids). Currently both `ON CONFLICT (id)` branches fire independently → the second INSERT violates the unique constraint → entire batch transaction aborts. See L5. | pglite integration | multi (CTE + actions) | Catches **L5** — total sync-batch failure on a realistic offline scenario. |
| T11 | **`isOperationPending` correctly identifies queued ops by `data.id`** — and (the bug-prevention test) does not match on `op.id` (the operation's own nanoid). Cheap node-unit with fake-indexeddb. | node (fake-indexeddb) | single (sync engine) | Locks the "pending wins" invariant — the only reason offline edits survive realtime overwrites. |
| T12 | **`reconcileAllLists` deletes locally-known lists absent from server (and not `isLocalOnly`)** — straightforward sync engine behaviour with high blast radius if regressed (data loss on the user's dashboard). | node (fake-indexeddb) | single (sync engine) | Locks a load-bearing reconciliation invariant. |

**--- cut line ---**

| # | Test | Tier | Scope | Why deferred |
|---|------|------|-------|--------------|
| T13 | `slugify` / `isReservedSlug` unit tests. | node unit | single (utils) | Trivial pure functions; not where the bugs are. Skip. |
| T14 | `createSupabaseToken` claims/header round-trip. | node unit | single | The library does the work; failure is loud (auth breaks instantly). Defer until a real bug appears. |
| T15 | `themeManager` localStorage round-trip. | browser | single | Cosmetic; trivial; defer. |
| T16 | `menuState` snippet set/clear. | node unit | single | Trivial holder; defer. |
| T17 | `ratelimit.ts` window reset CASE branch. | pglite | single | Low surface area, low blast radius (only login + clone use it). Defer until rate limiting expands. |
| T18 | Logger formatting branches. | node unit | single | Cosmetic; tests would be brittle and low-value. Defer. |
| T19 | Email template rendering. | node unit | single | Visual; the template will change; defer. |
| T20 | `+page.svelte` (root) `getEffectiveSlug` collision branch. | node unit | single | Pure function, low risk; pair with T9 if appetite remains, but otherwise defer. |
| T21 | Component snapshot tests for `Dialog`/`UserMenu`/`InputGroup`. | browser | broad | Pure structure; brittle; not where bugs hide. Defer indefinitely. |

---

## Latent bugs surfaced

> **L<n>** entries are problems identified during the audit. Confidence band:
> **confirmed** (verified by reading code), **suspected** (consistent with what
> I read but I have not produced a runnable repro), **needs-reproduction** (I
> believe the bug is real but a pglite/manual repro is the only way to be sure).

### L1 — Sync CTE silently loses items when an INSERT and a subsequent UPDATE land in the same batch
**Confidence**: confirmed by reading code (validations.ts + sync/+server.ts).
**Where**: `src/routes/api/sync/+server.ts:52-105` interacting with
`src/lib/validations.ts:75-84` (`itemSyncDataSchema`).
**What looks wrong**: The CTE de-duplicates input ops with
`DISTINCT ON (id) ... ORDER BY id, updated_at DESC` — the latest version of a
row wins. UPDATE ops carry only the fields that changed (their `Partial`
projection through `itemSyncDataSchema` produces JSON with most keys absent).
For an item that was created **and** updated locally before the first sync
flushed (e.g. `addItem` immediately followed by `toggleDone`), both ops are in
the same batch with the same id. The UPDATE has a later `updated_at`, so it
"wins" the DISTINCT ON. The INSERT's full payload is dropped. The surviving
UPDATE has no `list_id`/`name`/`rank`, so:
- The LEFT JOIN `items i ON d.id = i.id` finds no existing row.
- The WHERE `(i.id IS NOT NULL AND …) OR (d.list_id IS NOT NULL AND d.name IS NOT NULL AND …)` fails both branches.
- The row is filtered out; both ops are reported as `ignored`.
- The client drops both ops from `db.syncQueue` on the next ack.
- The item is **gone server-side forever**, but still present in local Dexie
  until the next `reconcileAllLists` overwrites local with server's (empty)
  authoritative state — at which point the user's item disappears from their
  own screen with no explanation.

**Fix shape**: two viable options:
1. **Server**: change `DISTINCT ON ... ORDER BY updated_at DESC` to coalesce
   the two records into a single one that takes its mandatory fields from the
   INSERT and its mutable fields from the latest UPDATE. The cleanest way is a
   `jsonb_object_agg` step that merges all ops for the same id (last-write-wins
   per field, but always keep the non-null `list_id`/`name`/`rank`).
2. **Client**: have `processQueue` collapse INSERT+UPDATE for the same `data.id`
   into a single INSERT-with-merged-fields before POSTing.
**Recommend (1)** — server is the canonical place to enforce sync correctness,
and option (2) doesn't help concurrent edits from different devices that hit
the server in the same batch via realtime.
**Test**: T1.

### L2 — Sync CTE authz: a client can INSERT a list with arbitrary `created_by`
**Confidence**: confirmed by reading code.
**Where**: `src/routes/api/sync/+server.ts:64-72` (`upsert_lists`).
**What looks wrong**: The WHERE clause is
`NOT EXISTS (SELECT 1 FROM lists l WHERE l.id = d.id) OR EXISTS (SELECT 1 FROM lists l WHERE l.id = d.id AND l.created_by = ${user.id})`.
For a new id (no existing row), `NOT EXISTS` is true and the INSERT proceeds
regardless of what `created_by` the client sent. The client can therefore
INSERT a list "owned by" any user id. The follow-up `upsert_members` inserts
`(list_id, current_user)` for each list_input, so the attacker becomes a
member of the spurious list — but the *fake owner* does not, so the fake
owner cannot see the spoofed list in their `/api/lists`. Damage is limited to
data pollution rather than victim impersonation.
**Fix shape**: enforce `created_by = ${user.id}` in the INSERT path —
`WHERE NOT EXISTS (...) AND created_by = ${user.id}` (or, equivalently, ignore
the client-supplied `created_by` and substitute `${user.id}` in the SELECT).
**Test**: T2.

### L3 — Wiki/`architecture/sync-engine.md` and `architecture/data-flow.md` describe an SSE-based sync engine that **no longer exists**
**Confidence**: confirmed.
**Where**: wiki says `GET /api/sync` SSE, EventSource on client; reality is
Supabase Realtime channels (`supabase.channel(...).on('postgres_changes', ...)`)
in `src/lib/client/sync.svelte.ts:115-185` and no GET handler in
`src/routes/api/sync/+server.ts`. The "syncHub EventEmitter on
`user:{userId}`" described in `architecture/server-modules.md` is also gone.
**Fix shape**: `/wiki-sync` — rewrite `sync-engine.md`,
`data-flow.md`'s Read Path, `server-modules.md`'s `sync.ts` section to
describe the Supabase Realtime model. Update `data-flow.md`'s diagram. The
top-level `architecture.md` already says "Supabase Realtime" — only the
detailed pages are stale.
**Test**: not a code test; a `/wiki-sync` task.

### L4 — `src/lib/server/supabase-auth.ts` uses `console.error` directly, violating the "MUST use shared `logger`" Rule
**Confidence**: confirmed.
**Where**: `src/lib/server/supabase-auth.ts:15, 23, 44`.
**What looks wrong**: The architecture.md Rule
("Server code MUST use the shared `logger` from `$lib/logger` (not
`console.log`) and call `logger.flush()` before returning from endpoints.")
is plainly violated. Means token-signing errors aren't shipped to Axiom in
prod; silent breakage.
**Fix shape**: replace `console.error` with `logger.error`, import the shared
logger. Trivial.
**Test**: none warranted (rule-compliance, not behavioural).

### L5 — Concurrent list-create from two devices with the same user + slug aborts the entire sync batch
**Confidence**: confirmed (UNIQUE constraint + ON CONFLICT shape) /
needs-reproduction (the exact "entire batch fails" claim depends on
Postgres CTE error semantics, but every plausible read says yes).
**Where**: `src/lib/server/db/schema.ts:40` (`unique().on(t.createdBy, t.slug)`)
interacting with `src/routes/api/sync/+server.ts:64-72` and
`src/lib/client/actions.ts:9-13` (local-only slug check).
**What looks wrong**: `actions.ts:createList` only checks the **local** Dexie
for slug collisions before assigning a slug. Two devices both offline, both
create "groceries" for the same logged-in user → both assign slug "groceries"
locally → both queue INSERT ops with different ids but same slug → first
device flushes, server inserts row #1 → second device flushes, server tries
INSERT row #2 with the same `(created_by, slug)` → UNIQUE violation. The
`ON CONFLICT (id) DO UPDATE` clause only catches PK conflicts, not other
unique-constraint violations. The transaction errors out; the catch in
`+server.ts:145-149` re-throws as a 500; the client's `processQueue` sees
non-OK status, sets `lastSyncError`, leaves the queue intact (line 273-277).
The user is permanently stuck — every subsequent flush fails identically.
**Fix shape**: either dedup slugs server-side (rename one with `-{nanoid(4)}`,
mirroring `mergeUsers`) or have the CTE `ON CONFLICT (created_by, slug)`
branch handle the rename. The first is safer because it preserves the client's
id.
**Test**: T9 + T10.

### L6 — DnD reorder renumbers ALL items 0..N-1 every drop; the wiki's "float-rank O(1) reorder" claim is fictional
**Confidence**: confirmed.
**Where**: `src/routes/[slug]/+page.svelte:156-167` (`handleDndFinalize`
assigns `rank: index`).
**What looks wrong**: Every reorder writes `updates` for every item in every
group whose rank doesn't match its index. That's the opposite of the float
midpoint scheme described in `wiki/features/lists.md` (and
`wiki/architecture/data-model.md` partially acknowledges this with "Currently
simplified to `Date.now()` on insert" — but the *reorder* claim is still
unflagged). The behaviour is functionally correct but `/api/sync` payloads
balloon linearly with list size on every drag.
**Fix shape**: either (a) update the wiki to match reality (lite chore), or
(b) implement midpoint floats as the wiki promises (full feature). The choice
is the user's. **No test until that decision is made** — testing the current
"renumber-everything" behaviour would lock in something we want to change.
**Test**: deferred until the decision; otherwise update wiki.

### L7 — B4's described bug ("inline `onRename` skips `GENERAL→""` translation") may already not trigger because `actions.ts:renameGroup` does the translation
**Confidence**: suspected — the read of `actions.ts:148-150` shows the
translation IS in the actions layer; B4's card says the live path "skips" it.
Either B4's description is stale (the actions-layer translation post-dates
the bug report) or there is a subtler bug I haven't located.
**Where**: `src/lib/client/actions.ts:148-150` does
`actualOldName = oldName === "GENERAL" ? "" : oldName`; the inline
`+page.svelte:359-360` calls `renameGroup(data.listId, groupName, newName)`
with `groupName = "GENERAL"` for the default group.
**What this means for B4**: the test the B4 spec asks for ("rename GENERAL,
assert items end up with the new groupName") will probably **pass against the
current code**, contradicting the spec's "this test must fail" line. B4 risks
being a no-op item with a green test that proves nothing. The right move is
for B4's test-writer to **run the test against current code first** and, if it
passes, file a new bug investigating what the user actually saw. The audit
recommends T3 above explicitly exercise the **component path** (rename dialog
→ `onRename` callback → `renameGroup`) rather than calling `renameGroup`
directly, to maximise the chance of catching whatever the user observed.
**Fix shape**: do not change anything until T3 reproduces the failure. If it
doesn't reproduce, treat B4 as a wiki/observation reconciliation rather than
a code fix.

### L8 — `wiki/features/soft-deletes.md` documents a "restore via creatable-select" UX that does not exist in the code
**Confidence**: confirmed (`grep -r restore src` finds zero matches; no UI
component does a `deletedAt: null` update).
**Where**: wiki/features/soft-deletes.md vs. `src/routes/[slug]/+page.svelte`
and `src/lib/client/actions.ts` (no restore action).
**Fix shape**: either build the restore UI (full feature; file in inbox) or
update the wiki to reflect current behaviour (soft-delete exists, restore
does not). The audit recommends the latter unless the user wants the feature.
**Test**: none until a behaviour exists.

### L9 — `wiki/architecture/data-model.md` and `architecture/database.md` claim `sessions.expires_at` exists; the actual Drizzle schema has no such column
**Confidence**: confirmed.
**Where**: `src/lib/server/db/schema.ts:10-17` defines `sessions` with only
`id` and `userId` — no `expires_at`. The cookie sets a far-future browser
expiry but the DB has no server-side expiration. Wiki promises otherwise.
**Fix shape**: either add the column + checks (feature) or update the wiki
(chore). The audit recommends wiki update — the current "infinite session"
behaviour is consistent with R7 ("Sessions should persist") and the magic-link
flow doesn't rely on session expiry.
**Test**: none until the decision is made.

### L10 — `mergeUsers` runs ~5 distinct mutations with no transaction; partial failure leaves orphaned/half-merged state
**Confidence**: confirmed (code reads as serial `await db.update/.delete` with
no `db.transaction(...)` wrapper).
**Where**: `src/lib/server/auth.ts:73-135` (`mergeUsers`).
**What looks wrong**: If any step fails (e.g. the final `delete users` due to
an FK cascade surprise, or a transient connection drop mid-merge), the user
is left in a hybrid state: some lists transferred, some list_users
reassigned, anon user still alive. The next login attempt will try to merge
again from the partial state, with unpredictable results.
**Fix shape**: wrap the whole function body in
`db.transaction(async (tx) => { ... })`. Drizzle supports this directly.
**Test**: T5 should add a fault-injection variant (e.g. force a failure
mid-merge and assert no orphans), or at least a "happy path complete" check.

### L11 — `isOperationPending` does a full `syncQueue.toArray()` on every realtime event
**Confidence**: confirmed.
**Where**: `src/lib/client/sync.svelte.ts:222-225`.
**What looks wrong**: For every incoming `postgres_changes` event (item or
list), the function reads the entire local sync queue, then linearly scans for
the entity id. For a shared list with chatty collaborators on a slow device,
this is O(events × queue length). Not a correctness bug, but a perceptible
performance issue when the user has 100+ queued ops offline.
**Fix shape**: query Dexie by index (add an `entityId` index to syncQueue and
`db.syncQueue.where('entityId').equals(id).first()`). Trivial. **Note**: the
existing Dexie schema in `db.ts:17-21` does NOT index `entityId` (it indexes
`entity`, `type`, `timestamp`), and `actions.ts` doesn't write `entityId` —
it writes the id inside `data`, which Dexie cannot index without
`data.id`-style compound keys. Fixing this properly requires either denormalising
`entityId` to the top level of the sync queue record or restructuring.
**Test**: not warranted until the fix is filed.

---

## What we deliberately are NOT testing

- **`slugify` / `isReservedSlug`**: pure functions, two-line bodies, low blast
  radius. (T13)
- **`createSupabaseToken`**: failure is loud and global; defer. (T14)
- **`themeManager`, `menuState`**: cosmetic state holders. (T15, T16)
- **`ratelimit.ts`**: tiny surface, only two call sites. Pay back too low to
  earn shelf space today. (T17)
- **Logger formatting**: brittle, cosmetic, low value. (T18)
- **Email template rendering**: visual; the template will change. (T19)
- **Bits-UI component structure (Dialog, Menu, AccessCard…)**: pure presentational
  wrappers; snapshot tests would rot. (T21)
- **DnD reorder rank renumbering**: see L6 — the wiki says one thing and the
  code does another; writing a test now would lock the wrong behaviour in.
- **The full SSR/CSR boundary for `+page.ts`**: `ssr: false` everywhere on the
  list view, no special SSR logic to test.
- **`hooks.server.ts` end-to-end**: SvelteKit framework code; minimal custom
  logic; better tested via the integration paths above.

---

## Recommended next-step plan

Sequencing depends on B4 and B5 being on the backlog already. The audit
recommends the manager file items in this order, with the noted constraints.

### Must land before B4 begins
- **T3** is part of B4 itself (the regression test it already promises) but
  must be written to exercise the component path, not just `actions.ts`. This
  is a constraint on B4's spec-writer, not a separate item.
- Before B4 starts, the manager should **read L7** and decide whether B4 is
  actually a bug fix or a wiki/observation reconciliation. If T3 doesn't
  reproduce against current code, B4 changes shape.

### Must land before B5 begins
- **T4** — characterise the current "group disappears when emptied"
  behaviour. B5's tests-first cycle needs a red baseline; without T4 the
  red→green pivot is invisible. File T4 as the first item after this audit
  is approved.

### Highest risk × value (file first)
1. **T1** — silent data-loss bug. File as a `bug` card (full track,
   tests-first). The fix is server-side (L1's option 1).
2. **T5** — `mergeUsers` lock-down. File as a `feature`-flavoured chore card
   (tests-first), and use it as the vehicle to land L10's transaction wrap.
3. **T4** — characterisation test for B5 safety (see above).
4. **T2** — authz hole on `upsert_lists`. File as a `bug` card.
5. **T10** + **T9** — slug-collision sync-batch failure. File together as
   a single `bug` card (T9 is just the foundation for T10).
6. **T6** + **T7** + **T8** — invariant lock-down for the CTE and validator.
   Group as a single `chore` card ("CTE invariant safety net") with three
   tests, since none of them changes behaviour, only verifies it.
7. **T11** + **T12** — pending-ops + reconciliation invariants. File as a
   single `chore` card ("sync engine invariant safety net").

### Also surfaced but not test work
- **L3** — file a `chore` ("wiki-sync: reconcile sync-engine.md and data-flow.md
  with Supabase Realtime reality"). Could be done by `/wiki-sync`.
- **L4** — file a `lite` chore ("replace `console.error` in `supabase-auth.ts`
  with the shared logger").
- **L8** — file a `research` or `chore` to decide whether to build the
  restore UI or update the wiki.
- **L9** — file a `chore` to reconcile the `sessions.expires_at` divergence.
- **L6** — file a `research` to decide between implementing the wiki's
  promised midpoint-float reorder vs updating the wiki to "Date.now()-style
  full renumber". Don't write a test until this is decided.

### Suggested order to feed the manager
1. **T4** (B5 prerequisite — file first, even before T1)
2. **L7 read + T3-as-part-of-B4** (B4 prerequisite)
3. **T1** (highest-impact bug)
4. **T5** (highest-impact regression vector)
5. **T2**, **T10/T9** (real bugs, smaller blast radius)
6. **T6/T7/T8** (invariant net)
7. **T11/T12** (invariant net)
8. The non-test chores from L3/L4/L8/L9/L6 in whatever order suits.
