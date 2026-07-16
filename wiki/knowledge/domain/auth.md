---
title: Passwordless auth — anonymous sessions, merge, clone
type: mechanism
status: accepted
tags: [auth, sessions, magic-link, anonymous, account-merge, qr-clone, rate-limit]
---
Auth is custom and passwordless (no OAuth). Every first-time visitor is automatically given an anonymous user record plus a long-lived session; all their lists belong to that anonymous id. Securing an account sends a magic-link email; on confirmation, a *new* email upgrades the anonymous record in place, while an email that already owns an account triggers a **merge** — the anonymous user's lists and shared-list rows are transferred to the verified account and the anonymous record is deleted (only *after* the token validates). A QR **session clone** (`POST /api/auth/clone`) mints a short-lived magic link that moves the current session onto another device. See [the-rules](../project/the-rules.md), [server-modules](../architecture/server-modules.md).

Sessions persist **indefinitely** server-side — no `expires_at`, no idle or forced expiry; explicit logout is the only way to end one, and logout also wipes the local Dexie DB.

**Why:** persisting sessions forever (D3) gives a login-once UX — the user never re-authenticates unless they choose to (e.g. onto a new device); the cookie's far-future browser expiry is the only client bound, so any future "re-auth for a sensitive action" must add its *own* time-boxed challenge rather than lean on session expiry. Rate limiting is delegated to Vercel platform controls (WAF / function-level limits); the in-app `ratelimit.ts` + `rateLimits` table are deprecated and slated for removal (D4), so do not add or revive in-app rate limiting.
