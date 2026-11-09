# Playtest sessions

Sessions organize a published build, title, testing instructions, and deadline.
Team members create/edit/close/reopen sessions; authenticated playtesters can read
sessions using the existing authenticated-project visibility model. The build and
project are fixed after creation. Closing is reversible; reopening an expired
session requires a future deadline.

| Endpoint                                | Behavior                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| GET /api/playtest-sessions?projectId=ID | List sessions for a project                                           |
| POST /api/playtest-sessions             | Team-only creation: projectId, buildId, title, instructions, deadline |
| GET /api/playtest-sessions/:id          | Fetch a session                                                       |
| PATCH /api/playtest-sessions/:id        | Team-only title/instructions/deadline/status updates                  |

Titles are 1–120 characters; instructions 1–4,000. New deadlines must be future
valid dates. The browser uses the viewer's local timezone and sends an ISO UTC
instant. Deadline passed is derived, not an automatically written status. The UI
updates the clock every 30 seconds while viewing sessions; the API checks at the
feedback request even if the browser clock/view is stale.

POST /api/playtest-feedback now accepts optional sessionId. The supplied buildId
and projectId must match the session, and it must be open before its deadline.
Missing/mismatched sessions fail before feedback is written. Submitted session
and build associations cannot be changed via PATCH. Authors may still correct
comments/ratings after closing; existing general/build feedback stays compatible.

Use Submit session feedback to preselect and lock the build in the feedback form.
Unlink session submits outside the session while retaining the selected build and
comment draft. Session feedback totals use actual loaded feedback records.

Collections/indexes are initialized at startup. Deploy API and frontend together.
There is no scheduling daemon, invitation delivery, or automatic participant
assignment. API tests cover management authorization, reference validation,
creation/read/edit, closed/expired submission, immutable associations, and legacy
feedback. Frontend checks cover session creation/editing, linked feedback, and
failed/successful closing.
