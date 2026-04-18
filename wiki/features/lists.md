# List Management

Core functionality for interacting with grocery lists.

## Ordering (Float Ranking)
- Items are ordered by a `rank` column (type: `double precision`).
- To move an item between items A (rank 1.0) and B (rank 2.0), the new rank becomes `1.5`.
- This avoids cascading updates across the entire list.
- If the precision limit is reached, a re-normalization pass is triggered.

## Groups
- Items can be assigned to groups (e.g., "Produce", "Dairy").
- The UI uses `svelte-dnd-action` to allow dragging items between these group containers.
- Dragging an item into a group updates its `group_name` and `rank` properties.

## UX Principles
- **Speed**: Local-first writes mean zero lag on drag/drop or checkbox toggles.
- **Clarity**: Simple, namespaced CSS ensures the UI stays clean and lightweight.
- **Accessibility**: Using Bits UI ensures keyboard navigation and screen readers are supported out of the box.
