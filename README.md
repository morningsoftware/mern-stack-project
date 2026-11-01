# MERN Stack Project (Group 9)

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
Start the existing server separately using its configured `MONGODB_URI` and
`JWT_SECRET`. Never commit those values. For the frontend build:

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
