# Design Specification

## Approved direction

The frontend uses a dark studio workspace: charcoal surfaces, restrained violet
accents, and clear typography inspired by game development tools. The user
approved this direction and a dashboard foundation scope on October 31, 2026.
Keep **MERN Stack Project** as the product name until the team approves branding.

## Principles

- Prioritize project work and readable information over decoration.
- Use real API data for every count, status, and progress indicator.
- Provide explicit loading, empty, error, disabled, and focus states.
- Keep existing API contracts and workflows compatible with web and mobile.

## Color

| Role        | Value     | Usage                                   |
| ----------- | --------- | --------------------------------------- |
| Background  | `#111116` | Page canvas                             |
| Sidebar     | `#16161e` | Workspace navigation                    |
| Surface     | `#1a1a23` | Panels and summary cards                |
| Border      | `#363641` | Structural divisions                    |
| Text        | `#f2f1f8` | Primary text                            |
| Muted text  | `#b5b3c5` | Descriptions and secondary labels       |
| Accent      | `#c4afff` | Primary buttons and selected navigation |
| Accent text | `#21113f` | Text on accent buttons                  |
| Error text  | `#ffced6` | Errors on dark rose backgrounds         |

Dark mode is the first implementation. A theme switcher is outside this PR.
Status colors always accompany text labels; do not rely on color alone.

## Typography

Use the system sans-serif stack to avoid remote font downloads. Body text uses
1.5 line height. Headings use 1.2 line height; the main heading scales from
1.8rem to 2.6rem. Small uppercase labels are reserved for navigation context.
Task names, feedback, and forms use normal readable text rather than pixel fonts.

## Layout and spacing

Desktop: 268px sidebar and flexible content with a 1440px maximum width.
Use 8px-based spacing, 24px panel padding, 16–24px grid gaps, and 36px desktop
content padding. At 1100px, summary cards become two columns and overview panels
stack. At 760px, navigation moves above content and wraps into labeled buttons.
All grids permit narrow screens without horizontal page scrolling.

## Components and navigation

- `components/AppShell.jsx`: workspace navigation, breadcrumbs, account control,
  skip link, and focus management after navigating.
- `components/Forms.jsx`: associated field labels and alert messages.
- `components/ProjectOverview.jsx`: computed summary cards, progress, upcoming
  incomplete milestones, and links to existing project tools.
- `screens/`: authentication, team list, team details, and project workspace.
- Project navigation: Overview, Milestones, Tasks, Bug reports, Playtest feedback.
- Navigation remains React state based in this foundation. Refresh returns to
  Teams; URL routing and deep links need a separate approved change.
- Requests use the existing `api.js` helper. No new runtime UI dependencies.

## Interaction and accessibility

Use native buttons, labeled controls, semantic landmarks, a breadcrumb list,
`aria-current` navigation, a keyboard skip link, and visible focus outlines.
Controls have a minimum 44px height. Disable forms during their submissions and
surface API errors through an alert. Report loading and saving through status
messages. Cancel initial screen requests on unmount. Project status updates must
update React state only after a successful response, never mutate props.

Use WCAG AA text contrast as the target. Respect reduced-motion preferences;
this foundation does not introduce animation or motion-dependent interactions.
Lighthouse >=95 remains a deployment acceptance target, not a claimed result.

## Voice and tone

Use direct language and familiar game development terms. Encourage the next
concrete action in empty states. Do not advertise unsupported build submissions,
notifications, account verification, or password recovery.

## Decision log

| Decision                           | Rationale                                           |
| ---------------------------------- | --------------------------------------------------- |
| Dark studio with violet accents    | Approved game development visual direction          |
| Keep current product name          | Branding remains a team decision                    |
| Foundation before full redesign    | Keep the first change reviewable                    |
| Existing React/Vite/CSS stack      | Avoid adding dependencies or changing API contracts |
| Real counts, including zero states | Keep the dashboard truthful and useful              |

## Open questions and later scope

Permanent branding, URL routing, a task board, search/filter design, richer
editing/deletion, and a light theme require later scope decisions. Backend team
permissions and email verification/recovery remain separate backend work.
