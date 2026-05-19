# Development

This page is the deep walkthrough. If you just want to run the app, [QUICKSTART.md](QUICKSTART.md) is the five-minute version.

## Two dev flows

Pick one based on what you're optimising for.

### A) HMR + native debugging (recommended)

Postgres runs in Docker, but the app runs on your host with Vite and Fastify in watch mode. Edits to TypeScript reload instantly. The Node debugger attaches normally because the API process is on the host.

```bash
npm start
```

This expands to:

```bash
docker compose -f docker-compose.dev.yml up -d    # Postgres + Adminer
npm run -w backend db:migrate                     # apply pending migrations
concurrently "npm run dev:frontend" "npm run dev:backend"
```

Open <http://localhost:5173>. Edits in `frontend/src/**` hot-swap. Edits in `backend/src/**` restart the API in under a second.

### B) Full production-shaped stack on localhost

Useful when you want to verify behaviour that depends on the Caddy reverse proxy or the production build of the frontend. No HMR: every change needs a rebuild.

```bash
cp .env.example .env
$EDITOR .env       # set DOMAIN=localhost and fill the secrets
npm run prod:up    # docker compose up -d --build
npm run prod:logs
```

Caddy serves over HTTPS with a self-signed cert on `localhost`. Your browser will complain on first visit; accept the cert and continue. Every code change needs `npm run prod:up` again.

## npm scripts cheat sheet

| `npm run …` | `make …` | What it does |
|---|---|---|
| `start` | `dev` | Start the full HMR dev flow (DB up + migrate + run) |
| `dev` | (no equivalent) | Front + back with HMR (assumes DB is already up) |
| `db:up` | `db-up` | Start Postgres + Adminer |
| `db:down` | `db-down` | Stop them, keep volumes |
| `db:reset` | `db-reset` | Wipe and recreate (loses all dev data) |
| `db:logs` | `db-logs` | Tail Postgres logs |
| `db:migrate` | `migrate` | Apply pending SQL migrations |
| `lint` | `lint` | ESLint over the frontend |
| `typecheck` | `typecheck` | tsc over both workspaces |
| `build` | `build` | Build both workspaces for production |
| `prod:up` | `prod-up` | Full compose stack with build |
| `prod:down` | `prod-down` | Stop the full stack |
| `prod:logs` | `prod-logs` | Tail prod logs |
| `prod:restart` | `prod-restart` | Restart api + frontend, keep db |

The Makefile mirrors every npm target so `make <thing>` works too.

## Env files

There are two:

- `backend/.env`: used by `npm run dev:backend`. The host-mode flow reads it.
- `.env` at the repo root: used by `docker compose`. Only matters when you run the full stack (flow B or the production deploy).

Both are git-ignored. Only `*.example` files live in the repo. The full env reference is in [CONFIGURATION.md](CONFIGURATION.md).

## Project layout

```
frontend/                        Vite + React 19 + Tailwind v4
  src/
    lib/                         API client, auth, watched-list helpers, constants
    hooks/                       useAuth, ...
    components/                  Presentational components
    pages/                       Discover, Watched, MovieDetailPage, ...
    Layout.tsx                   Header + nav + auth gate
  nginx.conf                     Serves the Vite dist in production
  Dockerfile

backend/                         Fastify + Drizzle + Postgres
  src/
    server.ts                    Fastify bootstrap
    env.ts                       zod-validated environment
    auth/
      google.ts                  Arctic OAuth provider
      session.ts                 Server-side session table + HMAC cookie
      passwordPolicy.ts          Password strength rules (server-authoritative)
      routes.ts                  /api/auth/* endpoints
    plugins/
      authGuard.ts               req.userId + app.requireAuth(req)
    routes/
      discover.ts                GET /api/discover
      search.ts                  GET /api/search?q=
      movie.ts                   GET /api/movie/:id
      meta.ts                    GET /api/genres, /api/providers
      watched.ts                 GET/POST/DELETE /api/watched
      ...
    lib/
      tmdb.ts                    TMDB fetch helper
      omdb.ts                    OMDb fetch helper
    db/
      schema.ts                  Drizzle schema
      client.ts                  pg.Pool + drizzle()
      migrate.ts                 Custom migrator over migrations/*.sql
      migrations/
        0000_initial.sql

shared/                          API contract types (pure types, no runtime)
docker-compose.yml               Production stack (Caddy + frontend + api + db + migrate)
docker-compose.dev.yml           Dev stack (Postgres + Adminer only)
docker-compose.prod.yml          Prod overrides applied on top of docker-compose.yml
Caddyfile                        TLS + reverse proxy config
Makefile                         Convenience targets (mirrors npm scripts)
package.json                     npm workspaces root
```

## Code style

- TypeScript everywhere, strict mode on.
- React 19 with hooks. No class components.
- Tailwind v4. Keep classes in JSX; avoid CSS files unless they hold design tokens.
- Backend uses ESM (`"type": "module"`). Imports keep `.js` extensions even when pointing at `.ts` files (the TS+ESM convention).
- Routes validate input with `zod`. Bad input returns 400 automatically through the `setValidatorCompiler` hook.
- DB access goes through Drizzle. Never `pool.query` directly from a route.
- Comments are reserved for the *why* of non-obvious decisions. Don't restate what the code says.
- Prefer editing existing files over adding new ones.

## Database migrations

The schema is in `backend/src/db/schema.ts` and is the source of truth for Drizzle. Migrations are hand-written SQL in `backend/src/db/migrations/NNNN_short_name.sql`.

The custom migrator (`backend/src/db/migrate.ts`):

1. Reads `*.sql` files in lexical order.
2. Splits each file on `--> statement-breakpoint`.
3. Runs each file in a single transaction.
4. Records applied filenames in `_migrations` so it never re-runs them.

To add a migration:

1. Create `backend/src/db/migrations/000N_short_name.sql`.
2. Write `CREATE` / `ALTER` statements separated by `--> statement-breakpoint`.
3. Update `schema.ts` to match the new shape.
4. Run `npm run -w backend db:migrate`.
5. Verify in Adminer at <http://localhost:8081>.

## Debugging

**Backend.** The HMR flow runs Fastify on your host, so attach any Node debugger to the running `dev:backend` process. VS Code: "Attach to Process" + pick the `tsx watch` process. Set breakpoints in `backend/src/**`.

**Frontend.** Vite emits source maps in dev. Chrome DevTools maps your `.tsx` files directly. React DevTools works as expected.

**Database.** Adminer is at <http://localhost:8081>. Or `psql` against `localhost:5432` with `birceflix/birceflix/birceflix`.

**Network.** All API calls go to `/api/*`. The Vite dev server proxies them to the Fastify port (see `frontend/vite.config.ts`). Network tab in DevTools shows the proxied requests.

## Before opening a PR

```bash
npm run lint
npm run typecheck
npm run build
```

All three must pass. CI runs the same set on every PR.

Linked from [CONTRIBUTING.md](../CONTRIBUTING.md) for branch naming, commit style, and the broader PR process.
