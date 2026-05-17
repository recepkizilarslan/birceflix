# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Birceflix, please **do not open a public GitHub issue**. Instead, report it privately:

- Email: **recepkizilarslan@gmail.com**
- Or use GitHub's [Private vulnerability reporting](https://github.com/recepkizilarslan/birceflix/security/advisories/new).

Please include:
- A clear description of the issue and its impact.
- Steps to reproduce (proof of concept if possible).
- Any suggested mitigation.

You will get an acknowledgement within a few days. Birceflix is a small personal project, so there is no formal SLA, but credible reports will be triaged as quickly as possible.

## Scope

In scope:
- The application code in this repository.
- The Cloudflare Pages Functions under `functions/api/*` (server-side API proxy).
- The Supabase schema in `supabase/schema.sql` (RLS, table definitions).

Out of scope:
- Vulnerabilities in upstream dependencies (TMDB, OMDb, Supabase, Cloudflare). Please report those upstream.
- Issues that require a compromised user device or browser extension.
- Rate-limit / denial-of-service findings without a clear bypass of intended limits.

## Secret handling

The repo is designed so that no secret is ever committed. The following are git-ignored:

- `.env.local` — frontend env vars (Supabase URL / anon key / default region).
- `.dev.vars` — server-side env vars used by Wrangler (`TMDB_API_KEY`, `OMDB_API_KEY`).
- `.wrangler/` — local Wrangler state.

Only the `*.example` files (placeholders, no values) live in the repo.

### Server-side API keys
- `TMDB_API_KEY` and `OMDB_API_KEY` are called only from `functions/api/*` (Cloudflare Pages Functions). They are **never** included in the frontend bundle.
- If you suspect a key has leaked, rotate it from the provider dashboard immediately:
  - TMDB → https://www.themoviedb.org/settings/api
  - OMDb → https://www.omdbapi.com/apikey.aspx
- Then update the value in:
  - Cloudflare Pages → Project → Settings → Environment variables, **and**
  - your local `.dev.vars`.

### Supabase anon key
- The Supabase anon key is intentionally public (it ships in the frontend bundle, like any Supabase web app).
- Security is enforced by **Row Level Security**: see `supabase/schema.sql` — every row in `watched_movies` is owned by a `user_id`, and the RLS policies restrict reads/writes to the authenticated user's own rows.
- If you change the schema, double-check that RLS is still enabled and the policies still match the access model.

### OAuth redirect whitelist
- In **Supabase → Authentication → URL Configuration**, only list domains you control (e.g. `http://localhost:5173` for dev, your Cloudflare Pages domain for prod). Never add wildcards or third-party domains.

## Dependencies

- Run `npm audit` periodically and update vulnerable packages.
- Major version bumps for `react`, `@supabase/supabase-js`, `vite` should be reviewed before merging.
