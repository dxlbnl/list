# Soft Deletes & Item Restoration

Deleted items are never truly removed, allowing for quick re-addition of common grocery items.

## Mechanism
- Deleting an item sets its `deleted_at` timestamp.
- The default view filters out items where `deleted_at` is not null.

## Restore UX
- A "Search/Add" input at the top of the list acts as a **Creatable Select**.
- As the user types, it searches the local Dexie DB for previously deleted items.
- If a deleted item is selected, its `deleted_at` is nullified, and it is restored to its previous position (retaining its `rank` and `group_name`).
- If the item doesn't exist, a new one is created.

## Purging
- (Optional) Items older than X months with `deleted_at` set may be permanently purged to keep the local DB size manageable.
