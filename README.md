# Birceflix

Discover movies, filter them (language, country, genre, platform, rating, year, runtime), sign in with Google, and track what you've watched.

Fully static — deployable to Cloudflare Pages. Third-party API keys are kept server-side behind Cloudflare Pages Functions.

## Stack
- Vite + React 19 + TypeScript + Tailwind v4
- Cloudflare Pages + Pages Functions (`/functions/api/*`)
- Supabase (Auth + Postgres)
- TMDB (search, discover, watch providers, reviews) + OMDb (awards, IMDB rating)

## Features
- 🔍 Search + filters: original language, production country, genre, year range, min. rating, runtime, sorting
- 📺 Platform filter: Netflix / Disney+ / Prime / BluTV etc. (TMDB watch providers, region-based)
- 🎬 Detail page: synopsis, cast, available streaming platforms
- 🏆 Awards summary (OMDb) + link to IMDB for the full list
- ★ Both TMDB and IMDB ratings
- ✅ "Watched" mark — stored in Supabase, syncs across devices
- 📱 Mobile-first responsive UI, dark theme

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in Supabase keys
cp .dev.vars.example .dev.vars  # then fill in TMDB + OMDb keys
npm run dev:cf                  # Vite + Wrangler (so /api/* works)
```

Full setup walkthrough (API keys, Supabase project, OAuth, env vars) is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploy to Cloudflare Pages

### One-shot CLI deploy
```bash
npm run deploy
```

### Recommended: connect via Git
Push to GitHub, then in the Cloudflare dashboard go to `Pages → Create → Connect to Git`:
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output: `dist`
- Functions directory (auto-detected): `functions`

**Environment variables** (Pages → Project → Settings → Environment variables):
- `TMDB_API_KEY` (encrypted)
- `OMDB_API_KEY` (encrypted)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEFAULT_WATCH_REGION` (e.g. `TR`)

> `VITE_`-prefixed env vars are baked into the bundle at build time (frontend). The others are provided to Functions at runtime (server-side, never shipped to the browser).

## Documentation

- [**CONTRIBUTING.md**](CONTRIBUTING.md) — local dev setup, project layout, code style, PR process, architecture notes.
- [**SECURITY.md**](SECURITY.md) — security policy, how to report a vulnerability, secret-handling rules.
- [**LICENSE**](LICENSE) — MIT.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Movie ratings, posters and metadata are courtesy of:
- [The Movie Database (TMDB)](https://www.themoviedb.org/)
- [OMDb API](https://www.omdbapi.com/)

## License

[MIT](LICENSE) © Recep Kızılarslan
