# Oman Air IBE — Decoupled BFF Service

Standalone Experience API / BFF (`Hono` + `@hono/node-server`) implementing `/api/bff/v1/*`.

## Local Development

```bash
npm run bff:dev
npm run dev
```

Default local port: `8787` (`VITE_BFF_URL=http://localhost:8787`).

## Environment Variables

- `PORT` — HTTP listen port (default `8787`; Cloud Run injects `8080`).
- `DATABASE_URL` — PostgreSQL connection string (`PostgresSessionStore` with `pg`; falls back to `FileBackedSessionStore` if unset).
- `REDIS_URL` — Redis TCP URL (`RedisTcpCacheStore` with `ioredis` + distributed rate limiting).
- `REDIS_REST_URL` / `REDIS_REST_TOKEN` — Optional Upstash HTTP Redis backend.
- `CORS_ORIGIN` — Comma-separated allowed origins (defaults to GitHub Pages + localhost).
- `BFF_SESSION_SECRET` — HMAC secret for signing session tokens (required when `NODE_ENV=production`).
- `BFF_ALLOW_DEMO_AUTH` — Explicit dev/demo tier & login toggle (`true` in dev, disabled in prod unless explicitly enabled).
- `BFF_STATE_FILE` — Optional JSON file path when running without `DATABASE_URL`.
- `OIDC_ISSUER_URL` / `OIDC_TOKEN_URL` / `OIDC_CLIENT_ID` — External OAuth2/OIDC + PKCE Identity Provider settings.
- `GEMINI_API_KEY` / `GEMINI_MODEL` — Google Gemini API key (`gemini-2.5-flash` default) for Suhail AI concierge.
