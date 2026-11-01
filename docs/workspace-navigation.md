# Workspace links and draft protection

Project URLs now identify the team, project, and selected view:

`https://mern.morning.codes/#/teams/TEAM_ID/projects/PROJECT_ID/tasks`

Project views include tasks, my-work, overview, milestones, bugs, builds, feedback,
sessions, activity, and notifications.
Team pages use `#/teams/TEAM_ID`; the team list uses `#/teams`. Opening a project
without a view defaults to tasks. Copy project link copies the current view's URL;
if clipboard access is unavailable, the UI offers browser-address copying instead.
No tokens, passwords, or draft contents are added to a URL. Links still require
sign-in and use the existing authenticated APIs. A link does not grant access.

Hash-based links work with the existing deployment and need no new server rewrite
or routing dependency. They identify views, not individual task/bug drawers.
Opening/reloading a link fetches team and project records and verifies that the
project belongs to that team. Invalid views, missing records, and failed requests
produce a recoverable error with Retry link and Back to teams.

## Navigation and drafts

Switching tabs inside a project preserves its mounted creation forms and filters.
Browser Back/Forward restores the view as well. When a move would leave the current
workspace, a shared guard checks creation forms, build edits, drawer edits, and
unsent comments. Cancel retains the current workspace and its drafts. For browser
history moves within this app, cancelled moves return to the original entry.

Close, Cancel, and Escape in edited task/bug/milestone drawers ask before discarding.
Build cancellation/replacement also asks if its fields changed. Saving a task with
an unsent comment asks before discarding that comment. Failed writes keep drafts.
Active writes prevent leaving the workspace until the request finishes.

Refresh, tab close, and cross-site navigation use the browser's beforeunload warning;
browsers control whether and how that prompt appears. Drafts are held in memory,
not persisted locally. Confirming discard or reloading after accepting the browser
warning loses them. Creation-task protection is conservative after any form change,
even if every field is subsequently changed back. This avoids silent data loss.

## First milestone

An empty task board explains that tasks require a milestone and offers Create first
milestone. New task follows the same path when no milestone exists. Both open the
milestone form and focus its name. The new milestone appears in the task selector
after a successful create/refresh. No placeholder milestone is inserted silently.

## Verification

DOM integration tests cover direct-link restoration, link copying, Back/Forward,
invalid/mismatched links, the skip link, first-milestone focus, drawer Close/Escape,
unsent comments, sign-out cancellation, beforeunload registration/cleanup, and a
cancelled browser Back move. Real-browser focus, native confirmation/history
behavior, device layouts, and Lighthouse checks remain pending.
