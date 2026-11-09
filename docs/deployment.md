# Deployment

Production runs on a DigitalOcean droplet at
<https://checkpoint.morning.codes>. Every push to `main` runs
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), which tests the
API, builds the client, copies both to the droplet, and restarts the API.

The Express server serves the API and the built client from the same process
(`server/src/app.js` points at `client/dist`), so there is only one service to
deploy.

## How a deploy works

1. Install the server and client dependencies.
2. Run the API test suite with `npm test`.
3. Build the client with `npm run build`.
4. `rsync` the `server/` tree and `client/dist/` to `DEPLOY_PATH` on the droplet.
5. Run `npm ci --omit=dev` on the droplet and restart the PM2 process.
6. Call `https://checkpoint.morning.codes/api/health` and fail the workflow if it
   does not return successfully.

The droplet's `.env` is never uploaded or overwritten; it stays on the server.

## Current droplet layout

| Item          | Value                                      |
| ------------- | ------------------------------------------ |
| SSH user      | `deploy`                                   |
| App directory | `/srv/checkpoint`                          |
| PM2 process   | `mern-api`                                 |
| PM2 service   | `pm2-deploy.service`                       |
| Nginx config  | `/etc/nginx/sites-enabled/default`         |
| Domain        | `https://checkpoint.morning.codes`         |

The app previously ran as `demetri` from `/home/demetri/mern-app`. That PM2
process is stopped, but the files are still there for rollback. Do not start it
while `deploy`'s `mern-api` process is using port 4000.

To roll back:

```sh
sudo -iu deploy bash -lc 'pm2 stop mern-api && pm2 save'
sudo -iu demetri bash -lc 'cd /home/demetri/mern-app/server && pm2 start src/index.js --name mern-api && pm2 save'
```

## One-time droplet setup

These steps assume an Ubuntu droplet with Node.js, npm, Nginx, and PM2
available, and an app directory at `/srv/checkpoint`.

```sh
sudo apt-get update
sudo apt-get install -y nginx rsync
sudo npm install -g pm2

sudo mkdir -p /srv/checkpoint/server
sudo mkdir -p /srv/checkpoint/client/dist
sudo chown -R deploy:deploy /srv/checkpoint
```

Create `/srv/checkpoint/.env` on the droplet. The server reads this file before
it reads a local `server/.env`, so keep production values here:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
JWT_SECRET=replace-with-a-long-random-string
PORT=4000

CLIENT_ORIGIN=https://checkpoint.morning.codes
OAUTH_CALLBACK_BASE_URL=https://checkpoint.morning.codes

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

Start the app once manually, then save the PM2 process list:

```sh
sudo -iu deploy bash -lc '
  cd /srv/checkpoint/server
  npm ci --omit=dev
  pm2 start src/index.js --name mern-api
  pm2 save
'
```

Enable PM2 on boot. Stop the manually started daemon first so systemd can create
the PID file:

```sh
sudo -iu deploy pm2 save
sudo -iu deploy pm2 kill
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u deploy --hp /home/deploy
sudo systemctl enable --now pm2-deploy
sudo -iu deploy pm2 save
```

The workflow expects Node, npm, and PM2 to be on the deploy user's non-interactive
`PATH`. On this droplet they are system-wide at `/usr/bin/node`, `/usr/bin/npm`,
and `/usr/bin/pm2`, so no profile changes are needed.

## GitHub environment configuration

Create an environment named `production` under **Settings → Environments**. The
deploy job declares `environment: production`, so environment-scoped values are
available only to that job. You can also add required reviewers or restrict the
environment to the `main` branch.

Add the SSH key as an **environment secret**:

| Name             | Value                             |
| ---------------- | --------------------------------- |
| `DEPLOY_SSH_KEY` | Private key for the `deploy` user |

Add the non-sensitive values as **environment variables**:

| Name             | Value                          |
| ---------------- | ------------------------------ |
| `DEPLOY_HOST`    | `checkpoint.morning.codes`     |
| `DEPLOY_USER`    | `deploy`                       |
| `DEPLOY_PATH`    | `/srv/checkpoint`              |
| `DEPLOY_PORT`    | Optional. Defaults to `22`     |
| `PRODUCTION_URL` | `https://checkpoint.morning.codes` |
| `PM2_APP_NAME`   | `mern-api`                     |

Repository-level variables and secrets also work. Use environment-level values
when you want deployment credentials scoped to `production`; environment values
override repository values with the same name.

The `deploy` user already has an `authorized_keys` file. For a cleaner setup,
use a dedicated key instead of a personal one:

```sh
ssh-keygen -t ed25519 -C "github-actions@checkpoint" -f checkpoint_deploy
```

Append `checkpoint_deploy.pub` to `/home/deploy/.ssh/authorized_keys`, then paste
the contents of `checkpoint_deploy` (the private key) into `DEPLOY_SSH_KEY`.
Delete the local key files after the secret is saved.

For the current droplet, a dedicated key was generated at
`~/.ssh/checkpoint_deploy` on the developer machine. Its public half is the only
key in `/home/deploy/.ssh/authorized_keys`. Put the private key in
`DEPLOY_SSH_KEY`, then delete the local file.

If you use systemd instead of PM2, replace the restart step in the workflow with
the equivalent `sudo systemctl restart <service>` command and make sure the
deploy user can run it without an interactive password prompt.

## Domain and TLS

`checkpoint.morning.codes` is already configured on the droplet: Nginx uses the
new `server_name`, Certbot has a valid certificate for the new name, and the
application does not hardcode the old domain. This section documents how it was
done in case the configuration needs to be repeated.

### Nginx and TLS

The active config on this droplet is `/etc/nginx/sites-enabled/default`. It is a
regular file, not a symlink. Change the `server_name` lines and the HTTP redirect
condition, but leave the existing certificate paths in place until Certbot issues
the new certificate:

```sh
sudo cp /etc/nginx/sites-enabled/default \
  /etc/nginx/sites-enabled/default.bak.$(date +%F-%H%M)

sudo sed -i \
  -e 's/server_name mern\.morning\.codes;/server_name checkpoint.morning.codes;/g' \
  -e 's/if (\$host = mern\.morning\.codes)/if (\$host = checkpoint.morning.codes)/g' \
  /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d checkpoint.morning.codes
```

Certbot installs the new certificate and updates the Nginx configuration. Reload
and verify:

```sh
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://checkpoint.morning.codes/api/health
```

A complete site configuration looks like this once the certificate exists:

```nginx
server {
    listen 80;
    server_name checkpoint.morning.codes;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name checkpoint.morning.codes;

    ssl_certificate /etc/letsencrypt/live/checkpoint.morning.codes/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/checkpoint.morning.codes/privkey.pem;

    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The old `mern.morning.codes` name is no longer present in the active Nginx
configuration. A redirect from the old domain is only possible if its DNS record
also points at this droplet; currently it points elsewhere.

### Environment and OAuth

Update the production `.env`:

```dotenv
CLIENT_ORIGIN=https://checkpoint.morning.codes
OAUTH_CALLBACK_BASE_URL=https://checkpoint.morning.codes
```

Then restart the process so it picks up the change:

```sh
sudo -iu deploy bash -lc 'cd /srv/checkpoint/server && pm2 restart mern-api --update-env'
```

If OAuth providers are enabled, update their authorized redirect URIs from the
`mern.morning.codes` host to `checkpoint.morning.codes` in the Google, GitHub,
and Discord developer consoles. The values must match `CLIENT_ORIGIN` and
`OAUTH_CALLBACK_BASE_URL` exactly.

## Verifying a deploy

The workflow's final step checks `/api/health`. You can also verify manually:

```sh
curl -fsS https://checkpoint.morning.codes/api/health
# {"ok":true}
```
