# Global CSS Strategy

How we style components without Tailwind or Svelte's standard scoped CSS issues.

## The Problem
Svelte's scoped CSS compiler often removes classes it thinks are "unused" if they are only passed as props to child components (e.g., when passing a class to a Bits UI component).

## The Solution: Global Namespacing
- **`app.css`**: Reserved for resets, typography, and global CSS variables (colors, spacing).
- **Component Styles**: Styles will stay inside the Svelte component's `<style>` tag.
- **Global Scope**: To prevent the compiler from stripping classes passed to child/headless components, all component-specific styles will be wrapped in a `:global {}` block.
- **Namespacing**: To avoid collisions in the global scope, all classes must be prefixed with a namespace (e.g., `.list-` or `.ui-`).
- *Example:*
  ```svelte
  <style>
    :global {
      .list-trigger {
        background: var(--bg-1);
      }
    }
  </style>
  ```

## Variable System
- We define a core set of CSS variables for colors, spacing, and typography in `:root`.
- This ensures a cohesive "Chakra-like" design system without the overhead of a large library.

## No Tailwind
- We write standard, modern CSS.
- This keeps the markup clean and avoids "class soup".
- We leverage CSS Grid and Flexbox for all layouts.
