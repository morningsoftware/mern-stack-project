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
- Hash URLs identify the team, project, and selected view. React state hydrates
  from authenticated API records; drawer deep links remain separate scope.
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
| Checkpoint branding                  | User approved the game-development name    |
| Board first, overview second         | Work is more useful than generic metrics   |
| External build links                 | User chose links over file storage         |
| Optional build-specific feedback     | Existing general feedback stays compatible |

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

## Team permissions

The release audit closed membership escalation: owners manage membership and team
settings; members write project planning data and assign work only to teammates.
Bug reporters may still maintain their own reports without team membership. The
web UI limits assignee choices and explains owner-only membership management.
Existing authenticated project discovery/read behavior remains available for
playtesting; these controls do not imply private-project visibility.
