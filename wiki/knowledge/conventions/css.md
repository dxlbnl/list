---
title: Vanilla namespaced CSS
type: pattern
status: accepted
tags: [css, styling, svelte, global, tokens, no-tailwind]
---
UI styling is vanilla CSS written inside each component's `<style>`, wrapped in a single `:global { ... }` block; no Tailwind (binding — [the-rules](../project/the-rules.md)). Class names are manually namespaced after the component or page (`.user-menu-container`, `.list-group-item-row`, `.share-qr-image`) and all rules nest under one unique root class so the global scope does not leak. Never hardcode colours or spacing — use `var(--token)` from `app.css` (see [design](design.md)). Styling headless primitives uses the same block (see [bits-ui](bits-ui.md)).

**Why:** Svelte's scoped-CSS compiler only tracks classes it sees applied to native HTML elements in the same file, so it strips styles that target Bits UI components or portaled/DnD nodes rendered outside the component tree (dialogs, menus, the `#dnd-action-dragged-el` drag ghost). `:global` disables that stripping; manual namespacing under a unique root class buys back the collision-safety `:global` would otherwise throw away.
