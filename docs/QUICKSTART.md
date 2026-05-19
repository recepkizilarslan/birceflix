# Quick start

Goal: get Birceflix running on your laptop in about five minutes. You'll have the Vite dev server on `:5173`, the Fastify API on `:3000`, and a containerised Postgres on `:5432`.

If you want the full production-shaped stack instead (Caddy + nginx + everything in containers), skip to [INSTALL.md](INSTALL.md). If you want the deeper walkthrough with debugging tips, project layout, and migration workflow, go to [DEVELOPMENT.md](DEVELOPMENT.md) after you've finished this page.

## Prerequisites

| Tool | Why | Check |
|---|---|---|
| Node.js 20+ | Workspace runtime | `node -v` |
| npm 10+ | Workspace package manager | `npm -v` |
| Docker | Runs Postgres locally (you can use a host Postgres instead, see [DEVELOPMENT.md](DEVELOPMENT.md)) | `docker -v` |
| Git | Clone the repo | `git -v` |

You also need three external accounts, all free:

- [TMDB](https://www.themoviedb.org/settings/api) for movie data.
- [OMDb](https://www.omdbapi.com/apikey.aspx) for IMDB ratings and awards.
- [Google Cloud Console](https://console.cloud.google.com/) for OAuth (sign-in).

Each takes about a minute to set up. [CONFIGURATION.md](CONFIGURATION.md) walks through the keys one by one.

## Steps

### 1. Clone and install

```bash
git clone https://github.com/recepkizilarslan/birceflix.git
cd birceflix
npm install
```

`npm install` covers all three workspaces (frontend, backend, shared) in one pass.

### 2. Create your env files

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

You only need to edit `backend/.env` for dev mode. The root `.env` is for the production-style compose stack and can stay as-is until you try that flow.

Open `backend/.env` and fill in:

```env
SESSION_SECRET=<paste the output of `openssl rand -base64 48`>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
TMDB_API_KEY=<from TMDB>
OMDB_API_KEY=<from OMDb>
```

Leave `DATABASE_URL` alone if you're going to use the included dockerised Postgres.

For OAuth, the redirect URI in Google Cloud Console must be `http://localhost:3000/api/auth/google/callback` exactly. See [CONFIGURATION.md](CONFIGURATION.md#google-oauth) for the full Google setup.

### 3. Start everything

```bash
npm start
```

That one command does three things in order:

1. Brings up Postgres + Adminer with `docker compose -f docker-compose.dev.yml up -d`.
2. Runs pending migrations.
3. Starts frontend (`:5173`) and backend (`:3000`) concurrently with HMR.

Open <http://localhost:5173> and sign in with Google.

Adminer (a web Postgres browser) sits at <http://localhost:8081>. Login: server `db`, user `birceflix`, password `birceflix`, database `birceflix`.

## What's next

- More detail on the dev workflow, code style, migrations, debugging: [DEVELOPMENT.md](DEVELOPMENT.md).
- Self-host Birceflix on your own server: [INSTALL.md](INSTALL.md).
- All the env vars and how to generate each secret: [CONFIGURATION.md](CONFIGURATION.md).
- Architecture diagrams and key design decisions: [ARCHITECTURE.md](ARCHITECTURE.md).

## Troubleshooting

**`npm start` fails with a Postgres connection error.** Docker isn't running, or port 5432 is already taken on your host. Check `docker ps` and `lsof -i :5432`.

**Sign-in opens Google, comes back, and shows "redirect_uri_mismatch".** The redirect URI in Google Cloud Console doesn't match `GOOGLE_REDIRECT_URI` in `backend/.env`. Both must be `http://localhost:3000/api/auth/google/callback` byte-for-byte.

**Discover is empty.** Either `TMDB_API_KEY` is missing or it hasn't been validated yet. TMDB takes a few minutes after issuing a key for it to start working.

**You see "EADDRINUSE :::3000" or ":::5173".** Another process is on that port. `lsof -i :3000` to find it, kill or change the port.

For anything else, the deeper [DEVELOPMENT.md](DEVELOPMENT.md) likely has it.
