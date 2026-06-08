# --- build stage: compile the Vite frontend ---
FROM node:26-alpine AS build

WORKDIR /app

# Copy lockfile + manifests for cached install
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
RUN npm ci --workspace=frontend --include-workspace-root

# Copy frontend source
COPY frontend ./frontend
COPY shared ./shared

# Build
WORKDIR /app/frontend
RUN npm run build

# --- runtime: Caddy serves the static build and reverse-proxies /api ---
FROM caddy:2-alpine AS runtime

# The Vite build is baked into the image; Caddy serves it from /srv.
# There is no separate nginx layer anymore; Caddy is the only web tier.
COPY --from=build /app/frontend/dist /srv

# The Caddyfile is provided at runtime via a bind mount (see the compose
# files) so it can differ per environment: Caddyfile (prod, auto-HTTPS)
# vs Caddyfile.local (dev, http-only).
EXPOSE 80 443
