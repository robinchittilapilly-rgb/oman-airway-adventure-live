import { randomBytes } from "node:crypto";
import type { Context, Next } from "hono";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export interface TelemetryTraceRecord {
  traceId: string;
  spanId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  startedAt: string;
}

const tracer = trace.getTracer("oman-air-ibe-bff", "1.0.0");

function reqMethodOrFallback(method: string): string {
  return method || "GET";
}
const MAX_TRACE_RING = 50;
const recentTraces: TelemetryTraceRecord[] = [];
const requestCounters = new Map<string, number>();
let requestDurationSumMs = 0;
let requestCountTotal = 0;
const startedEpochMs = Date.now();

function pushTrace(record: TelemetryTraceRecord): void {
  recentTraces.unshift(record);
  if (recentTraces.length > MAX_TRACE_RING) {
    recentTraces.length = MAX_TRACE_RING;
  }
}

function sendOtlpSpanIfConfigured(record: TelemetryTraceRecord): void {
  const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]?.trim();
  if (!endpoint) return;
  const url = `${endpoint.replace(/\/+$/, "")}/v1/traces`;
  const startMs = new Date(record.startedAt).getTime();
  const startNs = String(startMs * 1_000_000);
  const endNs = String((startMs + record.durationMs) * 1_000_000);
  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: "oman-air-ibe-bff" } }],
        },
        scopeSpans: [
          {
            scope: { name: "oman-air-ibe-bff" },
            spans: [
              {
                traceId: record.traceId,
                spanId: record.spanId,
                name: `${record.method} ${record.path}`,
                kind: 2,
                startTimeUnixNano: startNs,
                endTimeUnixNano: endNs,
                attributes: [
                  { key: "http.method", value: { stringValue: record.method } },
                  { key: "http.target", value: { stringValue: record.path } },
                  { key: "http.status_code", value: { intValue: String(record.statusCode) } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

/**
 * OpenTelemetry root HTTP span middleware + Prometheus counters + trace ring buffer.
 */
export async function telemetryMiddleware(c: Context, next: Next): Promise<Response | void> {
  if (c.req.path === "/metrics") {
    return next();
  }

  const startHr = process.hrtime.bigint();
  const startedAt = new Date().toISOString();
  const span = tracer.startSpan(`${c.req.method} ${c.req.path}`, {
    attributes: {
      "http.method": reqMethodOrFallback(c.req.method),
      "http.target": c.req.path,
    },
  });
  const rawCtx = span.spanContext();
  const traceId =
    rawCtx.traceId && rawCtx.traceId !== "00000000000000000000000000000000"
      ? rawCtx.traceId
      : randomBytes(16).toString("hex");
  const spanId =
    rawCtx.spanId && rawCtx.spanId !== "0000000000000000"
      ? rawCtx.spanId
      : randomBytes(8).toString("hex");
  c.header("X-Trace-Id", traceId);

  try {
    await next();
  } finally {
    const durationMs = Number((process.hrtime.bigint() - startHr) / 1_000_000n);
    const statusCode = c.res?.status ?? 200;
    span.setAttribute("http.status_code", statusCode);
    span.setStatus({
      code: statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    });
    span.end();

    const routeKey = `${c.req.method} ${c.req.path} ${statusCode}`;
    requestCounters.set(routeKey, (requestCounters.get(routeKey) ?? 0) + 1);
    requestDurationSumMs += durationMs;
    requestCountTotal += 1;

    const record: TelemetryTraceRecord = {
      traceId,
      spanId,
      method: c.req.method,
      path: c.req.path,
      statusCode,
      durationMs,
      startedAt,
    };
    pushTrace(record);
    sendOtlpSpanIfConfigured(record);
  }
}

export function getRecentTraces(limit = 20): TelemetryTraceRecord[] {
  return recentTraces.slice(0, Math.max(1, Math.min(limit, MAX_TRACE_RING)));
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    "# HELP bff_http_requests_total Total HTTP requests handled by the Oman Air IBE BFF.",
    "# TYPE bff_http_requests_total counter",
  ];
  for (const [key, count] of requestCounters.entries()) {
    const parts = key.split(" ");
    const method = parts[0] ?? "GET";
    const status = parts[parts.length - 1] ?? "200";
    const route = parts.slice(1, -1).join(" ") || "/";
    lines.push(
      `bff_http_requests_total{method="${method}",route="${route.replace(/"/g, '\\"')}",status="${status}"} ${count}`,
    );
  }
  lines.push(
    "# HELP bff_http_request_duration_ms_sum Sum of HTTP request durations in milliseconds.",
    "# TYPE bff_http_request_duration_ms_sum counter",
    `bff_http_request_duration_ms_sum ${requestDurationSumMs}`,
    "# HELP bff_http_request_duration_ms_count Count of timed HTTP requests.",
    "# TYPE bff_http_request_duration_ms_count counter",
    `bff_http_request_duration_ms_count ${requestCountTotal}`,
    "# HELP bff_uptime_seconds Process uptime in seconds.",
    "# TYPE bff_uptime_seconds gauge",
    `bff_uptime_seconds ${Math.floor((Date.now() - startedEpochMs) / 1000)}`,
  );
  return `${lines.join("\n")}\n`;
}
