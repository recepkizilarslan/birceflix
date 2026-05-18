# --- build stage ---
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

# --- runtime stage (nginx static server) ---
FROM nginx:1.31-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
