---
title: Styling headless Bits UI
type: pattern
status: accepted
tags: [bits-ui, css, styling, headless, portals, components]
---
Bits UI ships unstyled headless primitives; you pass them a `class` and style it under the component's [vanilla `:global` block](css.md), using design tokens for colours/spacing/radii. The class must live inside `:global` because it lands on a Bits component rather than a native element, so Svelte's scoped compiler marks it unused and purges it otherwise. Wrap third-party primitives in local `src/lib/components/ui/` components for a stable styled API: forward extra props with `...rest`, and build class strings (`class="item {danger ? 'danger' : ''} {className || ''}"`) — `class:` directives are only valid on native elements, and `className || ''` avoids a literal `"undefined"`. Portaled parts (dialog/menu/popover content) render outside the root, so give them uniquely-prefixed classes (`.user-menu-qr-wrapper`) kept in the same `:global` block.

**Why:** headless means no built-in styles, and Svelte's CSS purge cannot "see" a class on a component, so `:global` is mandatory to preserve it; unique prefixes stop that global scope from leaking into unrelated markup.
