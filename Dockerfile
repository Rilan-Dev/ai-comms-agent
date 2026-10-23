FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
WORKDIR /workspace
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
# Do not re-resolve dependencies during a release build; reject any lock drift.
RUN pnpm install --frozen-lockfile

FROM base AS web
RUN pnpm --filter @ai-comms-agent/web build
EXPOSE 3000
CMD ["pnpm","--filter","@ai-comms-agent/web","start"]

FROM base AS worker
RUN pnpm --filter @ai-comms-agent/worker build
CMD ["pnpm","--filter","@ai-comms-agent/worker","start"]
