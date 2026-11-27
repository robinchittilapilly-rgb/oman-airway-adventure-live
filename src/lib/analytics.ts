export interface AnalyticsPayload {
  event: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: AnalyticsPayload[];
  }
}

/**
 * GTM / GA4 / Insider e-commerce telemetry bridge (FR-13, L1 Analytics).
 */
export function trackIbeEvent(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event,
      timestamp: new Date().toISOString(),
      airline: "WY",
      ...params,
    });
  } catch {
    // Telemetry must never interrupt booking flows
  }
}
