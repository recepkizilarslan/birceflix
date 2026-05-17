# Contributing to Birceflix

Thanks for your interest! Birceflix is a small personal project, but contributions (bug fixes, small features, doc improvements) are welcome.

## Quick links
- Bug reports / feature requests → [Issues](https://github.com/recepkizilarslan/birceflix/issues)
- Security issues → see [SECURITY.md](SECURITY.md) (do **not** file a public issue)

## Development setup

You will need:
- Node.js 20+
- A free [TMDB](https://www.themoviedb.org/settings/api) API key
- A free [OMDb](https://www.omdbapi.com/apikey.aspx) API key
- A [Supabase](https://supabase.com) project (free tier is fine)

### 1. Get API keys
- **TMDB** → https://www.themoviedb.org/settings/api → request a "Developer" key, approved instantly.
- **OMDb** → https://www.omdbapi.com/apikey.aspx → free key via email.

### 2. Set up Supabase
1. Create a new project at https://supabase.com.
2. **SQL Editor** → paste and run the contents of `supabase/schema.sql`.
3. **Authentication → Providers → Google** → enable it. Create an OAuth client ID in Google Cloud Console (web app, redirect URI = `https://<project>.supabase.co/auth/v1/callback`).
4. **Authentication → URL Configuration → Site URL** → `http://localhost:5173` for dev.
5. **Project Settings → API** → copy the `Project URL` and the `anon public` key.

### 3. Local env files

```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```

Fill in:
- `.env.local` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEFAULT_WATCH_REGION` (default `TR`)
- `.dev.vars` → `TMDB_API_KEY`, `OMDB_API_KEY` (server-side, for Pages Functions)

Both files are git-ignored — never commit them.

### 4. Install and run

```bash
npm install
```

Two dev options:

**A) Vite alone** — fast, but `/api/*` calls won't work (TMDB/OMDb fail):
```bash
npm run dev
```

**B) With Wrangler** — real Cloudflare environment, APIs work:
```bash
npm run dev:cf
```

Recommended: use `npm run dev:cf` for end-to-end testing.

## Project layout

```
functions/api/   # Cloudflare Pages Functions (server-side API proxy)
src/lib/         # API client, supabase, watched-list CRUD, constants
src/components/  # presentational components
src/pages/       # Discover, Watched, MovieDetailPage
src/Layout.tsx   # header + nav + watched state
supabase/        # schema.sql (run once in Supabase SQL Editor)
```

## Code style

- TypeScript everywhere, strict mode on.
- React 19 with hooks (no class components).
- Tailwind v4 for styling — keep classes in JSX, avoid CSS files unless needed for tokens (see `src/index.css`).
- No comments unless the *why* is non-obvious. Identifiers carry the *what*.
- Avoid premature abstraction: three similar lines beat a half-baked helper.
- Prefer editing existing files over adding new ones.

### Before opening a PR

```bash
npx tsc -p tsconfig.app.json --noEmit   # type check
npm run build                            # full build
```

Both should pass.

## Pull request process

1. Fork and create a topic branch (`fix/...`, `feat/...`, `docs/...`).
2. Keep the diff focused — one logical change per PR.
3. Update the README / docs if behavior or setup changes.
4. Don't commit secrets or `.env*` files (they are gitignored — please don't disable that).
5. Open a PR with a short description of *what* changed and *why*.

## Architecture notes

- **TMDB → primary source.** Search, filtering, detail, reviews, watch providers.
- **OMDb → enrichment.** Called only on the detail page (1000/day limit), using the `imdb_id` returned by TMDB → adds `Awards` + `imdbRating`.
- **Min. rating filter is TMDB rating.** IMDB rating is shown but not filterable.
- **Reviews are TMDB-only.** There's no public API for IMDB reviews.
- **RLS protects user data.** Every `watched_movies` row belongs to a `user_id`; policies restrict access to that user. The frontend uses the public anon key — RLS is the actual gatekeeper.

## Deploy

See the "Deploy" section in the [README](README.md) for Cloudflare Pages setup. CI is not configured yet; pushes to `main` can be auto-deployed via the Cloudflare Pages GitHub integration.
