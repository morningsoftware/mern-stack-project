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

## One-time droplet setup

These steps assume an Ubuntu droplet with Node.js, npm, Nginx, and PM2
available, and an app directory such as `/var/www/mern-stack-project`.

```sh
sudo apt-get update
sudo apt-get install -y nginx rsync
sudo npm install -g pm2

sudo mkdir -p /var/www/mern-stack-project/server
sudo mkdir -p /var/www/mern-stack-project/client/dist
sudo chown -R "$USER":"$USER" /var/www/mern-stack-project
```

Create `/var/www/mern-stack-project/.env` on the droplet. The server reads this
file before it reads a local `server/.env`, so keep production values here:

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
cd /var/www/mern-stack-project/server
npm ci --omit=dev
pm2 start src/index.js --name mern-api
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` so the API comes back after a reboot.

The workflow expects Node, npm, and PM2 to be on the deploy user's non-interactive
`PATH`. If they are installed through a shell-only tool such as `nvm`, either
move them somewhere on the default `PATH` (NodeSource packages are the simplest
option) or update the restart step to source the relevant profile.

## GitHub secrets and variables

Add these under **Settings → Secrets and variables → Actions**.

Secrets:

| Name             | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| `DEPLOY_SSH_KEY` | Private key for the deploy user (no passphrase)          |
| `DEPLOY_HOST`    | Droplet IP address or hostname                           |
| `DEPLOY_USER`    | SSH user that owns `DEPLOY_PATH`                         |
| `DEPLOY_PORT`    | Optional. SSH port, defaults to `22`                     |
| `DEPLOY_PATH`    | App directory, for example `/var/www/mern-stack-project` |

Variables (optional; the defaults are shown):

| Name               | Default                          |
| ------------------ | -------------------------------- |
| `PRODUCTION_URL`   | `https://checkpoint.morning.codes` |
| `PM2_APP_NAME`     | `mern-api`                       |

Generate a dedicated deploy key and authorize it on the droplet:

```sh
ssh-keygen -t ed25519 -C "github-actions@checkpoint" -f checkpoint_deploy
ssh-copy-id -i checkpoint_deploy.pub deploy@YOUR_DROPLET_IP
```

Paste the contents of `checkpoint_deploy` (the private key) into
`DEPLOY_SSH_KEY`, then delete the local key files.

If you use systemd instead of PM2, replace the restart step in the workflow with
the equivalent `sudo systemctl restart <service>` command and make sure the
deploy user can run it without an interactive password prompt.

## Switching the domain to checkpoint.morning.codes

DNS already points `checkpoint.morning.codes` at the droplet. The application
does not hardcode the old domain, so the remaining changes are on the droplet:

1. Update the Nginx `server_name` and issue a certificate for the new name.
2. Update the domain values in `/var/www/mern-stack-project/.env`.
3. Restart PM2 with `--update-env`.
4. Update any OAuth provider console callback URLs to the new domain.

### Nginx and TLS

If the existing site is `/etc/nginx/sites-available/mern.morning.codes`, copy it
and change the server name. Keep the old certificate paths for the moment so
`nginx -t` still passes:

```sh
sudo cp /etc/nginx/sites-available/mern.morning.codes \
  /etc/nginx/sites-available/checkpoint.morning.codes
sudo sed -i 's/server_name mern\.morning\.codes;/server_name checkpoint.morning.codes;/' \
  /etc/nginx/sites-available/checkpoint.morning.codes
sudo ln -sf /etc/nginx/sites-available/checkpoint.morning.codes \
  /etc/nginx/sites-enabled/checkpoint.morning.codes
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

Remove the old `mern.morning.codes` site from `sites-enabled` once it is no
longer needed. A redirect from the old domain is only possible if its DNS record
also points at this droplet; currently it points elsewhere.

### Environment and OAuth

Update the production `.env`:

```dotenv
CLIENT_ORIGIN=https://checkpoint.morning.codes
OAUTH_CALLBACK_BASE_URL=https://checkpoint.morning.codes
```

Then restart the process so it picks up the change:

```sh
cd /var/www/mern-stack-project/server
pm2 restart mern-api --update-env
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
