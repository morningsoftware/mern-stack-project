# Checkpoint (Group 9)

## Deployment

Production: <https://checkpoint.morning.codes>

Pushes to `main` deploy automatically through GitHub Actions. See
[`docs/deployment.md`](./docs/deployment.md) for the droplet, secret, and domain
setup.

## Quick Start
### MacOS:
...
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

## OAuth sign-in

Google, GitHub, and Discord sign-in use Passport. OAuth is optional: configure
only the providers you want, and leave the other credentials blank. Password
login remains available.

Add these values to the root `.env`:

```dotenv
CLIENT_ORIGIN=http://localhost:5173
OAUTH_CALLBACK_BASE_URL=http://localhost:4000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

`CLIENT_ORIGIN` is required even when OAuth is disabled. It is the exact browser
origin allowed to send credentialed requests, and the API uses it for CORS,
cookie-authenticated requests, and the post-login redirect. In production, serve
the client and API from the same site; `SameSite=Lax` session cookies are not
sent on cross-site API requests. If they must be cross-site, put them behind a
reverse proxy on one origin.

`OAUTH_CALLBACK_BASE_URL` is the public origin of the API for the OAuth
callback. The callback URLs are derived from it:

```text
http://localhost:4000/api/auth/oauth/google/callback
http://localhost:4000/api/auth/oauth/github/callback
http://localhost:4000/api/auth/oauth/discord/callback
```

Register those exact URLs in the provider consoles:

- **Google:** create a Web application OAuth client, add the Google callback as
  an authorized redirect URI, and use the `profile` and `email` scopes. While
  the consent screen is in testing mode, add the Google accounts that should be
  allowed to sign in as test users.
- **GitHub:** create an OAuth App and set the authorization callback URL to the
  GitHub callback above. The app requests `read:user` and `user:email` so it can
  require a verified email address.
- **Discord:** create an OAuth2 application and add the Discord callback as a
  redirect. The app requests `identify` and `email`.

If a provider is partially configured, the server refuses to start rather than
silently enabling a broken sign-in option. In production, set
`OAUTH_CALLBACK_BASE_URL` to the public HTTPS origin and register the HTTPS
callback URLs with each provider.

OAuth persistence collections and indexes are created by `npm run db:setup`
and re-applied by `ensureIndexes` when the API starts. TTL indexes remove
expired authorization state, sign-in codes, pending registrations, and link
challenges. The users collection has a unique index on
`oauthAccounts.provider` + `oauthAccounts.providerId`, so one provider account
cannot be linked to two users. If you are applying this to an existing database,
remove duplicate `oauthAccounts` entries first; the unique index will fail to
build otherwise.

### How the flow behaves

- New OAuth users complete an onboarding page that collects username, display
  name, and role. No user document is created until that form is submitted.
- Existing OAuth users sign in directly.
- A verified provider email can link to an existing account. If that account
  has a password and has not completed an OAuth link before, the user confirms
  the existing password once. After that, OAuth sign-in is direct.
- Signed-in users can link another provider from Account settings without
  completing the password confirmation. The provider account must not already be
  linked to a different user.
- Provider emails must be verified. The account is rejected if the provider
  does not supply a verified email address.
- The browser handoff uses a short-lived, hashed, single-use code delivered in
  a URL fragment. The JWT is exchanged over POST and never placed in a URL.
  The API then sets the JWT in an httpOnly `mern_session` cookie
  (`SameSite=Lax`, and `Secure` in production) and pairs it with a readable,
  HMAC-signed `mern_csrf` cookie. Browser mutations send the CSRF value in
  `X-CSRF-Token`, and the API rejects browser mutations from an origin other
  than `CLIENT_ORIGIN`. Bearer tokens remain supported for non-browser API
  clients. The browser client no longer stores tokens in `sessionStorage`.
  `POST /api/auth/logout` clears both cookies.

### Account settings

Signed-in users can open **Account** from the workspace sidebar to:

- view linked providers and the email returned by each provider;
- link another configured provider;
- unlink a provider, unless it is the account's last sign-in method and no
  password is set; and
- set a password on an OAuth-created account, or change the current password
  (which requires the existing password).

The screen uses `GET /api/auth/account`, `POST /api/auth/password`, and
`DELETE /api/auth/oauth/:provider`.

Local email verification for password registration is not part of this change.
As a result, a password account whose email was pre-registered by someone else
cannot be reclaimed through OAuth without knowing that password; password
reset/local email verification would be a separate feature. OAuth-created
accounts can add a password from Account settings after signing in.

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
