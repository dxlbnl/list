---
title: Lab-Bench aesthetic + design tokens
type: decision
status: accepted
tags: [design, aesthetic, tokens, css-variables, theme, dark-mode]
---
The UI follows a **"Lab-Bench"** aesthetic — minimalist, information-dense, dark-mode-native (deep-grey `#0a0a0a` root), with monospaced technical accents (`JetBrains Mono` for IDs, status, buttons, and "ADD"-style actions; `Inter` for body) and high-contrast blue micro-interactions. All design tokens are defined once in `:root` in `src/app.css` and MUST be consumed via `var(--token)` — never hardcode colours or spacing (enforced by the [vanilla-CSS convention](css.md)). Token families: backgrounds `--bg-0..3`, foregrounds `--fg-0..3`, `--accent`/`--accent-muted`, `--danger`/`--danger-muted`, `--success`/`--success-muted`, `--border`/`--border-hover`, spacing `--space-1..12`, radii `--radius-sm/md/lg`, shadows `--shadow-sm/md/lg/xl`, fonts `--font-sans`/`--font-mono`.

**Why:** a single token source keeps the Lab-Bench look coherent across every component and makes restyling a single-point change; hardcoded values drift and quietly break the theme.
