# Structured playtesting

## Workflow

1. Playtest a published build and submit a rating/comment, optionally selecting its
   build. General feedback remains supported.
2. Filter feedback by build, rating band, and review state. Legacy records without
   reviewStatus display as awaiting review.
3. Team members can mark a report reviewed or reopen it. Reviewing does not edit
   the playtester's content or imply the issue is fixed.
4. Log a bug from feedback. This starts an unsent report with the source feedback,
   build, and original comment. The user must add reproduction details and submit.
5. Review the linked bug from the feedback report or filter bugs by their build.

Starting a bug never silently replaces an unsent draft. The user can keep the
current draft or explicitly replace it. Logging a bug does not automatically mark
feedback reviewed; these are independent decisions.

## Bug fields

Existing POST/PATCH `/api/bug-reports` now accept optional:

| Field             | Type             | Meaning                                           |
| ----------------- | ---------------- | ------------------------------------------------- |
| buildId           | ObjectId or null | Build from the same project; null/empty clears it |
| reproductionSteps | string           | Steps another developer can follow                |
| expectedResult    | string           | Expected game behavior                            |
| actualResult      | string           | Observed behavior                                 |
| environment       | string           | Device/OS/input/browser context                   |

POST additionally accepts sourceFeedbackId. The referenced report must exist and
belong to the same project. Its origin is retained when editing a bug; PATCH does
not reassign the origin. Existing title, description, severity, and status remain
unchanged. Optional strings default to empty on new records and can be cleared.
Old records need no migration.

GET `/api/bug-reports` accepts optional buildId alongside existing projectId/status
filters. Invalid IDs are rejected. Missing/cross-project references return 404/400
before inserting or updating any document.

## Feedback review

New feedback is created with reviewStatus `new`, regardless of client input.
Existing PATCH `/api/playtest-feedback/:id` accepts `reviewStatus: new|reviewed`.
The project's team creator or member must perform this transition. The API records
reviewedBy and reviewedOn for `reviewed`, and clears them when reopening. Client
supplied reviewer metadata is not trusted.

Content changes (rating, comments, buildId) still require the feedback's author.
A team member may review someone else's report but cannot rewrite their comment.
A nonmember author may edit their own content but cannot mark it reviewed.
Combined unauthorized requests fail before writing any fields. DELETE remains
restricted to the author under the existing API.

Build references and team membership checks are shared with the build-library
routes, preserving the prior build-publishing permission model. The rest of the
older project/task/bug visibility/authorization model is not changed here.

## Deployment and verification

Deploy the expanded API and frontend together for server-enforced review controls
and structured-field persistence. No new collections, dependencies, migrations,
or seed operations are required for this feature. The new UI's role display is
only a convenience; server-side checks enforce review permissions.

Tests cover field round trips, clearing fields, cross-project references, atomic
permission failures, reviewer metadata, compatibility with general reports,
feedback filters, review failure/success, feedback-to-bug creation, editing, and
protection of unsent drafts. Local preview data is temporary and does not prove
production database behavior. Real-browser visual/focus and Lighthouse checks
remain release requirements.
