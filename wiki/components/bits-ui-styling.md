# Styling Bits UI Components

Because **Bits UI** is a headless component library, styling requires a specific approach to avoid Svelte's CSS purging and ensure consistent themes.

## The `:global` Requirement

Svelte's compiler scoped CSS only tracks classes applied to **native HTML elements** (like `div`, `button`, etc.) within the same file. 

When you apply a class to a Bits UI component:
```svelte
<Collapsible.Root class="my-container">
```
Svelte flags `.my-container` as **unused** because it doesn't "see" it on a native element. To prevent the compiler from stripping these styles, they **MUST** be wrapped in a `:global` block.

### Best Practice Example
```svelte
<script>
  import { Collapsible } from "bits-ui";
</script>

<Collapsible.Root class="group-container">
  <Collapsible.Trigger class="group-trigger">
    ...
  </Collapsible.Trigger>
</Collapsible.Root>

<style>
  :global {
    .group-container {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border);
    }

    .group-trigger {
      padding: var(--space-2);
      &:hover {
        background: var(--bg-2);
      }
    }
  }
</style>
```

## Design Tokens (CSS Variables)
Always use the global design tokens defined in `src/app.css`. This ensures that even "global" styles remain consistent with the overall Lab-Bench aesthetic.

- **Colors**: `var(--bg-1)`, `var(--accent)`, `var(--danger)`
- **Spacing**: `var(--space-2)`, `var(--space-4)`
- **Radii**: `var(--radius-md)`, `var(--radius-lg)`

## Why no Tailwind?
We avoid Tailwind to keep the markup readable and to leverage the full power of modern CSS features like Nesting and Container Queries without the "class soup" common in utility-first frameworks.
