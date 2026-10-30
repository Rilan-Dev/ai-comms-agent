FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
WORKDIR /workspace
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps ./apps
COPY packages ./packages
# Operator migration plan/verify runs from the application image; package the
# immutable SQL chain so its checksums can be checked without host bind mounts.
COPY supabase/migrations ./supabase/migrations
# Do not re-resolve dependencies during a release build; reject any lock drift.
RUN pnpm install --frozen-lockfile
ARG ACA_RELEASE_REVISION=unrecorded
ENV ACA_RELEASE_REVISION=${ACA_RELEASE_REVISION}
LABEL org.opencontainers.image.revision=${ACA_RELEASE_REVISION}

FROM base AS web
RUN pnpm --filter @ai-comms-agent/web build
EXPOSE 3000
CMD ["node","apps/web/node_modules/next/dist/bin/next","start","apps/web","-p","3000"]

FROM base AS worker
RUN pnpm --filter @ai-comms-agent/worker build
WORKDIR /workspace/apps/worker
CMD ["node","--import","tsx","src/index.ts"]
