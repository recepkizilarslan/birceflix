# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Birceflix, please **do not open a public GitHub issue**. Instead, report it privately:

- Email: **recepkizilarslan@gmail.com**
- Or use GitHub's [Private vulnerability reporting](https://github.com/recepkizilarslan/birceflix/security/advisories/new).

Please include:
- A clear description of the issue and its impact.
- Steps to reproduce (proof of concept if possible).
- Any suggested mitigation.

You will get an acknowledgement within a few days. Birceflix is a small personal project, so there is no formal SLA, but credible reports will be triaged as quickly as possible.

## Scope

In scope:
- Application code in this repository (frontend, backend, shared).
- Database schema and migrations in `backend/src/db/`.
- Container and reverse-proxy configuration (`docker-compose.yml`, `Caddyfile`, Dockerfiles).
- Authentication & session handling (`backend/src/auth/`).

Out of scope:
- Vulnerabilities in upstream dependencies (Fastify, Drizzle, Postgres, Caddy, TMDB, OMDb). Please report those upstream.
- Issues that require a compromised user device or browser extension.
- Rate-limit / denial-of-service findings without a clear bypass of intended limits.
- Misconfigurations of a self-hosted instance (e.g. user deploys without setting `SESSION_SECRET`).

## Secret handling

The repo is designed so that no secret is ever committed. The following are git-ignored:

- `.env`: root, used by `docker compose`.
- `backend/.env`: backend dev environment (Google OAuth, TMDB/OMDb, DB URL, session secret).

Only the `*.example` files (placeholders, no values) live in the repo. The full env reference is in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

### Server-side API keys
- `TMDB_API_KEY` and `OMDB_API_KEY` are read from env on the backend only. They are **never** included in the frontend bundle or sent to the browser.
- If you suspect a key has leaked, rotate it from the provider dashboard immediately:
  - TMDB → https://www.themoviedb.org/settings/api
  - OMDb → https://www.omdbapi.com/apikey.aspx
- Then update `backend/.env` and the corresponding env vars in your `.env`/`docker compose` setup, and restart: `docker compose up -d --force-recreate api`.

### Sessions
- Sessions are server-side rows in the `sessions` table. The cookie carries an opaque id, HMAC-signed with `SESSION_SECRET` (32+ characters, randomly generated: `openssl rand -base64 48`).
- The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Logout deletes the session row immediately, sidestepping any JWT-style revocation problem.
- If `SESSION_SECRET` is leaked, rotate it. All existing sessions become invalid (cookies fail HMAC verification), and every user will be signed out.

### Google OAuth
- The `state` and PKCE `code_verifier` are stored in short-lived cookies and verified on the callback.
- Only emails with `email_verified: true` from Google are accepted.
- Make sure the **Authorized redirect URI** in Google Cloud Console matches `GOOGLE_REDIRECT_URI` exactly. A mismatched or lax whitelist is the most common foot-gun.

### Database
- The app uses a single Postgres role (`birceflix`). On a public-facing deployment, ensure Postgres is **not** reachable from outside the Docker network (the compose file already keeps it on a private network).
- All user-scoped queries filter by `req.userId` from the session. There is no separate RLS; authorization lives in the backend code.

### Dependencies
- Run `npm audit` periodically across all workspaces.
- Dependabot is enabled (`.github/dependabot.yml`) for npm, GitHub Actions, and Docker base images.
- Major version bumps for `fastify`, `drizzle-orm`, `react`, `vite` should be reviewed before merging.

### TLS / reverse proxy
- TLS termination is at Caddy. Make sure ports 80/443 are reachable from the public Internet so Let's Encrypt validation can complete.
- HSTS is enabled in the Caddyfile (`Strict-Transport-Security`). Only enable this once you are sure HTTPS works end-to-end.

## If you suspect compromise

1. Rotate `SESSION_SECRET` → all users are logged out, attacker session cookies become invalid.
2. Rotate TMDB / OMDb keys from their respective dashboards.
3. Rotate the Google OAuth client secret from Google Cloud Console.
4. Rotate `DB_PASSWORD` and update the Postgres role.
5. Restart all containers: `docker compose down && docker compose up -d --build`.
6. Audit the `sessions` and `users` tables for unexpected rows.
