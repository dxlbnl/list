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

### The Global Wrapper Pattern
When wrapping components that pass classes to hidden or third-party sub-elements, Svelte's compiler often incorrectly flags selectors as "unused." 

**Fix:** Wrap the entire `<style>` block in a `:global {}` block.

```css
<style>
  :global {
    .menu-item {
      display: flex;
      
      &:hover {
        background: var(--bg-2);
      }
      
      .icon-container {
        opacity: 0.7;
      }
    }
  }
</style>
```

**Benefits:**
- Eliminates "Unused CSS selector" warnings.
- Allows standard nesting without repeating `:global()` on every line.
- Correctly targets elements rendered by third-party libraries.

## 4. Aesthetic Consistency

- **Technical Accents**: Use `::before` or `::after` for technical indicators (like the technical blue left-border on hover).
- **Blur & Transparency**: Use `backdrop-filter: blur()` and semi-transparent backgrounds (`rgba(20, 20, 20, 0.85)`) for overlays to maintain the "Lab-Bench" feel.
- **Micro-Interactions**: Use Svelte transitions (`fly`, `fade`) inside component wrappers to ensure a premium feel across the entire app.
