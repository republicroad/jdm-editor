# demo-server: stateless JDM execute/validate over zen-udf (demo only)
# 构建自仓库根：podman build -f apps/demo-server/Dockerfile .
# 注意：zen-udf 为 workspace 源码直通依赖——构建上下文与运行时都需其相对路径
# deps 阶段用 node 镜像（pnpm 需要 node 运行时；oven/bun 无 node/corepack）
FROM node:22-slim AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/demo-server/package.json apps/demo-server/
COPY packages/zen-udf/package.json packages/zen-udf/
RUN npm install -g pnpm@10.34.5 \
  && pnpm install --filter @republicroad/demo-server --filter @republicroad/zen-udf --frozen-lockfile
COPY apps/demo-server apps/demo-server

FROM oven/bun:1
WORKDIR /repo
ENV NODE_ENV=production
# 保持 /repo 相对布局：workspace 符号链接（@republicroad/zen-udf → ../../packages/zen-udf）才能解析
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/demo-server/node_modules ./apps/demo-server/node_modules
# zen-udf 的传递依赖链接（@gorules/zen-engine 等）：pnpm 按导入方建在各自 node_modules
COPY --from=deps /repo/packages/zen-udf/node_modules ./packages/zen-udf/node_modules
COPY --from=deps /repo/apps/demo-server/package.json ./apps/demo-server/
COPY --from=deps /repo/apps/demo-server/src ./apps/demo-server/src
# zen-udf 源码包（main=src/index.ts）：从构建上下文直取清单与源码，避开本地 node_modules/平台二进制
COPY packages/zen-udf/package.json packages/zen-udf/
COPY packages/zen-udf/src ./packages/zen-udf/src
WORKDIR /repo/apps/demo-server
EXPOSE 8787
USER bun
CMD ["bun", "src/main.ts"]
