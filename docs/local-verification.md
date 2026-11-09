# Local application and mobile verification

Prepared November 9, 2026 on `feat/mobile-playtesting`. This branch builds on PR #10's integration baseline, which must be reviewed/deployed before advanced mobile features use production. No production writes or deployment are part of this verification.

## Start the web application locally

Use Node 22.19+ (also satisfies the Lighthouse requirement) and run from the repo root:

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
npm run demo:local
```

Open `http://localhost:4002`. Sign in as `demo`, `sam` or `tester` with sample password `checkpoint-demo`. The script builds the production frontend and starts the real Express API against a temporary isolated MongoDB. Data resets on restart. The first run downloads a local MongoDB binary. Stop with Ctrl+C.

For editable frontend development instead, run `npm run dev --prefix server` with a private local `.env` and your intended local MongoDB, then `npm run dev --prefix client`. Vite proxies API calls to port 4000. The isolated demo uses 4002 and serves the production build directly.

## Repeat the web audits

```bash
npm ci --prefix tools/quality
npm run audit:web
```

The runner rebuilds the web bundle, starts/seeds an isolated API/database, and uses Lighthouse 13 with Puppeteer and headless Chrome. It audits sign-in, Teams, Team, and every one of the 11 project routes in `client/src/navigation/routes.js`. It also captures registration, task/bug/milestone details and all four additional GitHub tabs as snapshots. Both desktop and mobile profiles are collected. Reports appear under `artifacts/lighthouse/` as HTML and JSON with `summary.json`.

Stop a manually running demo before invoking the automated runners; both use port 4002. Each runner creates and shuts down its own populated test instance.

Authenticated navigation retains sessionStorage. The runner checks authentication and the requested hash; an unexpected login/error page fails the run. Real populated fixtures are used. GitHub tabs exercise their unlinked state; provider credentials and linked-repository content are not simulated as live evidence. Registration and detail/tab snapshots have no navigation Performance score; do not substitute zero or a navigation score from another page.

For a subset: `CHECKPOINT_AUDIT_PAGES=tasks,bugs CHECKPOINT_AUDIT_MODES=desktop npm run audit:web`. For an output folder, set `CHECKPOINT_AUDIT_OUTPUT` relative to `tools/quality/`. By default the runner's raw navigation script allows local demo credentials only on loopback; remote audits require an explicit dedicated account, project and password. Do not place passwords in committed configuration or paste them into reports.

Navigation scores are one measured run under the stated local environment and simulated throttling. They vary with machine load. These are not production TLS/network measurements, physical-device performance or a native-app Lighthouse score. Rerun on the actual deployed presentation routes for final submission evidence if required by the instructor.

## Mobile application

Follow `mobile/README.md` for Expo Go and local-LAN/remote-HTTPS setup. Native source exports for iOS and Android, type/lint checks and unit tests are distinct from installing an app on a phone.

```bash
npm ci --prefix mobile
npm run typecheck --prefix mobile
npm run lint --prefix mobile
npm test --prefix mobile
npm run export:native --prefix mobile
npm run test:mobile:e2e
```

The end-to-end runner exercises the same React Native screens through their web target at 390×844. It signs into the actual local API, creates feedback/bugs, uploads/removes screenshots, verifies role ownership and status changes, restores/clears sessions, checks a late-closing session, and opens the same saved report on desktop. A deliberately rejected write checks retained drafts; all successful writes use the real local API/MongoDB. Results and screenshots are in `artifacts/mobile-smoke`.

## Remaining gates

- Run Expo Go on a real phone/emulator, especially SecureStore, native photo permissions/upload, keyboard, safe areas and back navigation. Record device/OS and API origin.
- Review/merge through the normal PR process, then verify production API compatibility, persistence and screenshots on HTTPS.
- Email verification/password recovery and complete SwaggerHub documentation remain separate work.
- Adopt the updated Gantt tasks with named owners and the instructor's real final deadline. Do not mark any team rehearsal or native walkthrough complete without doing it.
