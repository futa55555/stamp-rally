  FROM node:24.14.0-bookworm-slim

  RUN apt-get update \
      && apt-get install -y --no-install-recommends openssl ca-certificates \
      && rm -rf /var/lib/apt/lists/*

  RUN npm install --global pnpm@11.25.0

  WORKDIR /workspace

  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY apps/api ./apps/api

  RUN pnpm install --filter api... --frozen-lockfile

  RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm api:generate \
      && pnpm --filter api build

  ENV NODE_ENV=production

  WORKDIR /workspace/apps/api

  USER node

  EXPOSE 3000

  CMD ["pnpm", "start:prod"]