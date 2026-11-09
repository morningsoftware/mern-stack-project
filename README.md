# Checkpoint — MERN Stack Project (Group 9)

## Mobile and local verification

The separate React Native/Expo playtesting companion is in [`mobile/`](mobile/README.md): bug reports, screenshot attachments, build/session feedback and own-report tracking. Desktop keeps planning and project administration. Physical-device walkthrough is a separate remaining acceptance gate.

After `npm ci`, `npm ci --prefix server` and `npm ci --prefix client`, run `npm run demo:local` and open <http://localhost:4002>. This starts a populated, isolated temporary MongoDB/API and the production frontend build; no production database or secrets are used. Accounts: `demo`, `sam`, `tester`; sample password: `checkpoint-demo`.

Install `npm ci --prefix tools/quality` to run `npm run audit:web` (all desktop/mobile web views) or `npm run test:mobile:e2e` (also requires `npm ci --prefix mobile`). See [`docs/local-verification.md`](docs/local-verification.md) for evidence boundaries and reports. These commands are for development, not production deployment.

## Quick Start

### MacOS:

...

### Linux:

...

## Frontend development

```sh
npm ci --prefix client
npm run dev --prefix client
```

The Vite development server forwards `/api` to a local API on port 4000.
Start the API with `npm run dev --prefix server`. It reads `MONGODB_URI` and
`JWT_SECRET` from the environment. Never commit those values. For the frontend build:

```sh
npm run build --prefix client
```

The dashboard foundation adds shared navigation and a project overview with
counts derived from API records. The existing milestone, task, bug, and feedback
forms are available through project navigation. Refreshing returns to Teams;
URL routing is not part of this change. See `DESIGN.md` for the approved style.

### Automated frontend checks

Use Node 20.19+, Node 22.13+, or Node 24+ for the development test tools.

```sh
npm test --prefix client
```

The DOM integration regression uses jsdom and an isolated API fixture. It checks
session restoration, navigation/focus, overview counts, project status success
and failure, task creation, sign-out, and empty states. It never calls the live
API. This does not substitute for visual browser testing or Lighthouse.

### Frontend review checklist

- Sign in and restore a session; verify failed requests show errors.
- Create/open a team, add a member, create/open a project.
- Check zero-state overview and overview with completed/incomplete records.
- Change project status; verify success updates the selector and header, while
  a failed PATCH keeps the previous status and reports the error.
- Create milestones, assigned tasks, bug reports, and playtest feedback.
- Navigate between project tools; verify record counts update on Overview.
- Check keyboard navigation, the skip link, focus, and a 390px mobile viewport.

Frontend changes are reviewed in a feature branch before merge and deployment.

## Studio board and build links

The follow-up frontend opens projects on a task board. Search and combine filters
for assignee, priority, milestone, and My work. Use each card's status selector to
move work between columns. Select a task title or bug title to open its editable
detail drawer. These features use existing task/bug endpoints.

The Builds view adds HTTPS download links, version/platform labels, and release
notes. It does not upload or host game files. Publish/edit requires team
membership. The API never fetches the supplied download URL. New endpoints:

| Method | Path                        | Description                                       |
| ------ | --------------------------- | ------------------------------------------------- |
| GET    | `/api/builds?projectId=...` | List a project's builds                           |
| POST   | `/api/builds`               | Publish version/platform/downloadUrl/releaseNotes |
| GET    | `/api/builds/:id`           | Retrieve one build                                |
| PATCH  | `/api/builds/:id`           | Edit a build's metadata/link                      |

`projectId + version + platform` is unique. API startup and database/setup.ts add
the builds collection indexes without changing existing documents. Feedback
POST/PATCH accepts an optional buildId; the API verifies that the referenced build
belongs to the feedback's project. Omitting it preserves general feedback.

Deploy this frontend together with the updated server: the project workspace
loads `/api/builds`. An older server will not provide that route. No existing
production database or deployment is changed by checking out this branch.

Verification: `npm test --prefix client`, `npm test --prefix server`, and
`npm run build --prefix client`. The MongoDB test fixture uses loopback TCP with
no Unix socket. Browser visual, focus-trapping, and Lighthouse checks are still
required before release.

## Checkpoint milestone planning

Open a project and select Milestones to see its date-ordered roadmap. Filter
open/overdue/completed goals, inspect linked tasks, or open a linked task's drawer.
Select a milestone title or Edit milestone to change its name, description, due
date, or status. Clear the date to make it unscheduled. Add a milestone expands
the creation form, which now includes a description.

Dates are calendar days: due today is not overdue, completed milestones never
show overdue warnings, and stored UTC-midnight dates retain the selected day.
Task progress reflects linked records and does not automatically change milestone
status. Existing GET/POST/PATCH milestone endpoints are reused. No new backend
migration is required beyond the build-library changes documented above.

`npm test --prefix client` covers roadmap filters, record creation/editing, failure
recovery, date clearing, empty progress, day boundaries, and existing workflows.
The local sample preview is temporary; live database persistence and native modal
focus behavior still require deployment/browser verification.

## Structured playtesting

The feedback view filters by build, rating band, and review state. Team members
can review/reopen reports. Log bug from feedback copies its source/build/comment
into a new unsent report; add reproduction steps, expected/actual results, and
environment before submitting. Existing unsent drafts require an explicit choice
before replacement. Bugs can be filtered by build, and their detail drawers edit
these structured fields. Feedback remains linked to any bug reports created from
it. General feedback and old bug reports stay compatible.

See `docs/structured-playtesting.md` for fields, review permissions, compatibility,
and deployment requirements. The server records reviewer identity/time; marking
reviewed does not change the playtester's comment or close a related bug.

Task details now include team-only, persistent discussions with older-comment
pagination and failed-post draft retention. See [task discussions](docs/task-discussions.md)
for endpoints and deployment requirements and [UX review](docs/ux-review.md) for
implemented improvements and remaining design work.

Shareable project/view links, first-milestone guidance, and unsaved-work protection
are documented in [workspace navigation](docs/workspace-navigation.md). Drafts stay
in memory; this is not automatic saving or a separate mobile application.

## Feature release and readiness

The project now includes My work, protected bug screenshots, project activity,
private in-app notifications, and build-specific playtest sessions. Read
[the rubric audit](docs/project-readiness.md) for verified evidence and remaining
assignment requirements. These optional features do not replace email
verification, recovery, the separate mobile app, SwaggerHub, or presentation work.

After installing client/server dependencies, run a fully isolated real API demo:

```sh
npm run build --prefix client
npm run demo --prefix server
```

Open http://127.0.0.1:4002. Sample users are `demo`, `sam`, and `tester`, each with
password `checkpoint-demo`. This is temporary local sample data, not production
credentials. The demo never reads `.env` and never connects to the team's database.
Restarting resets its sample data. The example build URL is intentionally not a
hosted game. Use the real domain for the graded presentation.

Run `node server/scripts/endpoint-evidence.js` to rerun the API integration suite
and regenerate [endpoint evidence](docs/endpoint-test-evidence.json). A missing
successful route response fails that command. No Lighthouse score or browser
visual check is implied by these tests.

While the isolated demo is running, `node client/scripts/demo-smoke.cjs` exercises
the DOM UI against its actual HTTP API/MongoDB without mocked API responses. It
uses only loopback and demo accounts. This is not a rendered-browser/Lighthouse test.
See [screenshots](docs/bug-screenshots.md), [activity/inbox](docs/activity-notifications.md),
and [playtest sessions](docs/playtest-sessions.md) for API and deployment details.

## Repair integration and November 10 check-in

The integrated repair branch brings the later Checkpoint workflows and GitHub feature branch together with production deployment. See [check-in readiness](docs/check-in/readiness.md), the [Gantt and diagrams](docs/check-in/README.md), and [deployment instructions](docs/deployment.md).

Production URL: https://checkpoint.morning.codes. Branch changes require review, merge and a successful deployment before they are live. PM2 uses `server/ecosystem.config.cjs` so TypeScript starts through `tsx`; the root production `.env` remains on the server. Do not run a destructive seed against production.

```sh
npm ci
npm ci --prefix server
npm ci --prefix client
npm run typecheck
npm run typecheck --prefix server
npm run typecheck --prefix client
npm test --prefix client
npm test --prefix server
npm run build --prefix client
node --import tsx server/scripts/endpoint-evidence.js
```

The route inventory now includes multiple routers from the GitHub module and both JavaScript and TypeScript tests. It counts observed 2xx/3xx responses, including redirects; it is not unit/branch coverage. `docs/openapi.json` is a draft route catalogue, not evidence of completed SwaggerHub publication or fully specified schemas.
