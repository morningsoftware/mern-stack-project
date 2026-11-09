# Design Specification

## Approved direction

The user approved a Codecks-inspired indie-studio personality combined with a
HacknPlan-style production workspace. This replaces the initial charcoal/violet
dashboard direction.

The implementation uses warm paper surfaces, forest-green navigation, rust
controls, compact work cards, and restrained serif project headings. Its main
screen is the task board. Inspiration informs hierarchy and tone, not copied
brand assets or proprietary artwork.

## Principles

- Show actual development work before decorative metrics.
- Use project context and plain labels instead of promotional slogans.
- Keep counts derived from API data; never invent activity, art, or builds.
- Use text alongside color for every state and priority.
- Keep native controls and keyboard-accessible alternatives to gestures.

## Color and typography

| Role                | Value     | Usage                   |
| ------------------- | --------- | ----------------------- |
| Canvas              | `#f3f0e7` | Warm paper background   |
| Surface             | `#fcfaf4` | Forms and detail panels |
| Navigation          | `#283c31` | Forest sidebar          |
| Primary text        | `#29332b` | Ink-colored body copy   |
| Muted text          | `#5e6759` | Secondary information   |
| Borders             | `#c9ccbb` | Quiet divisions         |
| Accent              | `#934125` | Rust primary actions    |
| Selected navigation | `#e7dba9` | Warm yellow on forest   |

Use system sans-serif for controls/body copy, Georgia for project headings and
small overview totals, and system monospace for short record identifiers. No
remote font downloads. Use 3–4px corner radii and minimal shadows. Avoid gradients,
large matching KPI cards, arbitrary numbered menus, and oversized uppercase copy.

### Dark theme

A persisted light/dark theme is supported. The initial theme follows the
operating system; the toggle in the sidebar brand (and top-right of the sign-in
screen) overrides it and stores the choice. Dark mode keeps the same forest/rust
personality rather than switching to neutral gray: canvas `#171d19`, surfaces
`#212923`, borders `#465246`, ink `#eee9dc`, muted text `#a7b1a2`, accent
`#c06a45`, and navigation `#101712`. The selected navigation color, status
meanings, and focus treatments stay consistent between themes.

## Layout

Desktop: a 234px sidebar with a flexible work area. The board uses three status
columns: To do, In progress, Done. Under 1150px, columns stack; under 760px,
navigation moves above content and wraps. Filters wrap and inputs retain usable
width. Detail drawers occupy the right edge on desktop and the screen on mobile.

The desktop sidebar stays pinned to the viewport with its own scroll area, and
the profile/sign-out block remains anchored at its bottom regardless of page
length. The workspace bar also stays visible while the work area scrolls.
Changing teams, projects, or project views returns the work area to the top and
focuses the main landmark. The task board shares the standard panel frame with
the milestones, bugs, and feedback tabs so their headings begin at the same
inset.

Overview totals form a compact ledger rather than four decorative cards. Use
16–24px spacing and thin separators. Artwork and logos require separate approval.

## Features and contracts

- `features/work/TaskBoard.tsx`: search title/description, assignee, priority,
  milestone, and My work filters. Filters combine and can be cleared. They operate
  on the loaded project records, not the complete database.
- Status selectors move tasks between columns through existing PATCH endpoints.
  Drag/drop is not required; every move works with a keyboard and touch.
- `features/work/ItemDrawer.tsx`: fetch fresh task/bug detail, edit existing API
  fields, save, or cancel. Native modal dialog provides focus containment/Escape.
  Return focus on close and preserve edits when a save fails.
- `features/work/BuildLibrary.tsx`: version, platform, release notes, HTTPS link.
  The user approved external links rather than storing uploaded game binaries.
  Feedback can optionally reference a build in the same project.
- `components/AuthBackdrop.tsx`: a procedurally generated ink-terrain backdrop
  for the signed-out screen. It is theme-aware, pauses when hidden, renders a
  static frame under reduced motion, and must not enter the signed-in bundle.
- React state still controls navigation. Deep links remain separate scope.
- No new runtime UI libraries except `three`, explicitly approved for the
  lazy-loaded auth backdrop only. Existing API contracts remain compatible;
  build endpoints and optional feedback buildId are additive.

## Accessibility and errors

Use visible focus outlines, a skip link, semantic landmarks, associated labels,
status/alert messages, and at least 42px controls (36px for compact card selects).
Native dialogs provide keyboard focus containment; browser testing is required
because DOM fixtures do not simulate top-layer or layout behavior. Disable
submissions during mutations. Never move a card on a failed server response.
Respect reduced motion. WCAG AA and Lighthouse >=95 remain acceptance targets,
not claimed scores.

Dropdowns size to the selected value, and their chevron is inset by the same
spacing used above and below it so it does not hug the control edge. Text inputs
may still use the full form width. Values shown to people use readable labels
such as "In progress" and "macOS" while API values remain unchanged. Empty
states say what to do next and offer the relevant action when one exists.

## Motion

Use restrained, standard expressiveness rather than decorative looping
animation. Screens and tabs fade in with a 3–7px rise over 140–240ms; drawers
slide in from the right; controls transition background, border, and color;
work cards lift 1px on hover. The three.js auth backdrop is the only ambient
animation and may drift slowly with pointer parallax. All CSS motion and the
backdrop respect reduced-motion preferences, and the backdrop pauses while the
tab is hidden.

## Approved decisions and remaining scope

| Decision                             | Reason                                     |
| ------------------------------------ | ------------------------------------------ |
| Warm indie studio + production board | User approved B+C references               |
| Keep product name                    | Permanent branding remains a team decision |
| Board first, overview second         | Work is more useful than generic metrics   |
| External build links                 | User chose links over file storage         |
| Optional build-specific feedback     | Existing general feedback stays compatible |
| Dark theme                           | User requested it for the studio workspace |
| Standard motion with reduced-motion  | Adds dimension without distracting from work |
| three.js auth backdrop (exception)   | User approved a procedural signed-out scene |

Uploads, comments/activity history, notifications, final branding, and URL routing
remain separate scope. Backend authorization for older resources and account
verification/recovery remain separate work. Build publishing/editing requires
team membership; build reads use the existing authenticated project model.
