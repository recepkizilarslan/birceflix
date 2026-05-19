# Self-hosting Birceflix

This page covers running Birceflix on your own server with a real domain and a real TLS cert. If you just want to try it on your laptop, [QUICKSTART.md](QUICKSTART.md) is the faster path. If you want to set up the CI/CD pipeline that auto-builds and pushes images, see [DEPLOYMENT.md](DEPLOYMENT.md).

## What you get

A single `docker compose up -d --build` brings up the full stack:

```
[Internet] -> [Caddy :80/:443]
                  |
                  +-- /api/*  -> [Fastify api :3000]
                  |                    |
                  |                    +-- [Postgres :5432]
                  |
                  +-- /        -> [nginx frontend :80]
                                       |
                                       +-- Vite-built static dist
```

Caddy terminates TLS, reverse-proxies `/api/*` to the API container and everything else to the frontend container. Postgres lives on a private Docker network and isn't exposed to the host. A one-shot `migrate` container runs pending SQL migrations before the API boots.

## Prerequisites

| Need | Why |
|---|---|
| A Linux server with Docker and Docker Compose v2 | Runs the stack |
| Ports 80 and 443 reachable from the public internet | Caddy + Let's Encrypt cert provisioning |
| A domain pointing at the server | Let's Encrypt validation, OAuth redirect URI |
| `git`, `bash`, `openssl` on the server | Clone + secret generation |

The smallest Hetzner Cloud or DigitalOcean droplet (1 vCPU / 2 GB) is enough for personal use.

You also need the same three external accounts as the dev flow:

- [TMDB](https://www.themoviedb.org/settings/api) developer key.
- [OMDb](https://www.omdbapi.com/apikey.aspx) free key.
- [Google Cloud Console](https://console.cloud.google.com/) OAuth 2.0 Web client.

Full credentials walkthrough: [CONFIGURATION.md](CONFIGURATION.md).

## Steps

### 1. DNS

Point an A record (or AAAA for IPv6) for your domain at the server's public IP. Wait until `dig +short your-domain.com` returns the right address before continuing, otherwise Let's Encrypt's HTTP-01 challenge will fail.

### 2. Clone the repo

```bash
ssh you@your-server
git clone https://github.com/recepkizilarslan/birceflix.git
cd birceflix
```

### 3. Configure the environment

```bash
cp .env.example .env
$EDITOR .env
```

Fill in at minimum:

```env
DOMAIN=birceflix.example.com
DB_PASSWORD=<a strong random string>
SESSION_SECRET=<openssl rand -base64 48>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=https://birceflix.example.com/api/auth/google/callback
TMDB_API_KEY=<from TMDB>
OMDB_API_KEY=<from OMDb>
FRONTEND_ORIGIN=https://birceflix.example.com
```

Every variable is documented in [CONFIGURATION.md](CONFIGURATION.md). `GOOGLE_REDIRECT_URI` and `FRONTEND_ORIGIN` must use your real HTTPS domain, not `localhost`.

### 4. Set up Google OAuth for the production domain

In Google Cloud Console > APIs & Services > Credentials > your OAuth 2.0 Client:

- **Authorised JavaScript origins**: `https://birceflix.example.com`
- **Authorised redirect URIs**: `https://birceflix.example.com/api/auth/google/callback`

The redirect URI is matched byte-for-byte by Google. A trailing slash, `http://` vs `https://`, or a different subdomain all count as a mismatch.

### 5. Bring up the stack

```bash
docker compose up -d --build
docker compose logs -f api
```

Watch the logs. You should see Caddy provisioning the cert, the migrate container applying migrations, then the API and frontend reporting ready.

First boot takes a minute or two because Caddy needs to negotiate a cert with Let's Encrypt. Subsequent restarts are seconds.

### 6. Smoke test

- <https://your-domain.com> loads the landing page.
- Sign in with Google works and redirects back.
- The Discover page populates with movies (proves TMDB is reachable).
- Clicking a movie shows the detail page with an OMDb-sourced IMDB rating (proves OMDb is reachable).

If anything is off, jump to [Troubleshooting](#troubleshooting).

## Upgrading

```bash
cd birceflix
git pull
docker compose up -d --build
docker compose logs -f api
```

The `migrate` service runs once per `up`, so schema changes apply automatically before the API starts.

## Backups

Everything stateful is in one place: the `birceflix_db_data` Docker volume holding Postgres data. To back up:

```bash
docker run --rm \
  -v birceflix_db_data:/var/lib/postgresql/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/birceflix-db-$(date +%F).tgz -C /var/lib/postgresql/data .
```

Or use `pg_dump` directly against the running container:

```bash
docker compose exec -T db pg_dump -U birceflix birceflix \
  | gzip > birceflix-$(date +%F).sql.gz
```

Restore with `gunzip -c …sql.gz | docker compose exec -T db psql -U birceflix birceflix`.

Set up a cron or systemd timer to run one of these daily and ship the result off-box.

## Troubleshooting

**Caddy can't get a cert.** Confirm DNS resolves to the server: `dig +short your-domain.com`. Confirm ports 80/443 are open: `curl -sI http://your-domain.com`. Check `docker compose logs caddy` for the specific ACME error. The most common cause is the A record pointing at the wrong IP or a firewall blocking port 80.

**`redirect_uri_mismatch` after Google sign-in.** `GOOGLE_REDIRECT_URI` in `.env` and the URI you registered in Google Cloud Console aren't byte-identical. Copy from one to the other to be sure.

**API logs say "FATAL: password authentication failed".** `DB_PASSWORD` was changed after the volume was created, so Postgres has the old password baked in. Either rotate the role's password inside the container (`docker compose exec db psql -U postgres -c "ALTER USER birceflix PASSWORD '<new>';"`) or wipe the volume (`docker compose down -v`, then `up -d --build`, which loses all data).

**Sign-in works but `/api/auth/me` returns 401.** `SESSION_SECRET` changed between requests, invalidating cookies. Pick a value and stick with it; rotating it is a deliberate "log everyone out" action.

**Discover is empty.** Either `TMDB_API_KEY` is wrong or TMDB rate-limited you. Check `docker compose logs api` for upstream HTTP errors.

**HSTS is biting you on a domain you no longer control.** HSTS in the Caddyfile is set to 2 years. If you redeploy on a new domain and reuse a browser that previously had the old domain, the browser will refuse HTTP. Use a different browser profile, or wait out the HSTS lifetime, or set up a redirect.

**"image not found" or "manifest unknown" pulling from GHCR.** That's only relevant if you're using the CI/CD path that pulls pre-built images. See [DEPLOYMENT.md](DEPLOYMENT.md) for the deploy workflow's auth model. The `docker compose up -d --build` path builds locally and doesn't touch GHCR.

For anything not listed here, check `docker compose logs` for the suspect service. Most issues surface there.

## Hardening

The repo ships sensible defaults (HSTS, CSP, strict cookie attributes, server-side sessions, per-IP rate limiting on auth endpoints). Run [SECURITY.md](../SECURITY.md) once after install to confirm you've rotated default values and set up backups.
