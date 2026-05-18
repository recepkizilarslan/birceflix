# Birceflix — convenience targets. `make` lists them.

.DEFAULT_GOAL := help

## help               Show this help.
help:
	@awk '/^##/ { sub(/^## /, "", $$0); print "  "$$0 }' $(MAKEFILE_LIST)

# -----------------------------------------------------------------------------
# Development (deps in docker, app on host with HMR)
# -----------------------------------------------------------------------------

## db-up              Start the dev DB (+ Adminer on :8081).
db-up:
	docker compose -f docker-compose.dev.yml up -d

## db-down            Stop the dev DB. Volumes are preserved.
db-down:
	docker compose -f docker-compose.dev.yml down

## db-reset           Wipe + recreate the dev DB (data loss).
db-reset:
	docker compose -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.dev.yml up -d

## db-logs            Tail dev DB logs.
db-logs:
	docker compose -f docker-compose.dev.yml logs -f

## migrate            Apply pending SQL migrations.
migrate:
	npm run -w backend db:migrate

## dev                Bring up DB, run migrations, start front+back with HMR.
dev: db-up migrate
	npm run dev

# -----------------------------------------------------------------------------
# Production (full container stack behind Caddy)
# -----------------------------------------------------------------------------

## prod-up            Build + start the full prod stack (Caddy + frontend + api + db).
prod-up:
	docker compose up -d --build

## prod-down          Stop the prod stack.
prod-down:
	docker compose down

## prod-logs          Tail prod logs.
prod-logs:
	docker compose logs -f

## prod-restart       Restart api + frontend (keeps db running).
prod-restart:
	docker compose restart api frontend

# -----------------------------------------------------------------------------
# Misc
# -----------------------------------------------------------------------------

## install            Install workspace deps (npm).
install:
	npm install

## typecheck          tsc on both workspaces.
typecheck:
	npm run typecheck

## lint               eslint on frontend.
lint:
	npm run lint

## build              Build both workspaces.
build:
	npm run build

.PHONY: help db-up db-down db-reset db-logs migrate dev \
        prod-up prod-down prod-logs prod-restart \
        install typecheck lint build
