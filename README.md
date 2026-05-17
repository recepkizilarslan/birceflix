# Birceflix

Discover movies, filter (language, country, genre, platform, rating, year, runtime), sign in with Google, and track what you've watched in a database.
Fully static — deployable to Cloudflare Pages. API keys are hidden behind Cloudflare Pages Functions.

**Stack**
- Vite + React 19 + TypeScript + Tailwind v4
- Cloudflare Pages + Pages Functions (`/functions/api/*`)
- Supabase (Auth + Postgres)
- TMDB (search, discover, watch providers, reviews) + OMDb (awards, IMDB rating)

## Features
- 🔍 Search + filters: original language, production country, genre, year range, min. rating, runtime, sorting
- 📺 Platform filter: Netflix / Disney+ / Prime / BluTV etc. (TMDB watch providers, region-based)
- 🎬 Detail page: synopsis, cast, available streaming platforms
- 🏆 Awards summary (OMDb) + link to IMDB page for the full list
- ★ Both TMDB and IMDB ratings
- ✅ "Watched" mark — stored in Supabase, syncs across devices
- 📱 Mobile-first responsive UI, dark theme

## First-time setup

### 1. Get API keys
- **TMDB** → https://www.themoviedb.org/settings/api → "Developer" application, instantly approved.
- **OMDb** → https://www.omdbapi.com/apikey.aspx → free key via email.

### 2. Set up a Supabase project
1. https://supabase.com → create a new project (free tier).
2. **SQL Editor** → paste and run the contents of `supabase/schema.sql`.
3. **Authentication → Providers → Google** → enable it. Create an OAuth client ID in Google Cloud Console (web app, redirect URI = `https://<project>.supabase.co/auth/v1/callback`).
4. **Authentication → URL Configuration → Site URL** → `http://localhost:5173` for dev, your Cloudflare domain for prod.
5. **Project Settings → API** → copy the `Project URL` and the `anon public` key.

### 3. Local env
```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```
Fill in:
- `.env.local` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEFAULT_WATCH_REGION` (default `TR`)
- `.dev.vars` → `TMDB_API_KEY`, `OMDB_API_KEY` (server-side, for Pages Functions)

### 4. Development

Two options:

**A) Vite alone** — faster, but `/api/*` won't work (TMDB/OMDb calls will fail):
```bash
npm run dev
```

**B) Together with Wrangler** — real Cloudflare environment + working APIs:
```bash
npm run dev:cf
```

Recommended: test everything with `npm run dev:cf` first.

## Deploy to Cloudflare Pages

### First deploy (CLI)
```bash
npm run deploy
```
Wrangler will redirect you to Cloudflare and create the project.

### Subsequent deploys
- **Automatic via Git (recommended):** push the repo to GitHub, then in the Cloudflare dashboard go to `Pages → Create → Connect to Git`. Build settings:
  - Framework preset: `Vite`
  - Build command: `npm run build`
  - Build output: `dist`
  - Functions directory (auto-detected): `functions`
- **Environment variables** (Pages → Project → Settings):
  - `TMDB_API_KEY` (encrypted)
  - `OMDB_API_KEY` (encrypted)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_DEFAULT_WATCH_REGION` (e.g. `TR`)

> `VITE_`-prefixed env vars are baked into the bundle at build time (frontend); the others are provided to Functions at runtime (server-side, kept secret).

## Architecture notes

- **TMDB → primary source.** Search, filtering, detail, reviews, watch providers all come from TMDB.
- **OMDb → enrichment.** When the detail page opens, we use the `imdb_id` returned by TMDB to query OMDb → fetching `Awards` and `imdbRating`. OMDb has a 1000/day limit, so it's only called on the detail page (not during list/card fetches).
- **IMDB rating filter gotcha.** TMDB discover only filters by TMDB's own rating. The min. rating slider is bound to the `vote_average.gte` parameter; the IMDB rating shown on cards is display-only (and on the detail page).
- **Reviews come from TMDB.** There's no API for IMDB reviews. TMDB user reviews (mostly English, limited in count) are displayed instead.
- **RLS.** Row Level Security is enabled on the `watched_movies` table; every user only sees/edits their own rows. The frontend calls with the `anon key` — RLS handles the rest.

## Structure

```
movie-tracker/
├── functions/api/          # Cloudflare Pages Functions (API proxy)
│   ├── _shared.ts          #   shared: env type, tmdb/omdb fetch helpers
│   ├── discover.ts         #   GET /api/discover
│   ├── search.ts           #   GET /api/search?q=...
│   ├── movie/[id].ts       #   GET /api/movie/:id (detail + awards + providers + reviews)
│   ├── providers.ts        #   GET /api/providers?region=TR
│   └── genres.ts           #   GET /api/genres
├── src/
│   ├── lib/
│   │   ├── api.ts          # frontend API client + types
│   │   ├── supabase.ts     # supabase client
│   │   ├── watched.ts      # watched-list CRUD
│   │   └── constants.ts    # languages, countries, sort options
│   ├── hooks/useAuth.ts
│   ├── components/
│   │   ├── AuthButton.tsx
│   │   ├── SearchBar.tsx
│   │   ├── FilterPanel.tsx
│   │   └── MovieCard.tsx
│   ├── pages/
│   │   ├── Discover.tsx
│   │   ├── Watched.tsx
│   │   └── MovieDetailPage.tsx
│   ├── Layout.tsx          # header + nav + watched state
│   ├── App.tsx             # router
│   ├── main.tsx
│   └── index.css           # Tailwind + theme
├── supabase/schema.sql
├── wrangler.toml
├── .env.example
└── .dev.vars.example
```

## Security

- **Secrets are never committed.** `.env.local`, `.dev.vars`, `.wrangler/` are in `.gitignore`; only the `*.example` files live in the repo.
- **API keys are server-side.** `TMDB_API_KEY` and `OMDB_API_KEY` are called through Pages Functions and never appear in the frontend bundle. If one leaks, rotate it from the TMDB/OMDb dashboard.
- **The Supabase anon key is public by design** (it's already in the frontend). Security is enforced by RLS — in the `watched_movies` table every user can only see/write their own rows (`supabase/schema.sql`).
- **OAuth redirect URL whitelist.** Only your own domains should be listed under Supabase Auth → URL Configuration.
- **Dependencies.** Running `npm audit` periodically is recommended.

If you suspect a leak: rotate the affected key from its provider, then update the Cloudflare Pages env vars and `.dev.vars` locally.

## Roadmap
- Infinite scroll (currently page buttons)
- Personal rating + notes (`my_rating`, `notes` columns are already in the DB)
- TV-show support (TMDB `/tv/*` endpoints)
- Watchlist (on request)
