# Build library API

This feature stores external HTTPS links, not game binaries. Existing feedback
remains valid and does not require a build association.

## Build document

| Field          | Type     | Meaning                                        |
| -------------- | -------- | ---------------------------------------------- |
| `_id`          | ObjectId | Build identifier                               |
| `projectId`    | ObjectId | Owning project                                 |
| `version`      | string   | Required nonempty label, maximum 80 characters |
| `platform`     | enum     | `windows`, `macos`, `linux`, `web`, or `other` |
| `downloadUrl`  | string   | HTTPS URL without embedded username/password   |
| `releaseNotes` | string   | Optional notes, defaults to empty string       |
| `createdOn`    | Date     | Publication time                               |
| `createdBy`    | ObjectId | Authenticated publisher                        |
| `updatedOn`    | Date     | Set after editing                              |

API responses serialize ObjectIds and dates to strings. The server does not
fetch download URLs. Download links open in a new tab with noopener/noreferrer.

## Endpoints

All endpoints require a bearer token.

| Method | Path                        | Success                                        |
| ------ | --------------------------- | ---------------------------------------------- |
| GET    | `/api/builds?projectId=...` | 200 and newest-first array; projectId required |
| POST   | `/api/builds`               | 201 and created build                          |
| GET    | `/api/builds/:id`           | 200 and build                                  |
| PATCH  | `/api/builds/:id`           | 200 and edited build                           |

POST accepts projectId, version, platform, downloadUrl, and optional releaseNotes.
PATCH accepts version, platform, downloadUrl, and releaseNotes. A build cannot be
moved to another project by PATCH. Publishing/editing requires the project's team
creator or an existing team membership. Read access follows the older project's
authenticated resource model; full project visibility permissions remain separate
backend work.

Errors: 400 for invalid/missing fields or an empty edit; 401 for missing/invalid
authentication; 403 for publishing/editing without team membership; 404 for a
missing build/project/team; 409 for duplicate project/version/platform.

## Feedback association

POST `/api/playtest-feedback` accepts optional buildId. The referenced build must
exist and belong to the submitted projectId. PATCH accepts buildId for the
feedback's author, with the same validation. Null/empty removes the association.
Requests omitting buildId preserve existing behavior. No old records are rewritten.

## Database and deployment

API startup adds two indexes to the builds collection: unique
(projectId, version, platform), plus (projectId, createdOn descending).
`database/setup.js` also creates the collection/indexes. No seed or destructive
migration is required. Ensure the app's MongoDB account can create indexes.
Deploy the updated API and frontend together; the project workspace loads builds
alongside tasks, milestones, bugs, and feedback.

## Verification

- `npm test --prefix server`: all API regressions, including builds and feedback.
- `npm test --prefix client`: board filters, task/bug editing, failed save,
  link publication, and build-specific feedback with an isolated API fixture.
- `npm run build --prefix client`: production bundle.
- Browser follow-up: keyboard focus trap/restore, Escape, narrow viewport layout,
  actual external links, and Lighthouse. DOM fixtures do not prove browser layout.
