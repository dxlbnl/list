# TODO List

## Core Infrastructure
- [x] Initial SvelteKit 5 scaffolding
- [x] Database Schema (Postgres + Drizzle)
- [x] Offline-First Database (IndexedDB + Dexie.js)
- [x] Anonymous Magic Sessions
- [x] Magic Link Auth Flow
- [x] Email registration & Account Merging (Recovery)
- [x] Design System (Vanilla CSS + Lab-Bench aesthetic)

## Sync Engine
- [x] Client-side Sync Queue
- [x] Server-side Batch Sync API
- [x] Server-Sent Events (SSE) for real-time updates (Pull)
- [x] SSE Reconnection & Snapshot Reconciliation logic

## Feature Implementation
- [x] List Creation (Offline-first)
- [x] Item CRUD (Offline-first)
- [x] Soft Deletes
- [ ] List Sharing (Invite links/QR Codes)
- [x] Session Cloning (QR code to move session to another device)
- [ ] Item Restoration UI (Creatable Select with Bits UI)
- [x] Drag & Drop (svelte-dnd-action integration)

## UX & Polish
- [x] Lab-Bench Design System (Inputs, Buttons, Cards)
- [x] Loading states for sync operations
- [ ] Error handling & Toast notifications
- [x] Mobile responsive refinements (Header & UserMenu)
- [ ] Accessibility audit (focus management, ARIA)
- [ ] UX: Hide group header if only one group exists

## Findings & Bugs
- [x] Fixed UserMenu Bits UI scoping and Portal issues
- [x] Fixed Dialog centering and QRCode generation imports
- [x] Moved context-aware actions to UserMenu
