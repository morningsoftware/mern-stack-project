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

## Layout

Desktop: a 234px sidebar with a flexible work area. The board uses three status
columns: To do, In progress, Done. Under 1150px, columns stack; under 760px,
navigation moves above content and wraps. Filters wrap and inputs retain usable
width. Detail drawers occupy the right edge on desktop and the screen on mobile.

Overview totals form a compact ledger rather than four decorative cards. Use
16–24px spacing and thin separators. Artwork and logos require separate approval.

## Features and contracts

- `features/work/TaskBoard.jsx`: search title/description, assignee, priority,
  milestone, and My work filters. Filters combine and can be cleared. They operate
  on the loaded project records, not the complete database.
- Status selectors move tasks between columns through existing PATCH endpoints.
  Drag/drop is not required; every move works with a keyboard and touch.
- `features/work/ItemDrawer.jsx`: fetch fresh task/bug detail, edit existing API
  fields, save, or cancel. Native modal dialog provides focus containment/Escape.
  Return focus on close and preserve edits when a save fails.
- `features/work/BuildLibrary.jsx`: version, platform, release notes, HTTPS link.
  The user approved external links rather than storing uploaded game binaries.
  Feedback can optionally reference a build in the same project.
- React state still controls navigation. Deep links remain separate scope.
- No new runtime UI libraries. Existing API contracts remain compatible; build
  endpoints and optional feedback buildId are additive.

## Accessibility and errors

Use visible focus outlines, a skip link, semantic landmarks, associated labels,
status/alert messages, and at least 42px controls (36px for compact card selects).
Native dialogs provide keyboard focus containment; browser testing is required
because DOM fixtures do not simulate top-layer or layout behavior. Disable
submissions during mutations. Never move a card on a failed server response.
Respect reduced motion. WCAG AA and Lighthouse >=95 remain acceptance targets,
not claimed scores.

## Approved decisions and remaining scope

| Decision                             | Reason                                     |
| ------------------------------------ | ------------------------------------------ |
| Warm indie studio + production board | User approved B+C references               |
| Keep product name                    | Permanent branding remains a team decision |
| Board first, overview second         | Work is more useful than generic metrics   |
| External build links                 | User chose links over file storage         |
| Optional build-specific feedback     | Existing general feedback stays compatible |

Uploads, comments/activity history, notifications, final branding, and URL routing
remain separate scope. Backend authorization for older resources and account
verification/recovery remain separate work. Build publishing/editing requires
team membership; build reads use the existing authenticated project model.

## OAuth sign-in and account settings

- Purpose: offer an alternate way to authenticate without replacing the
  existing password form, and let signed-in users manage their sign-in methods.
- Placement: OAuth provider links sit inside the existing auth panel below the
  password form, preceded by “Or continue with”. Account settings open from the
  **Account** action in the workspace sidebar.
- Treatment: text-only provider links using the secondary button-link treatment.
  Provider logos are intentionally omitted for now to avoid unofficial
  branding; add official assets only with the provider’s current brand guidance.
- Providers: only those returned by `GET /api/auth/oauth/providers` are shown,
  so a provider that is not configured is never presented as an option.
- Copy: “Continue with Google”, “Continue with GitHub”, and “Continue with
  Discord”.
- New-account onboarding: a full-page panel using the existing `.panel`,
  `.stack`, and `Field` patterns. Email is read-only, username and display name
  are editable, and role uses the existing `USER_ROLES` select.
- Existing-account linking: a full-page password confirmation panel explaining
  that the email already has an account and that the password is needed once to
  link the provider.
- Account settings: a workspace panel with password management and connected
  accounts. Providers returned by `GET /api/auth/oauth/providers` that are not
  linked appear below as **Link <Provider>** links.
- Last sign-in method: when an account has no password and only one provider,
  **Unlink** is disabled and the reason is stated in text. The server enforces
  the same rule.
- Accessibility: provider links are real anchors, keyboard reachable, and
  labeled with text. Read-only email uses the existing disabled visual
  treatment. Errors use `ErrorNote`; success messages use `role="status"`.
- Code: `client/src/screens/AuthScreen.tsx`,
  `client/src/screens/OAuthScreens.tsx`,
  `client/src/screens/AccountScreen.tsx`, and
  `client/src/components/AppShell.tsx`.

## Decision Log

- **2026-11-01 — OAuth sign-in:** Added Passport-based Google, GitHub, and
  Discord sign-in. Provider emails must be verified. Existing password accounts
  require a one-time password confirmation before a provider is linked; new
  accounts complete an onboarding form before a user document is created. The
  browser handoff uses hashed, single-use codes delivered in a URL fragment,
  never a JWT in the URL. Rationale: preserve the existing JWT/Mongo auth flow
  while avoiding account takeover through unverified local email registration.
  Local email verification remains out of scope for this change.
- **2026-11-09 — OAuth persistence hardening:** Added OAuth collections to
  database setup, TTL indexes for expiring state/codes/challenges, and a unique
  index on the provider account pair. Rationale: expire abandoned handoffs
  automatically and make provider-account uniqueness a database guarantee
  rather than an application-only check.
- **2026-11-09 — Cookie sessions and CSRF:** Browser sessions now use an
  httpOnly JWT cookie with a paired readable, HMAC-signed CSRF cookie and
  same-origin checks on mutations. Bearer tokens remain for non-browser
  clients. Rationale: sessionStorage exposes the token to script injection;
  cookies keep it out of JavaScript while signed double-submit CSRF,
  `SameSite=Lax`, and origin checks protect state-changing requests.
- **2026-11-09 — Account settings:** Added a signed-in account screen for
  password management and provider linking/unlinking. Unlinking the last
  sign-in method is blocked until a password exists. Rationale: OAuth-created
  accounts otherwise have no recovery path, and users need to manage provider
  connections without starting a new sign-in flow.
- **2026-11-09 — Account entry point:** Account settings open from the workspace
  sidebar rather than the teams header so they remain reachable from every
  project view. Rationale: the app shell owns global account actions.
