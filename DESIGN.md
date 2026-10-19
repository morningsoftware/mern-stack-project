# Design Specification

This document is the authoritative design specification for the project. It
defines the visual language and interaction patterns for everything
user-facing. [`AGENTS.md`](./AGENTS.md) requires contributors to read this file
before any UI, styling, or user-facing copy work, and to update it whenever a
design decision is made.

## How to Use This Document

- Every defined value here as a rule, not a suggestion.
- Reference the section name in review comments when requesting a change.
- Add new sections as the design language grows; keep the table of contents in
  sync.
- Record decisions with their rationale.

## Contents

1. [Design Principles](#design-principles)
2. [Color](#color)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Iconography](#iconography)
7. [Motion](#motion)
8. [Accessibility](#accessibility)
9. [Voice & Tone](#voice--tone)
10. [Decision Log](#decision-log)
11. [Open Questions](#open-questions)

## Design Principles

_To be defined._

Guiding values that resolve ambiguous design decisions. Example format:

- **Clarity over decoration.** Prefer legible, obvious interfaces to visual
  flourishes.
- **Consistency beats novelty.** Reuse existing patterns before creating new
  ones.

## Color

_To be defined._

Document the palette, semantic roles, and usage rules. Example format:

| Token             | Value     | Role                                |
| ----------------- | --------- | ----------------------------------- |
| `--color-primary` | `#______` | Primary actions, active states      |
| `--color-bg`      | `#______` | Page background                     |
| `--color-text`    | `#______` | Default body text                   |
| `--color-danger`  | `#______` | Errors and destructive actions      |

Rules to define:

- Light/dark mode support and how colors map between them.
- Contrast requirements (see [Accessibility](#accessibility)).
- Which colors are off-limits for text, backgrounds, or states.

## Typography

_To be defined._

Document font families, sizes, weights, line heights, and usage. Example
format:

| Token             | Family | Size   | Weight | Line height | Use            |
| ----------------- | ------ | ------ | ------ | ----------- | -------------- |
| `--font-heading`  | `____` | `__px` | `___`  | `___`       | Page headings  |
| `--font-body`     | `____` | `__px` | `___`  | `___`       | Body copy      |

Rules to define:

- Type scale and responsive adjustments.
- Fallback fonts and loading strategy.
- Maximum line length for readability.

## Spacing & Layout

_To be defined._

Document the spacing scale, grid, breakpoints, and container rules. Example
format:

| Token          | Value  | Use                          |
| -------------- | ------ | ---------------------------- |
| `--space-xs`   | `_px`  | Tight spacing inside inputs  |
| `--space-md`   | `_px`  | Default component spacing    |

Rules to define:

- Base spacing unit and allowed multiples.
- Breakpoints and mobile-first behavior.
- Maximum content width and alignment.

## Components

_To be defined._

For each shared component (buttons, inputs, cards, modals, navigation, etc.),
document:

- Purpose and when to use it (and when not to).
- Variants, sizes, and states (default, hover, focus, active, disabled,
  loading, error).
- Anatomy and spacing.
- Accessibility requirements.
- Code location, once implemented.

## Iconography

_To be defined._

- Icon library or source.
- Stroke/fill style, sizing, and alignment rules.
- When icons may stand alone vs. require a text label.
- Accessible labeling requirements.

## Motion

_To be defined._

- Allowed durations and easing curves.
- What should and should not animate.
- Reduced-motion behavior.

## Accessibility

_To be defined._

- Meet WCAG 2.1 AA contrast for text and interactive elements.
- Every interactive element is keyboard reachable with a visible focus state.
- Use semantic HTML before ARIA; label all non-text controls.
- Never convey meaning through color alone.
- Respect `prefers-reduced-motion`.

## Voice & Tone

_To be defined._

- Product personality and tone for UI copy.
- Terminology and capitalization rules.
- Error, empty-state, and success message patterns.
