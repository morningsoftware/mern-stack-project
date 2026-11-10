# Design Specification

## Approved direction

The user approved a Codecks-inspired indie-studio personality combined with a
HacknPlan-style production workspace. This replaces the initial charcoal/violet
dashboard direction. The user approved **Checkpoint** as the product name.
Use Checkpoint in the page title, sign-in heading, and workspace brand; repository
and package identifiers remain unchanged.

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

Desktop: a sidebar that defaults to 234px and can be resized between 200px and
420px by dragging its right edge or using the arrow, Home, and End keys while
the separator is focused. The chosen width persists in local storage. Project
navigation is grouped into Plan, Playtest, and Project so the eleven tools stay
scannable; the sidebar scrolls independently while the profile footer stays
visible. Under 1150px, board columns stack; under 760px, navigation moves above
content and the groups flow into compact columns. Spacing follows a 4/8/12/16/24/32
scale. Filters wrap and inputs retain usable width. Detail drawers occupy the
right edge on desktop and the screen on mobile.

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
- Hash URLs identify the team, project, and selected view. React state hydrates
  from authenticated API records; drawer deep links remain separate scope.
- `components/AuthBackdrop.tsx`: a lazy-loaded three.js canvas for the
  signed-out screen. It ships as scene boilerplate — renderer, camera, resize,
  reduced-motion, visibility pausing, pointer hooks, and cleanup — for
  authoring a custom scene. It must not enter the signed-in bundle.
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
slide in from the right and fade out before unmounting; controls transition
background, border, and color; focused inputs transition their border color;
list rows fade their background on hover; work cards lift 1px on hover. The
three.js auth backdrop is the only ambient animation and provides scene
boilerplate for a custom signed-out scene. All CSS motion and the backdrop
respect reduced-motion preferences, and the backdrop pauses while the tab is
hidden.

## Approved decisions and remaining scope

| Decision                             | Reason                                     |
| ------------------------------------ | ------------------------------------------ |
| Warm indie studio + production board | User approved B+C references               |
| Checkpoint branding                  | User approved the game-development name    |
| Board first, overview second         | Work is more useful than generic metrics   |
| External build links                 | User chose links over file storage         |
| Optional build-specific feedback     | Existing general feedback stays compatible |
| Grouped project navigation           | Eleven tools stay scannable in the sidebar |
| 4–32px spacing scale                 | Keeps layouts and actions on one rhythm    |
| Dark theme                           | User requested it for the studio workspace |
| Standard motion with reduced-motion  | Adds dimension without distracting from work |
| three.js auth backdrop (exception)   | User approved a procedural signed-out scene |

Screenshots, activity history, and in-app notifications are now implemented below.
Account verification/recovery, device push, and private-project visibility remain
separate work. Build publishing/editing requires
team membership; build reads use the existing authenticated project model.

## Milestone planning

The user approved dated milestone planning as the next feature set. Use a
calendar-date roadmap, not a Gantt chart: the API has due dates but no start dates
or dependencies. Group milestones chronologically; put undated goals last.

- Filters: All milestones, Open, Overdue, Completed.
- A date is overdue only when its selected calendar day precedes the viewer's
  current local day AND status is not completed. Due today is not overdue.
- Display stored due dates in UTC to preserve the day selected in date inputs.
  Update the local-day comparison once a minute while the workspace is open.
- Linked-task completion counts done tasks belonging to the milestone. Milestone
  status remains an independent explicit choice; no automatic completion.
- Use labeled text plus color for deadlines and native progress elements.
- Open a fresh record in the milestone editor before saving. Preserve form edits
  on errors and allow clearing a due date to return the milestone to Unscheduled.
- Use the existing milestone API; no schema or permission changes in this feature.

## Structured playtesting

The user approved structured playtesting as the next feature set. Keep the warm
studio visual system and existing drawer pattern. Bug forms include a build,
environment, reproduction steps, expected behavior, and observed behavior. Do not
invent these details from a playtester's comment: copy the comment into the
report description and let the reporter fill in the remaining fields.

Feedback triage uses explicit rating/build/review filters rather than inferred
sentiment or an AI-generated summary. Awaiting review and Reviewed are workflow
labels, not claims that a bug is resolved. Only team members see review controls,
with enforcement in the API. Show linked bugs directly below their source report.
Starting a report from feedback must preserve or explicitly replace an unsent
manual report. See docs/structured-playtesting.md for contracts and permissions.

## Task discussions and workflow clarity

The user selected task discussions as the next feature. Put the discussion below
the editable task fields in the existing drawer, with author, time, and plain
text. Load the latest 30 comments and offer Load earlier comments. Keep failed
comment drafts. Discussion is team-only, with API enforcement; it is not an
activity log. Posting and task saving lock competing actions until completion.

Keep the approved palette and typography. New task belongs in the board header
and opens/focuses the existing creation form. Save/create confirmations use a
polite live status region; distinguish successful writes from refresh failures.
Keep drawer edit actions visible with a sticky row inside the form. See
[UX review](docs/ux-review.md) for remaining usability and visual checks.

## Shareable navigation and unsaved work

The user authorized the suggested next usability features: project/view links,
first-milestone guidance, and protection against discarding work. Use hash-based
URLs to preserve existing hosting behavior without a routing dependency. Keep
Copy project link in the workspace bar. Retain drafts when switching project tabs;
ask before leaving their workspace or closing edited drawers. Browser-native
confirmation uses explicit discard language, and beforeunload handles external
navigation/refresh subject to browser behavior. No draft content belongs in URLs.

Preserve intentional focus when an action opens a form; routine navigation still
focuses main content. The skip link focuses main without changing the route.
When there are no milestones, explain the prerequisite and open the milestone
form from a clear action. Never silently create a milestone to satisfy a task.
See [navigation behavior](docs/workspace-navigation.md) for supported links and limits.

## Personal project work

My work is a project-scoped view of current-user assignments, open milestones
linked to their unfinished tasks, and unresolved bugs they reported. It does not
imply bugs have assignees. Completed tasks are opt-in. Prioritize high-priority
work and use the same detail drawers and status controls as the board.

## Bug screenshots

The user authorized screenshots. Attach them to an existing bug through its
drawer: up to three PNG/JPEG/WebP images of at most 2 MiB each, stored in MongoDB
without a paid external service. Reporter/team access is enforced server-side.
Use authenticated blob previews and explicit removal, not public image URLs.
Unsaved selections participate in the existing discard protection.

## Activity history

A team-only, paginated project feed records server-generated actors and selected
field transitions for task/milestone/build/bug/feedback creates and updates. Never
infer historical changes or include comment bodies, credentials, or image bytes.
Use a chronological ledger with explicit refresh and older-page controls. This
operational history is not a tamper-proof compliance audit log.

## In-app notifications

The project inbox shows assignments and new feedback from other people, not
self-generated alerts. Read/unread state is persistent and recipient-private.
Use explicit refresh, an unread filter, and links to related work. This release
does not send email or device push notifications or imply real-time delivery.

## Playtest sessions

Sessions organize one immutable build, explicit test instructions, and a local-time
deadline (stored as UTC). Team members manage sessions; signed-in playtesters can
read and submit feedback while open and before the server-enforced deadline. Show
Open, Closed, and Deadline passed as text. Session feedback keeps its build and
association after submission. General feedback remains available.

## GitHub deliveries

The GitHub App sends every subscribed event to one path,
`/api/github/webhook`. Checkpoint stores a short delivery record in MongoDB:
event name, action, repository name, installation id, and arrival time. GitHub
remains the source for code, pull requests, and check details. A cache is not
used for this record because a team needs the same history after the server
restarts. The GitHub view reuses the existing activity list: a heading, a
refresh control, an empty state, and one line per delivery.

A project can optionally link one repository when it is created, or later from
the GitHub view. The choices come from the signed-in user's GitHub connection.
If that person has not connected GitHub, the repository control is a Connect
GitHub prompt. Checkpoint stores the GitHub login and access token on that user
in MongoDB and never returns the token to the browser. After a repository is
chosen, Checkpoint stores its name and installation id. Later reads of pull
requests, checks, branches, and commits still use the GitHub App installation
token. Deliveries are shown only for the linked repository. Clearing the choice
removes the link and leaves the project in place. If the server is missing the
GitHub OAuth client secret, the control explains that setup instead of sending
the user to GitHub. The callback URL is
`http://127.0.0.1:4000/api/github/callback`.

Each subscribed webhook event is accepted on that same path and stored with a
one-line detail. The project can read open pull requests and check runs for the
linked repository, and it can publish a check run. Workflow, advisory, star,
and watch events are recorded when GitHub sends them; Checkpoint does not call
those APIs.

The GitHub project page uses tabs: Repository, Branches, Commits, Events, and
Pull requests. Repository, branch, and commit details are read from GitHub when
that tab is open. They are not copied into MongoDB. The repository tab shows
the star count, forks, open issues (GitHub includes open pull requests in that
count), visibility, default branch, license, last push, languages, and
contributors. Branches are ordered by latest commit, with the default branch
kept visible. Commit history is the recent history of the default branch.
Arrow keys move between the tabs.

## Team permissions

The release audit closed membership escalation: owners manage membership and team
settings; members write project planning data and assign work only to teammates.
Bug reporters may still maintain their own reports without team membership. The
web UI limits assignee choices and explains owner-only membership management.
Existing authenticated project discovery/read behavior remains available for
playtesting; these controls do not imply private-project visibility.

## November 9 integration and approved checkpoint identity

The user explicitly approved the product name `checkpoint` and requested an intuitive logo. The mark combines a completion check with a milestone flag, using the existing forest/rust palette. `client/public/brand/checkpoint-logo.png` is the approved generated raster asset with transparent edge padding trimmed. The sign-in heading uses the wordmark at up to 320px wide; the sidebar uses the same asset on a paper plate that fills the rail. Both preserve proportions and keep the paper backing in the dark sidebar so the dark wordmark stays readable.

The integrated branch includes milestone planning, structured playtesting, discussions, deep links/draft guards, My work, screenshots, activity, in-app notifications and sessions, plus the GitHub UI. All client and server application source and tests use strict TypeScript.

The dedicated mobile app, email verification/recovery, real browser/device validation and measured Lighthouse targets remain separate required work. Do not imply that the responsive web layout substitutes for the mobile app.

## Mobile playtesting companion — November 9

The user authorized a separate mobile app focused on bug reporting and simple playtesting, with a smaller scope than desktop. `mobile/` is Expo SDK 58 / React Native with Expo Router. SDK 58 replaces the original SDK 57 baseline to match the Expo Go version observed on the team phone. Keep the paper/forest/rust palette, existing wordmark, 4px corners and text-based states. A square app icon uses a geometric check/flag source in `mobile/assets/checkpoint-icon.svg`; the original horizontal wordmark remains unchanged.

Mobile flow: sign in or register as a playtester → search projects → choose a build/session → submit rating/comments or structured bug → optionally attach a screenshot → follow own report status. Desktop retains team management, planning/assignments, feedback triage and GitHub management. Do not add desktop navigation or a WebView to this app.

Use 48px minimum touch controls, explicit field labels, keyboard-aware scroll layouts, native stack navigation and textual submission/error states. Preserve failed form writes and lock duplicate submissions. Attachments happen after saving the report, with a separate retry; never recreate a report when its upload fails. Current unsent drafts are in memory, so leaving a screen/restarting discards them; offline drafts are not claimed. Native credentials use SecureStore. The test-only web target uses sessionStorage and does not replace a physical-device demonstration.

Lighthouse repairs reserve logo dimensions, preload that asset, defer the full authenticated menu until a saved link resolves, and keep unloaded workspace content out of layout until populated. Native platform bundles, automated browser checks, measured local Lighthouse scores and deployed/device results are separate evidence categories.
## OAuth sign-in and account settings

- Purpose: offer an alternate way to authenticate without replacing the
  existing password form, and let signed-in users manage their sign-in methods.
- Placement: OAuth provider links sit inside the existing auth panel below the
  password form, separated by a horizontal rule. Account settings open by
  selecting the profile card (avatar, name, and role) in the workspace sidebar.
- Sidebar actions: the profile card is a button with an accessible label. Sign
  out is an icon-only button with an accessible label and tooltip beside the
  profile card, not below it. While account settings are open, no workspace or
  project navigation item is marked as the current page.
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
- **2026-11-10 — Sidebar account and sign-out actions:** Made the whole profile
  card the account-settings trigger and moved sign out to an icon-only button
  beside it. Account settings count as a separate location, so sidebar
  navigation is no longer highlighted while they are open. Rationale: keep the
  footer compact, make the profile area obviously interactive, and avoid
  implying the user is still in the selected team or project view.
- **2026-11-10 — Resizable sidebar:** Added a draggable separator on the
  sidebar's right edge with keyboard support and a persisted width. Rationale:
  long team and project names need more room without forcing a global layout
  change, while the default stays compact for the board.
- **2026-11-10 — Navigation hierarchy and spacing:** Grouped project views into
  Plan, Playtest, and Project, removed decorative glyphs from workspace items,
  and adopted a 4–32px spacing scale across the shell, panels, and auth screen.
  The sidebar scrolls independently and keeps the profile footer visible.
  Rationale: the flat eleven-item list was hard to scan, and mixed spacing made
  related screens feel uneven. The logo asset was trimmed and displayed at
  consistent widths on auth and in the sidebar.
