---
title: AI proposals — capabilities and atomic acceptance
type: mechanism
status: accepted
tags: [ai, proposals, tokens, sync, security]
---
AI links grant proposal-only access to a single list. Both permanent link tokens and independent proposal edit tokens use 32 random bytes; only SHA-256 hashes persist. Agent routes bypass anonymous-session creation and require explicit header credentials. The public contract is `static/ai-openapi.json`, served at `/api/ai/openapi.json`; secrets travel in a link fragment, never a request URL.

Every service call runs inside a transaction. Agent requests lock their link before their proposal, serializing revocation with access; decisions lock list membership and the proposal. Pending-only edits/decisions require the observed version, and expiry is enforced lazily against a fixed seven-day deadline. Repeated completed decisions return the same state. Acceptance calls the [existing sync processor](server-modules.md) before marking accepted in the same transaction, so retries cannot create duplicate items and failures roll back both changes. Items converge through the ordinary [cursor/realtime flow](sync-model.md). Proposal/link tables have RLS enabled with no client policies; only the privileged server DB connection accesses them. [Vercel rate limiting](../domain/auth.md) remains external; release preparation must verify coverage of the new routes.
