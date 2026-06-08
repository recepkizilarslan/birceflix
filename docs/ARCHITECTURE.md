# Architecture

High-level shape of Birceflix and the rationale behind the load-bearing decisions.

## Stack at a glance

```
+----------------+
|    Browser     |
+--------+-------+
         |
         v
+----------------+
|     Caddy      |   TLS, serves the static frontend, reverse-proxies /api
+--------+-------+
         | /api/*
         v
+----------------+
|      api       |
+--------+-------+
         |
         v
+----------------+
|       db       |   Postgres 16
+----------------+
```

- **frontend**: Vite + React 19 + TypeScript + Tailwind v4, built to static assets. The build is baked into the Caddy image and served directly by Caddy, so there is no separate web container.
- **api**: Fastify + TypeScript on Node 20, REST endpoints under `/api/*`.
- **db**: Postgres 16, only reachable from the api container on a private docker network.
- **Caddy**: the only web tier. TLS via Let's Encrypt, serves the static frontend build from `/srv`, and reverse-proxies `/api/*` to the api.
- **migrate**: one-shot container that runs pending SQL migrations before the api boots, then exits.

## Request flow

A typical authenticated movie search:

```
Browser  --GET /api/search?q=blade--> Caddy
Caddy    --GET /api/search?q=blade--> api (Fastify)
api      reads session cookie, validates HMAC, looks up session row in db
api      --GET https://api.themoviedb.org/3/search/movie--> TMDB
api      --200 JSON--> Caddy --> Browser
```

The TMDB key never leaves the api container. The browser only sees `/api/*` and can't reach TMDB directly.

## Authentication

Birceflix accepts two paths into a user account: Google OAuth and email/password. Both end up in the same `users` row and create the same kind of session.

### OAuth (Google)

[Arctic](https://github.com/pilcrowonpaper/arctic) handles the OAuth dance. The flow:

1. Browser hits `/api/auth/google`. The api generates `state` and a PKCE `code_verifier`, writes both into short-lived HTTP-only cookies, and 302s the browser to Google.
2. Google redirects back to `/api/auth/google/callback?code=…&state=…`.
3. The api verifies `state` matches the cookie, exchanges `code` (with `code_verifier`) for tokens, fetches `userinfo`.
4. Only `email_verified: true` identities are accepted.
5. A `users` row is upserted by (Google sub, email). A session row is created. An HMAC-signed cookie carrying the opaque session id is set.

### Email + password

1. `POST /api/auth/register` with `{email, password, name?}`.
2. Password is checked against `backend/src/auth/passwordPolicy.ts`: min 10 chars, at least 3 of 4 character classes (lower / upper / digit / symbol), not in the embedded common-password list, not equal to the email or its local-part.
3. Password is Argon2-hashed and stored.
4. A session is created (same shape as OAuth).
5. Per-IP rate limit on `/api/auth/register` and `/api/auth/login`: 10 attempts per 15 minutes, shared window across both endpoints.

### Sessions, not JWTs

Decision: server-side session rows with an opaque id in an HMAC-signed cookie, instead of JWTs.

Reasoning:

- Revocation is a single `DELETE FROM sessions WHERE id = …`. No need to track a revocation list or wait for expiry.
- The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production. The signing key (`SESSION_SECRET`) is rotated by replacing the env var, which logs everyone out.
- The cookie carries no claims, so user updates (rename, email change) take effect on the next request without re-issuing tokens.
- The single round-trip to `sessions` per request is fine for a personal app.

## Authorization

There is no row-level security on Postgres. Authorization is enforced in the backend:

- The `authGuard` plugin populates `req.userId` from the session cookie.
- Every protected route calls `app.requireAuth(req)`, which 401s if there's no session.
- Every query that touches user data filters by `req.userId` from the session, never from the request body or URL.

If a route forgot to call `requireAuth`, it would 401 implicitly because `req.userId` is undefined. Worse, a route that scoped by `req.body.userId` would be a vuln, hence the convention.

## Data model

```
users
  id (uuid pk)
  email (unique)
  name
  google_sub (nullable, unique)
  password_hash (nullable; null = OAuth-only)
  email_verified
  created_at, updated_at

sessions
  id (opaque, used in the cookie)
  user_id -> users.id
  expires_at, created_at
  user_agent (for "active sessions" listing)

watched
  user_id -> users.id
  tmdb_id, media_type ('movie' | 'tv')
  watched_at, rating, notes
  primary key (user_id, tmdb_id, media_type)

watchlist
  user_id -> users.id
  tmdb_id, media_type
  added_at
  primary key (user_id, tmdb_id, media_type)

lists, list_items
  user lists with sharing (private + public-shareable)
```

The full Drizzle schema is in `backend/src/db/schema.ts`. Hand-written migrations live in `backend/src/db/migrations/`. See [DEVELOPMENT.md](DEVELOPMENT.md#database-migrations) for the migrator's contract.

## External APIs

| API | What | When |
|---|---|---|
| TMDB | Search, discover, movie/tv detail, watch providers, reviews | Every Discover and detail-page request |
| OMDb | IMDB rating, awards summary | Only on movie detail (1000/day limit) |
| Google OAuth | Sign-in | On `/api/auth/google` and callback |

All third-party calls are server-side. Keys are read from env on backend boot. The Vite bundle never sees them.

## Frontend architecture

```
src/
  main.tsx                React 19 entry
  Layout.tsx              Auth gate + header + bottom tab bar
  hooks/useAuth.ts        getMe + signInWithGoogle + signOut
  lib/
    api.ts                fetch helpers for /api/*
    auth.ts               typed AuthError + register/login wrappers
    preferences.ts        localStorage-backed user prefs (region, theme)
  pages/
    Discover.tsx          Search + filter UI, infinite scroll
    MovieDetailPage.tsx
    TvDetailPage.tsx
    WatchedPage.tsx
    WatchlistPage.tsx
    ListsPage.tsx
  components/
    SignInScreen.tsx      Mobile-first auth landing (tab toggle, eye toggle, brand marquee)
    DiscoverCard.tsx
    FilterPanel.tsx       Bottom-sheet on mobile, drawer on desktop
    AuthButton.tsx
    Layout primitives (Avatar, modal/menu, etc.)
  i18n/
    locales/tr.json
    locales/en.json
```

Routing is by simple `useState`-driven views inside `Layout.tsx`, not React Router. There are no deeply-nested routes; the URL is mostly aesthetic.

State management is plain React. No Redux/Zustand/etc. Authentication state lives in `useAuth` (per-mount), watched/watchlist keys live in `Layout` and are passed down.

## Backend architecture

Fastify with a thin plugin layer:

- `plugins/authGuard.ts`: decorates `req` with `userId` from the session cookie, exposes `app.requireAuth(req)`.
- `plugins/rateLimit.ts`: per-route `@fastify/rate-limit` config (global 300/min, auth endpoints 10/15min).
- `plugins/cors.ts`: only allows `FRONTEND_ORIGIN`.

Routes are plain `async (req, reply) => …` functions, validated with `zod` via Fastify's validator compiler. Bad input returns 400 automatically. The routes never see invalid shapes.

The TMDB and OMDb clients are small fetch wrappers in `backend/src/lib/`. They centralise API key handling, set a User-Agent, surface upstream errors as typed exceptions, and add per-call timeouts.

## Why these choices

| Decision | Reasoning |
|---|---|
| No serverless / managed BaaS | Self-hostable on a single small box. No vendor coupling. |
| Single Postgres role, no RLS | Simpler mental model. Authz enforced in the backend, audited by `requireAuth` calls in routes. |
| Hand-written SQL migrations | Drizzle's auto-migrator is great for schema diffs but doesn't handle data backfills well. Hand-written gives full control. |
| Server-side sessions | See [Sessions, not JWTs](#sessions-not-jwts) above. |
| TMDB as the primary source | One canonical id space (TMDB ids) for movies and TV. OMDb is enrichment-only, on the detail page. |
| Tailwind v4, no design system lib | Project is small enough that a class-name vocabulary plus a few CSS variables is enough. |
| Plain React state, no global store | The shared state is auth + watched/watchlist keys. Both live in `Layout`. A global store would be overkill. |
| Caddy as the only web tier (no nginx) | Let's Encrypt cert provisioning is built-in, config is one short file, and Caddy serves the static build itself, so there is no separate nginx container to run, configure, or keep in sync. The security headers (CSP, HSTS, COOP/CORP, etc.) live next to the proxy that fronts everything. |

## Security headers

Set in the `Caddyfile`, single source of truth:

- `Content-Security-Policy`: locked to known origins (`image.tmdb.org`, `*.googleusercontent.com`, `fonts.googleapis.com`, `fonts.gstatic.com`). `frame-ancestors 'none'`, `form-action 'self' https://accounts.google.com`, `base-uri 'self'`, `object-src 'none'`, `upgrade-insecure-requests`.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`.
- `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies: none`.
- `Permissions-Policy`: deny every device feature the app never asks for.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

Caddy is the only tier serving HTTP, so these headers are defined in exactly one place.

## Caching (no service worker)

There is no PWA service worker. Birceflix used to ship one (`vite-plugin-pwa` precaching `**/*.{js,css,html,svg,woff2}`), but precaching the app shell meant the SW served whatever build it had cached: users were stranded on mismatched builds and the site "looked different for everyone" until a hard refresh. No amount of `autoUpdate` / manual `updateServiceWorker(true)` / hourly `update()` polling closed the window reliably.

Caching is now governed entirely by Caddy (`Caddyfile`), which serves the static build directly:

- Hashed assets (`/assets/*`: `*.js`, `*.css`, fonts, images) → `Cache-Control: public, max-age=31536000, immutable`. Safe because the content hash is in the filename.
- Everything else, including `index.html`, the SPA fallback, and `sw.js` → `Cache-Control: no-store`, so every visit fetches the current shell, which references the current asset hashes.

The plugin is kept only in `selfDestroying` mode (`vite.config.ts`): it emits a service worker that unregisters itself and purges all Cache Storage on activation, registered via `ServiceWorkerCleanup`. This cleans up clients that still have the old SW installed. Once enough time has passed that visitors have all loaded a post-removal build, the plugin and `ServiceWorkerCleanup` can be deleted outright.
