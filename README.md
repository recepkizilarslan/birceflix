<p align="center">
  <img src="assets/logo.svg" alt="Birceflix" width="520">
</p>

<p align="center">
  <a href="https://github.com/recepkizilarslan/birceflix/actions/workflows/ci.yml"><img src="https://github.com/recepkizilarslan/birceflix/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/recepkizilarslan/birceflix/actions/workflows/codeql.yml"><img src="https://github.com/recepkizilarslan/birceflix/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL"></a>
  <a href="https://github.com/recepkizilarslan/birceflix/actions/workflows/deploy.yml"><img src="https://github.com/recepkizilarslan/birceflix/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/recepkizilarslan/birceflix?color=blue" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white" alt="Node 20">
</p>

Birceflix is a self-hostable movie & TV tracker. Search the TMDB catalogue with deep filters, sign in with Google or email, and track what you've watched and what you want to watch. The whole stack runs in containers; one `docker compose up -d` brings it up.

## Documentation

| Doc | What's in it |
|---|---|
| [Quick start](docs/QUICKSTART.md) | Run Birceflix on your laptop in five minutes. |
| [Development](docs/DEVELOPMENT.md) | Dev flows (HMR vs prod-shaped), project layout, code style, migrations, debugging. |
| [Self-hosting](docs/INSTALL.md) | Bring the stack up on your own server with a real domain and TLS. |
| [Configuration](docs/CONFIGURATION.md) | Every env var, every secret, every OAuth client step. |
| [Deployment](docs/DEPLOYMENT.md) | The GitHub Actions CI/CD pipeline, environments, secrets, rollback. |
| [Architecture](docs/ARCHITECTURE.md) | Stack, request flow, auth/session model, key decisions. |
| [Contributing](CONTRIBUTING.md) | Branch naming, commit style, PR process, code review expectations. |
| [Security](SECURITY.md) | Reporting a vulnerability, secret handling, what's in scope. |

## At a glance

- **Frontend**: Vite, React 19, TypeScript, Tailwind v4, served by nginx.
- **Backend**: Node 20, Fastify, TypeScript, REST API on `/api/*`.
- **Database**: PostgreSQL 16.
- **Auth**: Google OAuth (via [Arctic](https://github.com/pilcrowonpaper/arctic)) and email/password, both backed by server-side sessions.
- **Reverse proxy**: Caddy with automatic TLS via Let's Encrypt.
- **External APIs**: TMDB (search, discover, providers, reviews) and OMDb (awards, IMDB rating). Keys stay server-side.

## Features

- Search and filter: original language, production country, genre, year range, minimum rating, runtime, sort order.
- Platform filter using TMDB watch providers, region-aware (defaults to TR, switchable).
- Movie and TV detail pages with synopsis, cast, awards, streaming availability.
- Mark watched, build a watchlist, keep custom lists (private or public-shareable).
- Personal ratings and notes on watched items.
- TR / EN UI, dark theme, mobile-first responsive layout, installable as a PWA.
- Optional Trakt sync (history import + ongoing sync) and Plex/Jellyfin scrobble webhook.
- Letterboxd-compatible CSV import and full JSON export.

## Attribution

Birceflix uses the TMDB API but is not endorsed or certified by TMDB. Movie posters, metadata, and ratings are courtesy of:

- [The Movie Database (TMDB)](https://www.themoviedb.org/)
- [OMDb API](https://www.omdbapi.com/)

## Notice

Birceflix is an independent, non-commercial, open-source personal project.

## License

[MIT](LICENSE) © Recep Kızılarslan
