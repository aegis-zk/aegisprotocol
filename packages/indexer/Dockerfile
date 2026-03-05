FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy only the packages needed by the indexer
COPY packages/indexer/package.json packages/indexer/
COPY packages/sdk/package.json packages/sdk/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/sdk/ packages/sdk/
COPY packages/indexer/ packages/indexer/
COPY tsconfig.base.json ./

# Build SDK first (dependency), then indexer
RUN pnpm --filter @aegisaudit/sdk build && pnpm --filter @aegisaudit/indexer build

# ── Production image ─────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Copy built output + node_modules
COPY --from=builder /app/packages/indexer/dist/ ./dist/
COPY --from=builder /app/packages/indexer/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/packages/ ./packages/

# Data directory for SQLite persistence
RUN mkdir -p /data
ENV DB_PATH=/data/aegis-indexer.db

ENV PORT=4200
ENV CHAIN_ID=8453
ENV RPC_URL=https://mainnet.base.org
ENV POLL_INTERVAL_MS=5000

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4200/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
