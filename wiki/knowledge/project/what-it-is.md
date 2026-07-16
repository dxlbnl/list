---
title: What List is
type: principle
status: accepted
tags: [vision, product, offline-first, collaborative, lists, goals, non-goals]
---

**List** is an offline-first, real-time collaborative list app. Users create lists, add and reorder
items via drag-and-drop, [group](../domain/groups.md) them, and [share](../domain/auth.md) them — every
action taking effect instantly on-device and syncing in the background. It's for individuals and small
groups keeping shared lists (shopping, tasks, planning) across phones and desktops on flaky connections.
It is a web app (SvelteKit on Vercel), not a native app.

Success = every action reflected on-device instantly (no perceptible wait); concurrent edits from
multiple devices converge without lost data; work continues offline and syncs on reconnect;
sharing and moving a session between devices are frictionless. See [sync-model](../architecture/sync-model.md).

**Non-goals:** not a project-management tool (no Gantt/dependencies/time-tracking); no OAuth or
third-party identity (auth is custom magic-link + anonymous sessions); no native mobile apps; not a
notes/wiki/recipe app — the unit is a list of items.

**Why:** most list apps stall when the network does — edits block on a round-trip. List writes locally
first (IndexedDB) for instant feedback and reconciles with the server in the background, so the UI never
waits on the network. That local-first stance is the product's whole reason to exist.
