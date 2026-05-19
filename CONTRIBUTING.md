# Contributing to Birceflix

Thanks for taking the time. Birceflix is a small personal project, but bug fixes, small features, and doc improvements are welcome.

## Before you start

- Bug reports and feature requests: [Issues](https://github.com/recepkizilarslan/birceflix/issues).
- Security issues: do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).
- Set up your dev environment: [docs/QUICKSTART.md](docs/QUICKSTART.md) for the five-minute version, [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the deep walkthrough.

## Branch naming

- `feat/<short-name>` for new features.
- `fix/<short-name>` for bug fixes.
- `docs/<short-name>` for documentation changes.
- `chore/<short-name>` for build, deps, CI, refactors.
- `ci/<short-name>` for GitHub Actions / pipeline changes.

Keep names lowercase, hyphen-separated, and tight (`feat/import-letterboxd`, not `feat/add-the-ability-to-import-letterboxd-history`).

## Commit style

The repo uses [Conventional Commits](https://www.conventionalcommits.org/) loosely:

```
<type>(<scope>): <short summary>

<optional body>
```

Examples from the log:

- `feat(tv): show-level watched + watchlist (same UX as movies)`
- `fix(pwa): auto-activate waiting service worker so login/logout reloads pick up the new build`
- `docs: add status badges to README`
- `ci: add CodeQL analysis workflow`

A few rules:

- First line stays under ~72 chars.
- Body explains the *why*, not the *what*. The diff already shows what changed.
- No `Co-Authored-By` trailers on commits.

## PR process

1. Fork (or branch off `main` if you have write access).
2. Keep the diff focused. One logical change per PR.
3. Update docs if you changed behaviour, setup, or env vars.
4. Run the lint + typecheck + build trifecta locally:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

5. Open a PR with a short description: what changed and why. CI runs the same checks.
6. Address review comments by pushing follow-up commits (don't force-push during review unless asked).

The `main` branch is protected: PR + 1 approval, squash-only merge, conversation resolution required, no force-push. Patch-level Dependabot PRs auto-merge.

## Code style

Full breakdown lives in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#code-style). The high points:

- TypeScript everywhere, strict mode on.
- React 19, hooks only. No class components.
- Tailwind v4 in JSX; avoid extra CSS files unless they hold tokens.
- Backend is ESM with `.js` import extensions on `.ts` files (TS+ESM convention).
- Routes validate input with `zod`.
- All DB access goes through Drizzle.
- Comments are reserved for the *why* of non-obvious decisions, not running commentary.
- Prefer editing existing files over creating new ones.
- No em-dash characters (U+2014) in documentation or comments. Use commas, colons, parentheses, or rewrite.

## Visual identity

Birceflix's identity is intentionally distinct from streaming-service brands (see the [Notice](README.md#notice) in the README). When you touch icons, themes, or the logo:

- Don't adopt Netflix's exact red (`#E50914`). The project uses `#FF3B47`.
- Don't use Impact / Arial Black / condensed-display wordmarks. The project uses Inter.

## Migrations

Schema and migrations follow a hand-written SQL workflow. The mechanics are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#database-migrations). When your PR adds a column or table:

1. Add `backend/src/db/migrations/000N_short_name.sql`.
2. Update `backend/src/db/schema.ts` to match.
3. Run `npm run -w backend db:migrate` locally to confirm.
4. Make the migration backward-compatible if you can (add columns nullable, deprecate before drop). The migrator only rolls forward.

## Deploys

Deploys are manual via `workflow_dispatch` and gated by the `production` environment. The owner is the only reviewer. Mechanics: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
