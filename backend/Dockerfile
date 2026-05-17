# --- build stage ---
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend --include-workspace-root

COPY backend ./backend
COPY shared ./shared

WORKDIR /app/backend
RUN npm run build

# Drop devDependencies for the runtime image
RUN npm prune --omit=dev

# --- runtime stage ---
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Copy only what we need to run. With npm workspaces, all dependencies are
# hoisted to the root /app/node_modules — there's no backend/node_modules.
# Node's module resolution walks upward from /app/backend, so this works.
COPY --from=build /app/backend/dist ./backend/dist
# migrate.js reads ./migrations relative to its own dir (dist/db); put SQL there
COPY --from=build /app/backend/src/db/migrations ./backend/dist/db/migrations
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
