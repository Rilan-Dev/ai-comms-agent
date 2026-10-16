FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY infra/voice-relay/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY infra/voice-relay/src ./src

ENV VOICE_RELAY_PORT=3301
EXPOSE 3301
CMD ["node", "src/server.mjs"]
