# MERN Stack Project (Group 9)

## Local Quick Start

1. Install deps

```sh
npm install
(cd server && npm install)
(cd client && npm install)
```

2. Create .env

```sh
cp .env.example .env
# Edit .env with editor of choice
```

3. Start MongoDB

```sh
docker run --rm -d --name mern-mongo -p 27017:27017 mongo:7
```

4. Create database

```sh
npm run db:setup
# Optional: SEED_DEVELOPMENT=true npm run db:seed
```

5. Start server

```sh
# In one terminal
cd server
npm run dev
```

6. Start client

```sh
# In another terminal
cd client
npm run dev
```

The Vite development server forwards `/api` to a local API on port 4000.
Start the server separately using its configured `MONGODB_URI` and
`JWT_SECRET`. Never commit those values. For the frontend build:

```sh
npm run build --prefix client
```

## TypeScript

The application is written in TypeScript. Database scripts and the server run
through `tsx`; the client is bundled by Vite.

Run type checks from each workspace:

```sh
npm run typecheck
npm run typecheck --prefix server
npm run typecheck --prefix client
```

## Studio board and build links

Projects open on a task board. Search and combine filters for assignee,
priority, milestone, and My work. Use each card's status selector to move work
between columns. Select a task title or bug title to open its editable detail
drawer. These features use existing task/bug endpoints.

The Builds view adds HTTPS download links, version/platform labels, and release
notes. It does not upload or host game files. Publish/edit requires team
membership. The API never fetches the supplied download URL. New endpoints:

| Method | Path                        | Description                                       |
| ------ | --------------------------- | ------------------------------------------------- |
| GET    | `/api/builds?projectId=...` | List a project's builds                           |
| POST   | `/api/builds`               | Publish version/platform/downloadUrl/releaseNotes |
| GET    | `/api/builds/:id`           | Retrieve one build                                |
| PATCH  | `/api/builds/:id`           | Edit a build's metadata/link                      |

`projectId + version + platform` is unique. API startup and `database/setup.ts`
add the builds collection indexes without changing existing documents. Feedback
POST/PATCH accepts an optional buildId; the API verifies that the referenced
build belongs to the feedback's project. Omitting it preserves general feedback.

Deploy this frontend together with the updated server: the project workspace
loads `/api/builds`. An older server will not provide that route. No existing
production database or deployment is changed by checking out this branch.

## Automated frontend checks

Use Node 20.19+, Node 22.13+, or Node 24+ for the development test tools.

```sh
npm test --prefix client
```

The DOM integration regression uses jsdom and an isolated API fixture. It checks
session restoration, navigation/focus, overview counts, project status success
and failure, task creation, sign-out, empty states, board filters, detail
drawers, and linked build feedback. It never calls the live API. This does not
substitute for visual browser testing or Lighthouse.

## Frontend review checklist

- Sign in and restore a session; verify failed requests show errors.
- Create/open a team, add a member, create/open a project.
- Check zero-state overview and overview with completed/incomplete records.
- Change project status; verify success updates the selector and header, while
  a failed PATCH keeps the previous status and reports the error.
- Create milestones, assigned tasks, bug reports, and playtest feedback.
- Navigate between project tools; verify record counts update on Overview.
- Check keyboard navigation, the skip link, focus, and a 390px mobile viewport.

Frontend changes are reviewed in a feature branch before merge and deployment.

Verification: `npm test --prefix client`, `npm test --prefix server`, and
`npm run build --prefix client`. The MongoDB test fixture uses loopback TCP with
no Unix socket. Browser visual, focus-trapping, and Lighthouse checks are still
required before release.
