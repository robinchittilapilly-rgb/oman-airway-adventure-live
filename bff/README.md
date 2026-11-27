# Oman Air IBE — Decoupled BFF Service

Standalone Experience API / BFF (`Hono` + `@hono/node-server`) implementing `/api/bff/v1/*`.

## Local Development

```bash
npm run bff:dev
# or run both UI + BFF together:
npm run dev:full
```

Default local port: `8787` (`VITE_BFF_URL=http://localhost:8787`).

## Environment Variables

- `PORT` — HTTP listen port (default `8787`; Cloud Run injects `8080`).
- `CORS_ORIGIN` — Comma-separated allowed origins (defaults to GitHub Pages + localhost).
- `BFF_SESSION_SECRET` — HMAC secret for signing session tokens.
- `BFF_STATE_FILE` — Optional JSON file path for persisting sessions/carts/PNRs across restarts.
- `REDIS_REST_URL` / `REDIS_REST_TOKEN` — Optional Upstash/HTTP Redis backend for `CacheStore`.
