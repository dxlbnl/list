# Design Philosophy & Design System

The List App follows a **"Lab-Bench"** aesthetic: a minimalist, high-performance, and technically-oriented design language inspired by terminal interfaces and laboratory equipment.

## Core Philosophy

1. **Information Density**: Prioritize clarity and content over excessive whitespace.
2. **Technical Accents**: Use monospaced fonts (`JetBrains Mono`) for technical data, actions, and status indicators to emphasize the "tool-like" nature of the app.
3. **Dark-Mode Native**: Optimized for low-light productivity with a deep grey/black palette (`#0a0a0a` root).
4. **Vibrant Micro-Interactions**: Use subtle animations and high-contrast accents (`--accent: #3b82f6`) to provide clear feedback.

## Global Style Setup (`app.css`)

All global tokens are defined in `src/app.css` under `:root`.

### Color Palette (Lab-Bench Dark)
- `var(--bg-0)` through `var(--bg-3)`: Progressive depths of grey.
- `var(--fg-0)` through `var(--fg-3)`: Typography hierarchy from white to muted grey.
- `var(--accent)`: Primary technical blue.
- `var(--danger)`: Alert/Delete red.

### Typography
- **Sans**: `Inter` for readability in lists and labels.
- **Mono**: `JetBrains Mono` for IDs, status text, buttons, and "ADD" actions.

## Standard Patterns

### The Input Group
Used for adding items and list creation. It combines a technical prefix (`>`), a monospaced input, and an integrated action button.

```html
<div class="input-group">
  <div class="input-prefix">></div>
  <input type="text" placeholder="COMMAND" />
  <button class="input-action-btn">EXECUTE</button>
</div>
```

### Utility Classes
- `.mono`: Force monospaced font.
- `.muted`: De-emphasize text (`--fg-2`).
- `.small` / `.tiny`: Consistent font scaling.
- `.transition-all`: Standardized cubic-bezier transitions for hover states.

## Component Styling
All components must use these global variables rather than hardcoded values to ensure the "Lab" theme stays consistent across the entire application.
