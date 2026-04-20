FROM node:18-alpine AS build
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @sharaga/api build
RUN pnpm deploy --legacy --filter @sharaga/api --prod /prod/api

FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /prod/api ./

EXPOSE 3001
CMD ["node", "dist/index.js"]
