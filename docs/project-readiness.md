> Historical November 1 audit. For the current November 9 repair-branch assessment, see [check-in/readiness.md](check-in/readiness.md). Old deployment and branch statuses below are historical.

# Checkpoint — requirements and rubric audit

Audit date: 2026-11-01. Scope: the local `feat/checkpoint-release-features` branch,
read-only public deployment checks, GitHub branch/PR metadata, and the assignment
text supplied in this conversation. No production database was modified. Slides,
Webcourses submissions, signup-sheet entries, and other team repositories were
not available for inspection. "Not evidenced" does not mean a teammate has not
created the material elsewhere.

**Assessment: the web application has substantial working functionality, but the
project is not ready for its graded final presentation.** Remaining requirements
matter more than additional optional product features. This is an evidence review,
not an estimated grade.

## What was built and tested, in order

| Feature           | Delivered behavior                                                                                                                         | Gate passed before the next feature      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| My work           | Project-scoped assignments, optional completed tasks, linked milestones, personal unresolved reports, status editing                       | 11 frontend tests + production build     |
| Bug screenshots   | Reporter/team-only upload/list/view/remove, 3 images per bug, 2 MiB each, PNG/JPEG/WebP signatures, private blob previews, MongoDB storage | 42 API tests + 12 frontend tests + build |
| Activity history  | Real server actors, selected before/after changes, project permissions, cursor pagination; no invented backfill                            | 45 API tests + 13 frontend tests + build |
| Notifications     | Private recipient inbox, assignments and feedback, read/unread, no self-alerts, explicit refresh, links to related work                    | 48 API tests + 14 frontend tests + build |
| Playtest sessions | Fixed build, instructions, deadline, team management, session-linked feedback, server rejection for closed/expired sessions                | 52 API tests + 15 frontend tests + build |

The subsequent permission review added regression tests and closed an older
membership escalation/write-access loophole. The final API suite contains 55
passing test cases. The endpoint evidence script observes successful responses
for every declared API route (58 method/path combinations); see
[raw endpoint evidence](endpoint-test-evidence.json). These are API integration
tests against isolated MongoDB, plus DOM integration/date tests. They are not
browser automation, measured Lighthouse results, or a formal unit/branch-coverage
percentage. Confirm whether the GTA expects additional narrowly scoped unit tests.

A further DOM-to-real-HTTP-to-MongoDB smoke check passed across all five features,
including a real screenshot upload/removal and session feedback write. Run
`node client/scripts/demo-smoke.cjs` while the isolated demo is running. It uses
synthetic demo accounts and only loopback; it does not inspect rendered pixels or
native browser dialog behavior.

Reproduce:

```sh
npm test --prefix client
npm run build --prefix client
npm test --prefix server
node server/scripts/endpoint-evidence.ts
```

The last command reruns the API tests and fails if an inventoried route has no
observed successful response. MongoDB test binaries may download on the first run.

## Current deployment versus local work

- `https://mern.morning.codes/api/health` returned HTTP 200 and `{"ok":true}`.
- `http://mern.morning.codes/` returned HTTP 301 to HTTPS.
- The public page still identifies itself as **MERN Stack Project**, with the old
  `index-BiaCvVfU.js` bundle. The latest Checkpoint UI is not deployed there.
- GitHub main is `a9fd80e`; open PR #5 still points to `8ef9fcb`. The later milestone,
  playtesting, discussions, navigation, and current feature commits are local.
- The new demo uses the real Express API and an isolated temporary MongoDB, served
  on loopback. It is suitable for development testing, not the required remote
  presentation. Restarting resets its sample data.
- Earlier terminal evidence established the DigitalOcean droplet and local-on-that-
  droplet MongoDB. Current production database selection, data, PM2 configuration,
  and API-to-database TLS were not freshly inspected. Health does not query MongoDB.

Public evidence checked: [website](https://mern.morning.codes/),
[health](https://mern.morning.codes/api/health),
[PR #5](https://github.com/morningsoftware/mern-stack-project/pull/5),
[branches](https://github.com/morningsoftware/mern-stack-project/branches).

## Baseline project requirements

| Requirement                         | Status and evidence                                                                                        | Remaining action                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB, Express, React, Node       | Present in client/server/package manifests, native MongoDB connection, Express routes, React/Vite frontend | Deploy the tested API and built frontend together                                                                                 |
| Remote database                     | Prior droplet setup evidence; API uses MONGODB_URI and database `mern`                                     | Verify the running deployed process uses `mern`; inspect created records in Compass. Earlier `merndb` held starter users/contacts |
| JSON client/server application data | `client/src/api.js` uses fetch; application endpoints return JSON                                          | Screenshot endpoints intentionally transfer image bytes; core registration/login stay JSON                                        |
| AJAX-enabled web client             | Present through asynchronous fetch and React updates                                                       | Demonstrate key workflows on the remote domain                                                                                    |
| Separate mobile application         | Not found in this branch or the inspected repository refs; no mobile app project/dependencies              | Obtain teammate's mobile work or build/integrate a separate app. Responsive web layout is not evidence of this deliverable        |
| DigitalOcean hosting + domain       | Droplet previously established; domain HTTPS health currently reachable                                    | Deploy current work on the droplet, not localhost or an IP-only presentation                                                      |
| Source/support files in GitHub      | Repository exists; current feature branch commits are local                                                | Publish the branch, review, merge under protections, deploy; include required support artifacts                                   |
| Clean/professional UI               | Consistent approved paper/forest/rust design; accessible native controls and error/draft handling          | Real desktop/mobile visual review, keyboard/native-modal checks, and measured audits                                              |
| Signup sheet                        | User supplied its link, but its current entries were not inspected                                         | Confirm project title, GitHub link, team, and presentation slot                                                                   |

## Rubric: 100 base points

| Criterion                                        | Points | Evidence / current standing                                                                                                  | Required next action                                                                                                                                                               |
| ------------------------------------------------ | -----: | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slide deck submitted on time                     |     10 | No deck or submission evidence in inspected scope                                                                            | Every member submits the unzipped PowerPoint before the presentation                                                                                                               |
| Explain all technology                           |      5 | Code/manifests and feature docs available; no slide evidence                                                                 | Cover MongoDB/native driver, Express, React/Vite, Node, DigitalOcean, Nginx, PM2, HTTPS/Certbot, GitHub, Discord, test tooling, mobile stack, and screenshot storage actually used |
| AI disclosure                                    |      5 | AI assistance occurred; no disclosure slide found                                                                            | Describe actual AI use, human review, tests, limitations, and lessons accurately                                                                                                   |
| Activity or sequence diagram                     |      5 | No presentation diagram artifact found                                                                                       | Create one matching the final implemented flow                                                                                                                                     |
| Use case diagram                                 |      5 | No artifact found                                                                                                            | Include developer/artist/playtester/owner workflows and actual permissions                                                                                                         |
| ERD                                              |      5 | Database schema/index code exists; no presentation ERD found                                                                 | Model users, teams/members, projects, milestones/tasks, builds, bugs/screenshots, sessions/feedback, comments, activity, notifications                                             |
| Gantt chart                                      |      5 | Milestone UI is a due-date roadmap, not a project Gantt chart                                                                | Create an honest development timeline using the team's real dates and work                                                                                                         |
| Good, Bad, Ugly / lessons                        |     10 | Work history and documented limitations available; no slide evidence                                                         | Include successes, setbacks, and practical warnings for future students                                                                                                            |
| New-account email verification                   |      5 | **Missing in inspected code.** Registration immediately issues a token; no verify-token/email route or verified-account gate | Implement backend verification/delivery and frontend verify/resend states; test the full flow                                                                                      |
| Forgotten-password recovery                      |      5 | **Missing.** No request-reset/confirm-reset routes, mail delivery, or frontend flow                                          | Implement expiring single-use reset tokens and frontend screens; test invalid/expired/used tokens                                                                                  |
| SwaggerHub API demonstration                     |      5 | API tests and Bruno results do not establish SwaggerHub compliance; no OpenAPI/SwaggerHub artifact found                     | Publish accurate OpenAPI documentation in SwaggerHub and successfully execute at least one endpoint against the HTTPS domain                                                       |
| At least one test per endpoint                   |      5 | **Strong local evidence:** 55 API integration cases; 58/58 routes observed with successful responses; 15 frontend/date tests | Keep generated evidence, add to GitHub/CI, confirm the instructor accepts this test style, rerun after final auth/mobile API changes                                               |
| Web demonstration of all key features            |     10 | Feature flows pass locally; public deployment remains old                                                                    | Deploy and rehearse on the domain with persistent demo accounts/data                                                                                                               |
| Mobile demonstration of all key features         |     10 | No separate mobile app verified                                                                                              | Integrate/run the app and rehearse on a device/emulator against the remote HTTPS API                                                                                               |
| Desktop Lighthouse performance/accessibility ≥95 |      5 | **Unmeasured.** No score/report artifact                                                                                     | Run against the deployed presentation routes; fix and retain reports                                                                                                               |
| Mobile Lighthouse ≥95                            |      5 | **Unmeasured.** No score/report artifact                                                                                     | Run mobile Lighthouse against deployed web routes; retain reports. This does not replace the separate mobile app                                                                   |

Do not award the project points for missing, local-only, unmeasured, or presentation-
dependent evidence. Extra product features do not substitute for these criteria.

## Additional presentation instructions (outside separate point rows)

Include title page, team members and roles, technology, what the project does and
how it was developed, a class diagram, required diagrams, API demonstration, web
and mobile demonstrations, AI disclosure, lessons, and a questions page. Leave
room for questions. Every member must participate and be present; attendance is
mandatory for the presentations. Keep slides/support material locally available
as instructed (USB copy); do not rely on fetching them immediately before speaking.

The supplied instructions mention both 15 minutes and 12-minute presentations.
Confirm the current timing with the instructor; rehearse a concise version with
space for demonstrations/questions instead of assuming the longer allowance.

## API-role lab check

The provided lab instructions specifically require Bruno, HTTPS, JSON, register
201, successful login 200, and wrong-password login 401, plus showing source over
SSH. Automated tests cover these status behaviors and the user previously reported
those Bruno results. Re-run against the final deployed API and preserve evidence.
Registration currently returns token/user rather than an explicit human-readable
confirmation message; align the final response with that wording in the lab sheet.
Source-display access was previously shown in the user's SSH terminal, not freshly
verified from this agent's shell. SwaggerHub remains a separate final-project task.

## Extra credit: 18 possible points, none presumed earned

| Opportunity                     | Points | Current evidence                                                                                                 |
| ------------------------------- | -----: | ---------------------------------------------------------------------------------------------------------------- |
| Excellent presentation design   |      3 | Not assessable without final slides                                                                              |
| Excellent web UX                |      3 | Coherent design and tested workflows; judge only after real-browser review                                       |
| API-to-database encryption      |      3 | Not verified. Browser HTTPS and bcrypt password hashing do not prove MongoDB transport encryption                |
| Extra integrations              |      3 | New workflow features are not automatically third-party integrations; document what the team actually integrated |
| Exceptional presentation skills |      3 | Requires rehearsed live delivery                                                                                 |
| Instructor discretion           |      3 | Cannot be promised or self-awarded                                                                               |

## Permission/security and deployment findings

Closed during this audit:

- Team management/membership changes now require a team owner. An unrelated user
  cannot join as owner or promote themselves to bypass feature permissions.
- The original creator cannot be removed/demoted through membership endpoints.
- Project, milestone, and task writes require team membership; task assignees must
  belong to the team. The UI limits assignment choices accordingly.
- Bug changes/deletion and screenshots require the reporter or a team member.
  Task deletion cleans up comments; bug deletion cleans up screenshots.

Remaining engineering limits to address or explicitly accept:

- Existing authenticated read APIs intentionally expose project/work discovery
  across teams to support playtesting. There is no private-project/invitation ACL.
- Activity/notification writes are best-effort after the primary write; infrastructure
  failures can leave gaps. There is no durable retry/outbox worker.
- New API list resources such as activity/inbox/comments are paginated, but older
  project lists and the session list are unbounded. Plan pagination for larger use.
- Project/team deletion still needs a consistent cascade/archive/retention design;
  owner-only deletion can leave related documents without their parent.
- Screenshot storage must be backed up/monitored. Set Nginx client_max_body_size
  appropriately (e.g. 3m); the app independently caps each file at 2 MiB.
- Email verification, recovery, abuse controls, dependency/security review, real
  browser/device checks, and production persistence/restart checks remain work.
- No new production service, domain setting, deployment, or paid integration was
  changed during this implementation.

## Recommended order from here

1. Coordinate ownership with the team's API/mobile/database developers; publish
   this branch for review and settle the combined PR strategy before merging.
2. Complete email verification and password recovery across API + web + mobile.
3. Complete the separate mobile app around My work, bug reporting/screenshots,
   task status updates, and feedback review using the shared HTTPS API.
4. Publish SwaggerHub documentation and meet the API-role Bruno requirements.
5. Deploy current frontend/API together; verify `mern` persistence in Compass,
   image uploads through Nginx, role boundaries, refresh, and PM2 restarts.
6. Run real-browser/device checks and desktop/mobile Lighthouse; fix to the required
   thresholds and preserve reports.
7. Build the presentation/support diagrams, add AI disclosure and lessons, rehearse
   both demonstrations and questions, then submit the deck for every member.
