# Task discussions

Task details include a team discussion with plain text comments, author names,
and timestamps. Comments persist independently of task edits. Failed posts keep
the draft; successful posts clear it and announce confirmation. Closing a drawer
discards an unsent comment. No notification, live synchronization, edit, or delete
behavior is included in this first version; reopen the drawer to fetch updates.

## API

Both endpoints require authentication and current membership in the task's team
(or ownership of that team). These checks apply to reading and posting, regardless
of older task endpoint visibility rules.

| Endpoint                         | Request                                             | Response                            |
| -------------------------------- | --------------------------------------------------- | ----------------------------------- |
| GET /api/tasks/:taskId/comments  | Optional before ObjectId cursor                     | 200: comments, hasMore, nextBefore  |
| POST /api/tasks/:taskId/comments | JSON body string, 1–4,000 characters after trimming | 201: stored comment with authorName |

GET returns the latest 30 records in ascending ObjectId order. The before cursor
loads the previous page; the UI prepends earlier comments. Author names reflect
the current user record and do not expose emails or password fields. The server
assigns authorId, projectId, taskId, createdOn, and _id. Submitted metadata cannot
impersonate another user. Comment text renders as text, without HTML or Markdown.

New MongoDB collection: taskComments. Startup creates the taskId/_id index in
ensureIndexes; no seed or destructive migration is required. Existing tasks and
documents are unchanged. Deploy API and frontend together. The temporary preview
API is sample data only and does not establish real production permissions.

Tests cover authenticated/team-only access, malformed bodies/IDs/cursors,
metadata spoofing, persistent readback, cursor boundaries, task isolation,
failed-post draft retention, retry, and reloading a discussion.
