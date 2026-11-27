import { serve } from "@hono/node-server";
import { createBffApp } from "./app";

const port = Number(process.env["PORT"] ?? 8787);
const app = createBffApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[oman-air-bff] listening on http://0.0.0.0:${info.port}`);
});
