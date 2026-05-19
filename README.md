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

## Journal

Birceflix started as a way to solve a recurring household problem. My wife and I subscribe to a handful of streaming platforms, and every time we sat down for a movie night the same thing happened: we couldn't decide what to watch. Each platform's filters felt built to push us toward what they wanted us to see, not what we actually wanted. We'd open three apps in turn, hunting for the right combination of language, country, year, rating, runtime, and availability, and end up giving up.

So I built one place that pulls metadata from TMDB, layers awards and IMDB ratings from OMDb, shows which platforms are streaming each title in our region, and lets us filter the way we actually think. The "watched" list keeps us from re-discovering films we already saw. The watchlist keeps the "let's save this for later" idea from disappearing the moment we closed the app.

The project is named after my daughter, **Birce**. It is open source under the MIT license, fully self-hostable, and has no commercial intent. It was coded end-to-end with [Claude Sonnet 4.7](https://www.anthropic.com/claude) as the pair programmer; every commit on `main` started life in a Claude Code session.

If any of this resonates with you, the docs below explain how to run your own copy in five minutes, how to self-host it on your own server, and how the pieces fit together under the hood.

## Documentation

1. [**Quick start**](docs/QUICKSTART.md). Run Birceflix on your laptop in about five minutes. Prereqs, env files, `npm start`, common gotchas.
2. [**Development**](docs/DEVELOPMENT.md). The deep walkthrough: two dev flows (HMR vs production-shaped), the project layout, code style, the migration workflow, debugging.
3. [**Self-hosting**](docs/INSTALL.md). Bring the stack up on your own server with a real domain and a real Let's Encrypt cert. DNS, env config, backups, upgrade procedure, troubleshooting.
4. [**Configuration**](docs/CONFIGURATION.md). Every environment variable with its example value and effect. Step-by-step setup for Google OAuth, TMDB, OMDb, and the optional Trakt integration.
5. [**Deployment**](docs/DEPLOYMENT.md). The GitHub Actions CI/CD pipeline: who can deploy, how the rollout works on the server, the GHCR image layout, the secrets it needs, and how to roll back.
6. [**Architecture**](docs/ARCHITECTURE.md). Stack and request flow, the authentication and session model (and why it's sessions instead of JWTs), the database schema at a glance, the key design decisions.
7. [**Contributing**](CONTRIBUTING.md). Branch naming, commit style, code style summary, the PR process, the visual-identity ground rules, the migration contract.
8. [**Security**](SECURITY.md). How to report a vulnerability privately, the scope of what counts, secret handling, the response checklist if you suspect compromise.

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

<p>
  <a href="https://www.themoviedb.org/">
    <img src="assets/tmdb-logo.svg" alt="The Movie Database (TMDB)" height="20">
  </a>
</p>

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie and TV metadata, posters, watch-provider data, and reviews come from [The Movie Database (TMDB)](https://www.themoviedb.org/). Awards data and IMDB ratings come from the [OMDb API](https://www.omdbapi.com/). All trademarks, logos, and artwork are property of their respective owners.

## Notice

Birceflix is an independent, non-commercial, open-source personal project.

## License

[MIT](LICENSE) © Recep Kızılarslan
