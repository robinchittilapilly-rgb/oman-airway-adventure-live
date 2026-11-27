import { randomUUID } from "node:crypto";
import type { SessionAndCartStore } from "../stores/sessionStore";

export async function recordAudit(
  store: SessionAndCartStore,
  params: {
    eventType: string;
    actorSessionId?: string | undefined;
    actorMemberId?: string | undefined;
    resourceId?: string | undefined;
    payload?: Record<string, unknown>;
    traceId?: string | undefined;
  },
): Promise<void> {
  try {
    await store.appendAuditLog({
      id: `aud-${randomUUID().slice(0, 12)}`,
      eventType: params.eventType,
      actorSessionId: params.actorSessionId,
      actorMemberId: params.actorMemberId,
      resourceId: params.resourceId,
      payload: params.payload ?? {},
      traceId: params.traceId ?? `bff-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Audit logging never crashes customer checkout paths
  }
}
