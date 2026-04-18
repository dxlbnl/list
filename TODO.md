# TODO List

## Core Infrastructure
- [x] Initial SvelteKit 5 scaffolding
- [x] Database Schema (Postgres + Drizzle)
- [x] Offline-First Database (IndexedDB + Dexie.js)
- [x] Anonymous Magic Sessions
- [x] Magic Link Auth Flow
- [x] Design System (Vanilla CSS + Lab-Bench aesthetic)

## Sync Engine
- [x] Client-side Sync Queue
- [x] Server-side Batch Sync API
- [ ] Server-Sent Events (SSE) for real-time updates (Pull)
- [ ] SSE Reconnection & Snapshot Reconciliation logic

## Feature Implementation
- [x] List Creation (Offline-first)
- [x] Item CRUD (Offline-first)
- [x] Soft Deletes
- [ ] List Sharing (Invite links/QR Codes)
- [ ] Session Cloning (QR code to move session to another device)
- [ ] Item Restoration UI (Creatable Select with Bits UI)
- [ ] Drag & Drop (svelte-dnd-action integration)

## UX & Polish
- [ ] Loading states for sync operations
- [ ] Error handling & Toast notifications
- [ ] Mobile responsive refinements
- [ ] Accessibility audit (focus management, ARIA)

## Findings & Bugs
- *Log findings here as you go over the app...*
