# Contributing to Birceflix

Thanks for your interest! Birceflix is a small personal project, but contributions (bug fixes, small features, doc improvements) are welcome.

## Quick links
- Bug reports / feature requests → [Issues](https://github.com/recepkizilarslan/birceflix/issues)
- Security issues → see [SECURITY.md](SECURITY.md) (do **not** file a public issue)

## Development setup

You will need:
- Node.js 20+
- Docker (for running Postgres locally — optional, see below)
- A free [TMDB](https://www.themoviedb.org/settings/api) API key
- A free [OMDb](https://www.omdbapi.com/apikey.aspx) API key
- A Google Cloud OAuth 2.0 Client ID (web app)

### 1. Get API keys

- **TMDB** → https://www.themoviedb.org/settings/api → request a "Developer" key, approved instantly.
- **OMDb** → https://www.omdbapi.com/apikey.aspx → free key via email.

### 2. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project.
2. APIs & Services → **OAuth consent screen** → set up (External, Test users = your email).
3. APIs & Services → **Credentials** → Create OAuth client ID:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:5173` (dev)
     - Your production domain
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (dev — backend port)
     - `https://your-domain.com/api/auth/google/callback` (prod)
4. Copy the **Client ID** and **Client secret** into `backend/.env`.

### 3. Local env files

```bash
cp .env.example .env                  # root — for docker-compose
cp backend/.env.example backend/.env  # backend — for `npm run dev`
```

Fill in:
- `backend/.env` → `DATABASE_URL`, `SESSION_SECRET` (32+ chars, use `openssl rand -base64 48`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TMDB_API_KEY`, `OMDB_API_KEY`.
- Root `.env` → only needed when you `docker compose up`.

Both env files are git-ignored — never commit them.

### 4. Start a local Postgres

The repo ships a dev compose file that brings up Postgres + Adminer:

```bash
npm run db:up          # docker compose -f docker-compose.dev.yml up -d
```

That binds Postgres to `127.0.0.1:5432` (matching `backend/.env.example`) and Adminer to `127.0.0.1:8081` for browsing tables. Data lives in the `dev_db_data` volume between restarts.

If you already have a Postgres instance you'd rather use, skip `npm run db:up` and point `DATABASE_URL` in `backend/.env` at it.

Other useful targets:

| `npm run …` | `make …` | What it does |
|---|---|---|
| `db:up` | `db-up` | Start Postgres + Adminer |
| `db:down` | `db-down` | Stop them (volumes preserved) |
| `db:reset` | `db-reset` | Wipe + recreate (loses data) |
| `db:logs` | `db-logs` | Tail logs |

### 5. Install + migrate + run

```bash
npm install                    # installs all workspaces
npm run -w backend db:migrate  # creates tables
npm run dev                    # starts frontend (5173) + backend (3000)
```

Open http://localhost:5173 and click "Google ile giriş" to sign in.

## Project layout

```
frontend/        # Vite + React + Tailwind
  src/
    lib/         # API client, auth, watched-list helpers, constants
    hooks/       # React hooks
    components/  # presentational components
    pages/       # Discover, Watched, MovieDetailPage
    Layout.tsx   # header + nav + watched state
  nginx.conf
  Dockerfile

backend/         # Fastify + Drizzle + Postgres
  src/
    server.ts          # Fastify bootstrap
    env.ts             # zod-validated env
    auth/
      google.ts        # Arctic OAuth provider
      session.ts       # server-side session table + HMAC cookie
      routes.ts        # /api/auth/google, /callback, /logout, /me
    plugins/
      authGuard.ts     # req.userId + app.requireAuth(req)
    routes/
      discover.ts      # GET /api/discover
      search.ts        # GET /api/search?q=
      movie.ts         # GET /api/movie/:id
      meta.ts          # GET /api/genres, /api/providers
      watched.ts       # GET/POST/DELETE /api/watched
    lib/
      tmdb.ts          # TMDB fetch helper
      omdb.ts          # OMDb fetch helper
    db/
      schema.ts        # Drizzle schema
      client.ts        # pg.Pool + drizzle()
      migrate.ts       # runs raw SQL files from migrations/
      migrations/
        0000_initial.sql

shared/          # API contract types (pure types, no runtime)
docker-compose.yml
Caddyfile
```

## Code style

- TypeScript everywhere, strict mode on.
- React 19 with hooks (no class components).
- Tailwind v4 for styling — keep classes in JSX, avoid CSS files unless needed for tokens.
- Backend uses ESM (`"type": "module"`); imports use `.js` extensions even for `.ts` files (TS+ESM convention).
- Routes validate input with `zod`. Bad input → 400 automatically.
- DB access only through Drizzle. Never `pool.query` directly from a route.
- No comments unless the *why* is non-obvious.
- Prefer editing existing files over adding new ones.

### Before opening a PR

```bash
npm run -w frontend lint
npm run typecheck       # both workspaces
npm run -w frontend build
npm run -w backend build
```

All four should pass.

## Pull request process

1. Fork and create a topic branch (`fix/...`, `feat/...`, `docs/...`).
2. Keep the diff focused — one logical change per PR.
3. Update docs if behavior or setup changes.
4. Don't commit secrets or `.env*` files (gitignored — please don't disable that).
5. Visual changes (icons, themes, logo) should keep the project's identity distinct from streaming services — avoid Netflix's exact red `#E50914` or condensed display wordmarks (Impact / Arial Black). See the [Notice](README.md#notice) in the README for context.
6. Open a PR with a short description of *what* changed and *why*.

## Database migrations

Schema lives in `backend/src/db/schema.ts` (Drizzle).

For now we hand-write migration SQL into `backend/src/db/migrations/NNNN_description.sql`. The custom migrator (`db/migrate.ts`):

- Reads `*.sql` files in lexical order.
- Splits on `--> statement-breakpoint`.
- Runs each migration in a single transaction.
- Records applied filenames in `_migrations`.

To add a migration:

1. Create `backend/src/db/migrations/000N_short_name.sql` with `CREATE`/`ALTER` statements separated by `--> statement-breakpoint`.
2. Update `schema.ts` to match.
3. Run `npm run -w backend db:migrate` locally to verify.

## Architecture notes

- **TMDB → primary source.** Search, filtering, detail, reviews, watch providers — all proxied through `/api/*` so the TMDB key never reaches the browser.
- **OMDb → enrichment, only on detail page** (1000/day limit).
- **Sessions, not JWTs.** The session id lives in an HMAC-signed HTTP-only cookie; the user record is in `sessions`. Revocation is a single DELETE.
- **No RLS.** Authorization is enforced in the backend — every authenticated route calls `app.requireAuth(req)` and scopes queries by `req.userId`.
- **Min. rating filter is TMDB rating.** IMDB rating is shown but not filterable.

## Deploy

See the "Deploy" section in the [README](README.md). CI is configured to type-check and build both packages on every PR; deploy is manual via `docker compose` on your server.
