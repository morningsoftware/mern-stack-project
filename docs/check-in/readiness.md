# checkpoint — November 10 instructor check-in

Prepared November 9, 2026. This is an evidence-based check-in package, not a claim of a finished project or a guaranteed grade.

**Later November 9 update:** the separate Expo/React Native companion is now implemented on `feat/mobile-playtesting`. Read `mobile/README.md` and `docs/local-verification.md` for current evidence and remaining native-device acceptance. The original audit below predates that implementation and the new Lighthouse runs; its mobile/Lighthouse rows describe that earlier baseline. Email verification/recovery remain absent. Local test results do not imply deployment or a completed phone demo.

## Current state

Main at the reviewed baseline is `3e02a9f`. The integrated repair branch combines the advanced Checkpoint workflows and Demetri's GitHub integration with the current deployment workflow. It restores production root `.env` loading, runs TypeScript through a stable PM2 ecosystem definition, adds three type-check gates plus frontend tests to deployment, fixes production GitHub return URLs, updates the endpoint audit for TypeScript/multiple routers, and applies the approved checkpoint logo. It remains separate from production until review, merge and deployment.

The core is TypeScript, while the previously authored advanced UI and API modules remain JavaScript/JSX with allowJs. Their runtime behavior is tested; do not claim that every new module has strict static type coverage.

Verification on the integrated branch: 59 API cases, 17 frontend/date cases, 68/68 inventoried API methods/paths observed with 2xx/3xx responses (redirects included), database/API/client type checks and the production build. Endpoint tests use isolated MongoDB; GitHub provider calls are mocked. These are integration tests, not a unit/branch coverage percentage. See docs/endpoint-test-evidence.json. Real browser layout checks, device testing and Lighthouse are distinct.

A browser visit to production currently shows the older “MERN Stack Project” login. It does not show the new logo or establish that this repair branch is deployed. Do not claim local branch functionality is already live.

## Tomorrow's four criteria

| Criterion | What is now prepared | What still controls full marks |
|---|---|---|
| Project completion /4 | Integrated web/API/database workflows, protected writes, test evidence, demo script | Full completion cannot be asserted: separate mobile work is unverified and email verification/password recovery remain absent. If mobile has had no work, the rubric's zero-evidence condition remains a risk. |
| Understanding work remaining /4 | Dated Gantt with historical evidence and proposed future tasks, role owners, dependencies and acceptance criteria | Team must adopt the plan, assign named owners, and replace provisional dates with the actual final deadline. |
| Presentation readiness /4 | Editable presentation with architecture, diagrams, audit, demo plan, lessons, AI disclosure and speaker notes | Every member must practice. Record the actual rehearsal; we have not performed a team rehearsal or verified the complete team roster. |
| Engineering diagrams /4 | Gantt, activity, sequence, use case, class diagram, ERD and full collection dictionary | Team must review the diagrams against mobile/production behavior and update them after remaining auth/mobile changes. Logical relations are not enforced MongoDB foreign keys. |

No honest 16/16 prediction is possible before completing the application and rehearsing as a team.

## Overall project requirements

The following 100-point mapping comes from the previously recorded assignment audit, not a fresh authenticated reading of the instructor's full assignment page. Confirm the official current rubric and final presentation length.

| Requirement | Points | Evidence and remaining work |
|---|---:|---|
| PowerPoint submitted on time | 10 | Deck prepared; each member still must submit it by the actual deadline. |
| Explain technology | 5 | Deck covers MongoDB, Express, React, Node/TypeScript, DigitalOcean/Nginx/PM2/HTTPS and test tooling. Mobile stack remains unverified. |
| AI disclosure | 5 | Included; human review, tests and limitations stated. |
| Activity/sequence | 5 | Source diagrams and editable slides prepared. |
| Use case | 5 | Owner/member/playtester/GitHub interactions mapped. |
| ERD | 5 | All 15 current collections and fields mapped; external GitHub repository key and polymorphic IDs explained. |
| Gantt | 5 | Historical work and proposed remaining work included. Final deadline not supplied. |
| Good/Bad/Ugly lessons | 10 | Included with concrete integration, access and testing lessons. |
| New-account email verification | 5 | Missing; registration currently immediately grants a session. Implement real mail delivery and verified-account gating. |
| Password recovery | 5 | Missing; implement expiring single-use tokens and real delivery, including invalid/expired/reuse tests and session revocation. |
| SwaggerHub demonstration | 5 | Draft source-derived OpenAPI catalogue prepared. Most request/response schemas still need completion and a real SwaggerHub HTTPS execution. |
| At least one test per endpoint | 5 | 68/68 route responses observed in isolated integration tests; preserve evidence and rerun after new auth/mobile endpoints. |
| Web demonstration | 10 | Strong branch test evidence; required live end-to-end rehearsal after review/deployment. |
| Separate mobile demonstration | 10 | User is not sure where mobile work lives. Find the teammate's repo, confirm owner and run on a device/emulator. Responsive web is insufficient. |
| Desktop Lighthouse threshold | 5 | Unmeasured; run against presentation routes, retain reports and fix scores. |
| Mobile Lighthouse threshold | 5 | Unmeasured; audit mobile web separately from the native mobile deliverable. |

Baseline: MERN, AJAX/JSON, GitHub source and HTTPS/domain hosting exist. Verify the running MongoDB database and persistence on production. Health alone does not query the database. Signup sheet, attendance, submission history and final presentation timing remain team responsibilities.

Extra credit is unclaimed. In particular, browser HTTPS does not establish API-to-MongoDB TLS, mocked GitHub tests do not prove live provider configuration, and presentation skill can only be demonstrated by the team.

## Remaining engineering limitations

- Authenticated discovery reads remain visible across teams for playtesting. This is not a private-project ACL product.
- Activity and notifications are best-effort after primary writes, without a durable outbox.
- Team/project deletion needs a consistent archive/cascade policy.
- Screenshot storage is in MongoDB (three images per bug, 2 MiB each); ensure Nginx accepts the upload size and backups cover the data.
- GitHub App credentials/private-key path, callback and webhook configuration require owner-side production setup. This work does not grant new GitHub permissions.
- The check-in deck is complete for the observed state. It is not proof that final mobile/auth work or team rehearsal is complete.
