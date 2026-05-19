# Configuration

Every environment variable, where it's read, what it controls, and how to generate it.

## Files

- `backend/.env`: read directly by `npm run dev:backend`. Only matters in the HMR dev flow.
- `.env` at the repo root: read by `docker compose` and propagated into the api / migrate / caddy containers via the compose files. This is the one you fill in for self-hosting.

Both files are git-ignored. Only the `*.example` placeholders are committed.

If you change a value while containers are running, `docker compose up -d --force-recreate api` rolls the API onto the new config.

## Variables

### Required everywhere

| Variable | Example | What it does |
|---|---|---|
| `SESSION_SECRET` | `b64-encoded 48-byte string` | HMAC key for session cookies. Rotating it logs everyone out. |
| `DATABASE_URL` (dev) / `DB_PASSWORD` (prod) | `postgres://birceflix:pw@host:5432/birceflix` | Postgres connection. In prod, compose builds the URL from `DB_PASSWORD`. |
| `GOOGLE_CLIENT_ID` | `…apps.googleusercontent.com` | Google OAuth client. |
| `GOOGLE_CLIENT_SECRET` | (opaque) | Google OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | `https://birceflix.example.com/api/auth/google/callback` | OAuth callback URL. Must match Google Cloud Console byte-for-byte. |
| `TMDB_API_KEY` | (opaque) | Movie metadata, posters, providers. |
| `OMDB_API_KEY` | (opaque) | IMDB ratings, awards. |
| `FRONTEND_ORIGIN` | `https://birceflix.example.com` (prod), `http://localhost:5173` (dev) | CORS allow-origin and post-OAuth redirect target. |

### Server-only

| Variable | Default | What it does |
|---|---|---|
| `NODE_ENV` | `development` / `production` | Standard Node env switch. Toggles cookie `Secure` flag, etc. |
| `PORT` | `3000` | Fastify listen port. |
| `HOST` | `0.0.0.0` | Fastify listen host. |
| `SESSION_COOKIE_NAME` | `birceflix_session` | Cookie name. Change it if you run multiple instances on the same domain. |
| `SESSION_TTL_DAYS` | `30` | Session lifetime. |
| `DEFAULT_WATCH_REGION` | `TR` | ISO-3166 country code used as the default watch-provider region when the user hasn't picked one. |

### Self-hosting only

| Variable | Example | What it does |
|---|---|---|
| `DOMAIN` | `birceflix.example.com` | Hostname Caddy serves. `localhost` for the prod-shaped local stack. |
| `DB_PASSWORD` | (strong random) | Used by the compose stack to build `DATABASE_URL` and to provision the Postgres role. |

### Optional integrations

| Variable | Example | What it does |
|---|---|---|
| `TRAKT_CLIENT_ID` | (opaque) | Trakt OAuth client. Leave blank to disable Trakt sync entirely. |
| `TRAKT_CLIENT_SECRET` | (opaque) | Trakt OAuth client secret. |
| `TRAKT_REDIRECT_URI` | `https://birceflix.example.com/api/integrations/trakt/callback` | Trakt OAuth callback. Matches the one registered at trakt.tv. |

## Generating secrets

```bash
# SESSION_SECRET (48 random bytes, base64-encoded)
openssl rand -base64 48

# DB_PASSWORD (32 url-safe chars)
openssl rand -base64 32 | tr '+/' '-_' | head -c 32

# Anything else where you want "long, random, no special chars"
openssl rand -hex 32
```

Keep these in your password manager or a secrets vault. Don't paste them into chat or commit them to git.

## Google OAuth

### Create the client

1. [Google Cloud Console](https://console.cloud.google.com/) > new project (any name).
2. APIs & Services > **OAuth consent screen**. Pick **External**. Fill in app name, support email, developer email. Add yourself under **Test users** while the app is in "Testing" mode.
3. APIs & Services > **Credentials** > **Create Credentials** > **OAuth client ID**.
4. Application type: **Web application**.

### Authorised origins and redirects

For local dev:

- Authorised JavaScript origins: `http://localhost:5173`
- Authorised redirect URIs: `http://localhost:3000/api/auth/google/callback`

For self-hosting:

- Authorised JavaScript origins: `https://your-domain.com`
- Authorised redirect URIs: `https://your-domain.com/api/auth/google/callback`

You can have both sets registered on the same client at the same time. Google matches exactly, so a trailing slash, `http` vs `https`, or a different subdomain all count as a mismatch and produce `redirect_uri_mismatch` on callback.

### Why we ask for `email_verified`

Birceflix only accepts identities with `email_verified: true` from Google. The `state` and PKCE `code_verifier` are stored in short-lived cookies and verified on the callback, so a swapped redirect doesn't help an attacker.

## TMDB key

1. [TMDB API settings](https://www.themoviedb.org/settings/api).
2. Request a "Developer" API key. The form auto-approves common cases.
3. Copy the **v3 API key**. (The v4 read access token is unused.)

A new key sometimes takes a few minutes before requests start succeeding. Wait it out before assuming the value is wrong.

## OMDb key

1. [OMDb API key page](https://www.omdbapi.com/apikey.aspx).
2. Pick the free tier (1000 requests / day).
3. The key arrives by email after you click the activation link.

Birceflix only hits OMDb on the movie detail page, so 1000/day is plenty for personal use.

## Trakt (optional)

Skip this if you don't use Trakt. Leave the three `TRAKT_*` vars blank and the app silently disables the integration.

1. [Trakt API applications](https://trakt.tv/oauth/applications/new) > **New application**.
2. Set the redirect URI to whatever you'll put in `TRAKT_REDIRECT_URI`.
3. Copy the client id and secret.

## Domain and TLS

Caddy provisions Let's Encrypt certs automatically when `DOMAIN` is a real public hostname and ports 80/443 are reachable. On `localhost` (the prod-shaped local stack), Caddy issues a self-signed cert that browsers will warn about. That's expected.

HSTS is on in the Caddyfile with `max-age=63072000` (2 years) plus `preload`. If you ever move off the domain, browsers will refuse HTTP for that domain for up to 2 years.

## Production secrets storage

For the GitHub Actions deploy workflow, the same values live in repo Secrets (`Settings > Secrets and variables > Actions`):

- `APP_ENV`: the full contents of `.env` as one secret. Newline-separated `KEY=value` lines.
- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY`, `DEPLOY_DIR`: how the deploy job reaches the server.

See [DEPLOYMENT.md](DEPLOYMENT.md) for how the deploy job renders `.env` on the server from `APP_ENV` before bringing the stack up.
