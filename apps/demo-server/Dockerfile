# demo-server: stateless JDM execute/validate over zen-engine (demo only)
FROM oven/bun:1 AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/demo-server/package.json apps/demo-server/
RUN corepack enable && pnpm install --filter @republicroad/demo-server --frozen-lockfile
COPY apps/demo-server apps/demo-server

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/demo-server/node_modules ./node_modules
COPY --from=deps /repo/apps/demo-server/package.json ./
COPY --from=deps /repo/apps/demo-server/src ./src
EXPOSE 8787
USER bun
CMD ["bun", "src/main.ts"]
