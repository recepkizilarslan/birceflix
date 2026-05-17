<p align="center">
  <img src="assets/logo.svg" alt="Birceflix" width="520">
</p>

# Birceflix

Discover movies, filter them (language, country, genre, platform, rating, year, runtime), sign in with Google, and track what you've watched.

**Self-hosted** — runs on your own server with Docker Compose. No third-party BaaS.

## Stack
- **Frontend** — Vite + React 19 + TypeScript + Tailwind v4 → served by nginx.
- **Backend** — Node.js + Fastify + TypeScript (REST API on `/api/*`).
- **Database** — PostgreSQL 16.
- **Auth** — Google OAuth via [Arctic](https://github.com/pilcrowonpaper/arctic) + server-side sessions (HMAC-signed cookies, sessions in Postgres).
- **Reverse proxy** — Caddy (auto TLS via Let's Encrypt).
- **External APIs** — TMDB (search/discover/providers/reviews) + OMDb (awards/IMDB rating). Keys stay server-side, never shipped to the browser.

## Architecture

```
[Browser]
    │
    ▼
[Caddy]  (TLS, reverse proxy)
    ├── /api/*   → backend  (Fastify)
    └── /        → frontend (nginx serving Vite dist)
                       │
                       ▼
                  [Postgres]
```

Two app containers + Postgres + Caddy. One `docker-compose up -d` brings up the stack.

## Quick start (local dev)

```bash
# 1. Get the code & install
git clone https://github.com/recepkizilarslan/birceflix.git
cd birceflix
npm install

# 2. Configure
cp .env.example .env                  # for docker-compose
cp backend/.env.example backend/.env  # for `npm run dev:backend`

# Fill in: DB_PASSWORD, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#         TMDB_API_KEY, OMDB_API_KEY.
# See CONTRIBUTING.md for how to obtain each one.

# 3. Local development
npm run dev      # runs frontend (5173) + backend (3000) together
                 # — backend expects a Postgres reachable via DATABASE_URL.

# Easiest local Postgres:
docker run -d --name birceflix-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=birceflix -e POSTGRES_USER=birceflix -e POSTGRES_DB=birceflix \
  postgres:16-alpine
npm run -w backend db:migrate
```

The full dev walkthrough (Google OAuth setup, env vars, troubleshooting) lives in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploy (on-prem)

```bash
# On your server:
git clone https://github.com/recepkizilarslan/birceflix.git
cd birceflix
cp .env.example .env
$EDITOR .env                      # fill in real secrets + DOMAIN=birceflix.example.com
docker compose up -d --build
docker compose logs -f api        # watch the boot
```

The `migrate` service runs once and exits — it applies any pending SQL migrations before the `api` service starts.

For HTTPS, just set `DOMAIN` to a real public hostname pointing at the server. Caddy provisions the cert automatically (ports 80/443 must reach the box).

## Features
- 🔍 Search + filters: original language, production country, genre, year range, min. rating, runtime, sorting
- 📺 Platform filter: Netflix / Disney+ / Prime / BluTV etc. (TMDB watch providers, region-based)
- 🎬 Detail page: synopsis, cast, available streaming platforms
- 🏆 Awards summary (OMDb) + link to IMDB for the full list
- ★ Both TMDB and IMDB ratings
- ✅ "Watched" mark — stored in Postgres, syncs across devices for the same Google account
- 📱 Mobile-first responsive UI, dark theme

## Layout

```
birceflix/
├── frontend/         # Vite + React + Tailwind
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── backend/          # Fastify + Drizzle + Arctic
│   ├── src/
│   │   ├── server.ts
│   │   ├── env.ts          # zod-validated environment
│   │   ├── auth/           # Google OAuth + sessions
│   │   ├── routes/         # /api/discover, /search, /movie/:id, /watched, ...
│   │   ├── lib/            # TMDB/OMDb clients
│   │   ├── plugins/        # Fastify plugins (authGuard)
│   │   └── db/             # Drizzle schema, client, migrations, migrate.ts
│   └── Dockerfile
├── shared/           # API contract types shared by both packages
├── docker-compose.yml
├── Caddyfile
├── .env.example
└── package.json      # npm workspaces root
```

## Documentation

- [**CONTRIBUTING.md**](CONTRIBUTING.md) — local dev setup, Google OAuth, project layout, code style, PR process.
- [**SECURITY.md**](SECURITY.md) — security policy, how to report a vulnerability, secret handling.
- [**LICENSE**](LICENSE) — MIT.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Movie ratings, posters and metadata are courtesy of:
- [The Movie Database (TMDB)](https://www.themoviedb.org/)
- [OMDb API](https://www.omdbapi.com/)

## License

[MIT](LICENSE) © Recep Kızılarslan
