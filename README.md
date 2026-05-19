<p align="center">
  <img src="assets/logo.svg" alt="Birceflix" width="520">
</p>

<p align="center">
  <a href="https://github.com/recepkizilarslan/birceflix/actions/workflows/ci.yml"><img src="https://github.com/recepkizilarslan/birceflix/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/recepkizilarslan/birceflix/actions/workflows/codeql.yml"><img src="https://github.com/recepkizilarslan/birceflix/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL"></a>
  <a href="https://github.com/recepkizilarslan/birceflix/actions/workflows/deploy.yml"><img src="https://github.com/recepkizilarslan/birceflix/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/recepkizilarslan/birceflix?color=blue" alt="License: MIT"></a>
  <a href="https://github.com/recepkizilarslan/birceflix/releases"><img src="https://img.shields.io/github/v/release/recepkizilarslan/birceflix?include_prereleases&sort=semver&display_name=tag" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white" alt="Node 20">
</p>

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

Two flows depending on what you're optimising for.

### A) HMR + native debugging — recommended for development

Database runs in Docker; the app runs on your host with Vite/Fastify HMR.

```bash
git clone https://github.com/recepkizilarslan/birceflix.git
cd birceflix
npm install

cp backend/.env.example backend/.env
$EDITOR backend/.env   # SESSION_SECRET (32+ chars), Google OAuth, TMDB, OMDb

npm start              # = docker compose -f docker-compose.dev.yml up
                       # + npm run -w backend db:migrate
                       # + concurrently runs frontend (:5173) + backend (:3000)
```

That's it. Open <http://localhost:5173>.

Adminer (web DB browser) sits at <http://localhost:8081> — server `db`, user/pass `birceflix`.

Individual targets are also exposed:

| `npm run …`     | `make …`   | What it does                                   |
|-----------------|------------|------------------------------------------------|
| `db:up`         | `db-up`    | Start Postgres + Adminer                       |
| `db:down`       | `db-down`  | Stop them (volumes preserved)                  |
| `db:reset`      | `db-reset` | Wipe + recreate (data loss)                    |
| `db:migrate`    | `migrate`  | Apply pending SQL migrations                   |
| `dev`           | —          | Frontend + backend with HMR                    |

### B) Full prod-shaped stack on localhost

Mirrors what the on-prem deploy looks like (Caddy → nginx → frontend, Caddy → api → Postgres).

```bash
cp .env.example .env
$EDITOR .env            # DOMAIN=localhost, DB_PASSWORD, SESSION_SECRET, OAuth, TMDB/OMDb
npm run prod:up         # = docker compose up -d --build
npm run prod:logs
```

Caddy serves over HTTPS with a self-signed cert on `localhost`. Useful for testing the production build but no HMR — every code change needs `npm run prod:up` again.

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

## Notice

Birceflix is an independent, non-commercial, open-source personal project. It is **not affiliated with, endorsed by, or sponsored by Netflix, Inc.** or any other streaming service.

The `-flix` suffix is a generic English word used by many unrelated open-source projects (e.g. [MovieFlix](https://github.com/shalenMathew/MovieFlix_App), [FilmFlix](https://github.com/AliAsgharSWE/FilmFlix), [Myflix](https://github.com/farfalleflickan/Myflix), [OpenFLIXR](https://github.com/cyberlooper/OpenFLIXR2.Wizard)) and commercial products, and is not exclusively associated with Netflix.

The project's visual identity is intentionally distinct from Netflix's brand assets:

| | Netflix | Birceflix |
|---|---|---|
| Primary color | `#E50914` | `#FF3B47` (lighter, pink-shifted) |
| Wordmark font | Impact / condensed display | Inter (humanist sans-serif) |

If you fork or redistribute this project under the MIT license, please keep this notice and avoid adopting Netflix's exact brand color or wordmark style in your derivative work.

## License

[MIT](LICENSE) © Recep Kızılarslan
