# Component Guidelines

The List App follows a strict set of patterns for building reusable UI components. These patterns ensure consistency with the "Lab-Bench" aesthetic and solve common Svelte 5 / Bits UI integration challenges.

## 1. Component Wrapping (The UI Layer)

Always wrap third-party libraries (like Bits UI) in local components located in `src/lib/components/ui`. This provides a stable, styled API for the rest of the application.

### Structure
Use a folder-based structure for complex components to keep the API clean:
- `src/lib/components/ui/Menu/index.ts` (Exports all parts)
- `src/lib/components/ui/Menu/MenuContent.svelte`
- `src/lib/components/ui/Menu/MenuItem.svelte`

## 2. Prop Handling

### Avoid Component Directives
Svelte's `class:name` directives are only valid on standard HTML elements. When wrapping components, use a template string in the `class` prop:

```svelte
<!-- BAD -->
<Bits.Item class:danger />

<!-- GOOD -->
<Bits.Item class="item {danger ? 'danger' : ''} {className || ''}" />
```

### Clean Class Names
Always use `className || ''` to prevent the literal string `"undefined"` from appearing in your rendered HTML classes.

### Prop Forwarding
Use `...rest` to forward additional props and standard HTML attributes to the underlying component.

```svelte
<script>
  let { children, class: className, ...rest } = $props();
</script>
<Bits.Content {...rest}>...</Bits.Content>
```

## 3. Styling Patterns

### Modern CSS Nesting
Leverage native CSS nesting to organize sub-elements, states (`:hover`, `[data-highlighted]`), and semantic variants (`.danger`).

### Unique Container Scoping
To prevent global leakage (especially with `:global`), always nest all styles within a unique root class named after the component or page.

**Pattern:**
```css
<style>
  :global {
    .unique-component-root {
      /* All styles here */
      .child-element { ... }
    }
  }
</style>
```

### Portaled Element Naming
Elements rendered in portals (like Bits UI Dialogs, Menus, or Popovers) live outside your component's root in the DOM. To style them safely without leakage:
1. **Uniquely Prefix**: Use the component name as a prefix for all portal-specific classes (e.g., `.user-menu-qr-wrapper`).
2. **Nest Portaled Styles**: Keep these styles in the same `:global` block but outside the main container.

### Mobile-First Visibility
Avoid patterns that hide critical actions (like Delete) behind hover states only. 
- **Rule**: Critical actions must be consistently visible (`opacity: 1` or high contrast) by default to support touch devices.
- **Feedback**: Use background shifts or border color changes for hover feedback instead of basic visibility toggles.

## 4. Data & Persistence Patterns

### Compound Indexing
For high-performance queries involving multiple fields (e.g., `listId` + `groupName`), always define a compound index in `db.ts`.

### IndexedDB Null Safety
IndexedDB compound indexes **do not support `null` values**. 
- **Pattern**: Use an empty string `""` to represent "None" or "General" states in indexed fields to avoid `DataError` crashes.
- **Normalization**: Normalize incoming data from the server (which may use `null`) before saving it to the local Dexie instance.

## 4. Aesthetic Consistency

- **Technical Accents**: Use `::before` or `::after` for technical indicators (like the technical blue left-border on hover).
- **Blur & Transparency**: Use `backdrop-filter: blur()` and semi-transparent backgrounds (`rgba(20, 20, 20, 0.85)`) for overlays to maintain the "Lab-Bench" feel.
- **Micro-Interactions**: Use Svelte transitions (`fly`, `fade`) inside component wrappers to ensure a premium feel across the entire app.
