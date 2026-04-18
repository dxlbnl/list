# Database Schema

The database is hosted on Neon (Postgres) and managed via Drizzle ORM.

## Tables

### `users`
Tracks both anonymous magic sessions and registered accounts.
- `id` (text, primary key)
- `email` (text, unique, nullable) - Null for anonymous sessions.
- `email_verified` (boolean, default false)
- `created_at` (timestamp)

### `sessions`
Standard session tracking (Lucia-compatible).
- `id` (text, primary key)
- `user_id` (text, references users.id)
- `expires_at` (timestamp) - Set to year 2099 for "permanent" sessions.

### `magic_links`
Temporary tokens for email verification and account merging.
- `token` (text, primary key)
- `email` (text)
- `user_id_to_merge` (text, references users.id) - The magic session ID to be linked/merged.
- `expires_at` (timestamp)

### `lists`
The top-level container for items.
- `id` (text, primary key) - Random short ID or UUID.
- `name` (text)
- `created_by` (text, references users.id)
- `created_at` (timestamp)

### `list_users`
Maps users to lists for sharing.
- `list_id` (text, references lists.id)
- `user_id` (text, references users.id)
- *Note: Presence in this table grants full edit access.*

### `items`
Individual entries within a list.
- `id` (text, primary key)
- `list_id` (text, references lists.id)
- `name` (text)
- `group_name` (text, nullable) - For categorizing items.
- `rank` (real/double precision) - Float-based ranking for O(1) reordering.
- `done` (boolean, default false)
- `deleted_at` (timestamp, nullable) - For soft delete/restore.
- `updated_at` (timestamp) - Used for conflict resolution during sync.
