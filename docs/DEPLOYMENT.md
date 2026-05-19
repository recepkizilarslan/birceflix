# Deployment

How Birceflix gets from a `git push` to a running production server.

If you're running the app on your own box without GitHub Actions, [INSTALL.md](INSTALL.md) covers the manual `docker compose up -d --build` flow. This page is about the automated pipeline.

## Pipeline overview

```
   workflow_dispatch on `main`
              |
              v
  +----------------------+
  |  build-and-push job  |
  |  -------------------- |
  |  build & push:         |
  |    birceflix-frontend  |
  |    birceflix-backend   |
  |  to ghcr.io            |
  +----------------------+
              |
              v
   environment: production
   (requires recepkizilarslan approval)
              |
              v
  +----------------------+
  |     deploy job        |
  |  -------------------- |
  |  ssh in, pull, apply  |
  |  .env from secret,    |
  |  docker login ghcr,   |
  |  compose pull & up    |
  +----------------------+
```

Two GitHub Actions jobs, no merge-on-push trigger. Deployment is intentionally manual via `workflow_dispatch` so a stray push to `main` doesn't roll out automatically.

## Triggering a deploy

1. GitHub > **Actions** > **Deploy**.
2. **Run workflow**. Branch is restricted to `main` by the `production` environment's deployment-branch policy.
3. Optional **image_tag** input. Leave blank to deploy `sha-<short>` of the commit at `main`. Pass an explicit tag to redeploy an older image.
4. Click **Run workflow**.
5. The job pauses for environment approval. You'll get a "Pending review" notification. Approve, deployment proceeds.

## Who can deploy

- `workflow_dispatch` itself requires GitHub `write` access. Today the repo has one collaborator (the owner).
- The `deploy` job uses `environment: production`. That environment requires approval from `recepkizilarslan` before it runs.
- The deployment-branch policy on `production` allows only `main`.

Even if a collaborator gets added later, they can dispatch the workflow but the `deploy` job stays paused until the owner approves.

## Image registry

Images are pushed to GHCR under the repo owner's namespace, with two tags each:

```
ghcr.io/recepkizilarslan/birceflix-frontend:sha-<short>
ghcr.io/recepkizilarslan/birceflix-frontend:latest

ghcr.io/recepkizilarslan/birceflix-backend:sha-<short>
ghcr.io/recepkizilarslan/birceflix-backend:latest
```

`sha-<short>` is the immutable tag the deploy job uses. `latest` is updated for convenience but never referenced by the deploy.

GHCR packages default to private, so the server logs in with the workflow's `GITHUB_TOKEN` to pull them. The token is ephemeral (job-lifetime only) and is never written to disk.

## Server-side rollout

The `deploy` job opens an SSH connection (key in `secrets.DEPLOY_SSH_KEY`) and runs a small bash script in `$DEPLOY_DIR`:

1. `git fetch && git reset --hard origin/main` so the compose files match the build.
2. Renders `.env` from the `APP_ENV` repo secret, plus the two compose-time values `GHCR_OWNER` and `IMAGE_TAG`.
3. `docker login ghcr.io` with the workflow token.
4. `docker compose -f docker-compose.yml -f docker-compose.prod.yml pull` to fetch the freshly-pushed images.
5. `docker compose ... up -d --remove-orphans` to roll over.
6. `docker image prune -f` to reclaim space.

The git checkout uses the `GITHUB_TOKEN` as an inline Authorization header. It never lands in `.git/config`.

## Required GitHub secrets

Settings > Secrets and variables > Actions > **Repository secrets**:

| Secret | Purpose |
|---|---|
| `APP_ENV` | Full contents of `.env` (multi-line). The deploy job writes this to disk on the server. |
| `DEPLOY_HOST` | Hostname or IP of the production server. |
| `DEPLOY_USER` | SSH user. |
| `DEPLOY_PORT` | SSH port. |
| `DEPLOY_SSH_KEY` | Private key authorised on the server. |
| `DEPLOY_DIR` | Absolute path on the server where the repo is checked out. |

`GITHUB_TOKEN` is provided automatically by Actions.

## Rolling back

Re-run the Deploy workflow with the older `image_tag` input. The deploy job pulls that specific tag and rolls the stack onto it. Postgres data lives in a volume, so the rollback only affects the app containers.

If the bad release shipped a schema migration, you may also need a follow-up migration to undo it. The repo's migrator only rolls forward, so plan migrations to be backward-compatible where possible (add columns nullable, deprecate before drop, etc).

## Auto-merging Dependabot patches

Patch-level Dependabot updates auto-merge via `.github/workflows/dependabot-auto-merge.yml`:

- Workflow runs on every PR.
- If `github.actor == 'dependabot[bot]'` and `fetch-metadata` reports `version-update:semver-patch`, the workflow auto-approves and enables auto-merge (squash).
- Minor and major bumps still need a manual review and merge.

Since these PRs run through the standard CI on `main`, the deploy workflow doesn't fire automatically; you still have to dispatch a deploy when you want the patches in production.

## Manual deploy fallback

If the GitHub Actions path is broken, you can roll out from the server directly:

```bash
ssh you@your-server
cd /path/to/birceflix
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

This is the same as the [INSTALL.md](INSTALL.md) path. The CI-built images aren't required; building locally on the server works identically.

## CI workflows summary

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, PR | Lint, typecheck, build both workspaces |
| `build.yml` | push to `main`, PR | Vite + nginx + Fastify + Docker build verification |
| `codeql.yml` | push to `main`, PR, weekly | Static analysis (security-extended query suite) |
| `deploy.yml` | `workflow_dispatch` only | Build, push to GHCR, SSH, rollout |
| `dependabot-auto-merge.yml` | `pull_request_target` | Auto-approve + enable auto-merge for Dependabot patch PRs |

All workflows are in `.github/workflows/`.

## Production environment hardening

In addition to the deploy-time approval:

- The `main` branch has a ruleset (`Main protection`) that requires PR + 1 approval, squash-only merges, conversation resolution, and forbids force-pushes and branch deletion. Admin (the repo owner) can bypass.
- `require_last_push_approval` is intentionally off so the owner can merge their own PRs via bypass without an extra round-trip.
- Dependabot ecosystem coverage is set up in `.github/dependabot.yml` for npm, GitHub Actions, and Docker base images.
