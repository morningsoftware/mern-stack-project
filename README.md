# MERN Stack Project (Group 9)
## Quick Start
### MacOS:
...

### Linux:
...

## TypeScript

The client, server, tests, and database scripts are written in TypeScript.
The server runs directly through `tsx`; the client is built by Vite. There is
no separate server compilation step.

Run the project checks from the repository root:

```sh
(cd server && npm run typecheck && npm test)
(cd client && npm run typecheck && npm run build)
npm run typecheck
```

Database scripts:

```sh
npm run db:setup
SEED_DEVELOPMENT=true npm run db:seed
npm run db:migrate-user
```

`db:migrate-user` reads `MONGODB_ADMIN_URI`, `MONGODB_APP_USER`, and
`MONGODB_APP_PASSWORD`.
