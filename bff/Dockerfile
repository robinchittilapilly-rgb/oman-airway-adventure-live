FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/data ./src/data
COPY src/lib/ibe-rules.ts ./src/lib/ibe-rules.ts
COPY bff ./bff
RUN npx esbuild bff/server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-bff/server.mjs

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-bff ./dist-bff
COPY --from=builder /app/bff/stores/schema.sql ./dist-bff/schema.sql
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist-bff/server.mjs"]
