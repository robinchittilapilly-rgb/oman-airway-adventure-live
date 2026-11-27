import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  INITIAL_SAMPLE_PNRS,
  type HouseholdMember,
  type SavedBookingPNR,
} from "../../src/data/ancillariesAndSeats";
import type { BffAuditEntry, BffCartState, BffCmsState, BffHandoffPayload } from "../types";
import type { BffSessionRecord, SessionAndCartStore } from "./sessionStore";

const EMBEDDED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ibe_sessions (
  session_id TEXT PRIMARY KEY,
  internal_pss_token TEXT NOT NULL,
  authorized_rlocs JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ibe_carts (
  cart_id TEXT PRIMARY KEY,
  owner_session_id TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibe_carts_owner ON ibe_carts (owner_session_id);
CREATE TABLE IF NOT EXISTS ibe_bookings (
  rloc TEXT PRIMARY KEY,
  owner_session_id TEXT,
  owner_member_id TEXT,
  status TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibe_bookings_member ON ibe_bookings (owner_member_id);
CREATE INDEX IF NOT EXISTS idx_ibe_bookings_session ON ibe_bookings (owner_session_id);
CREATE TABLE IF NOT EXISTS ibe_loyalty_members (
  member_id TEXT PRIMARY KEY,
  household_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  claimed_pnrs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ibe_handoffs (
  token TEXT PRIMARY KEY,
  rloc TEXT NOT NULL,
  flow TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS ibe_cms_state (
  id TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ibe_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_session_id TEXT,
  actor_member_id TEXT,
  resource_id TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  trace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibe_audit_created ON ibe_audit_logs (created_at DESC);
`;

const DEFAULT_DEMO_HOUSEHOLD: HouseholdMember[] = [
  {
    id: "hh-1",
    name: "Reem Al-Balushi",
    relation: "Spouse",
    sindbadNo: "SB-8841210",
    contributedMiles: 14200,
  },
  {
    id: "hh-2",
    name: "Yusuf Al-Balushi",
    relation: "Child",
    sindbadNo: "SB-9100342",
    contributedMiles: 4850,
  },
];

/**
 * Production PostgreSQL persistence adapter for multi-replica Cloud Run / Azure Kubernetes
 * deployments (FR-40, L2 Data & State Stores). Activated automatically when DATABASE_URL is set.
 */
export class PostgresSessionStore implements SessionAndCartStore {
  readonly backendName = "postgres" as const;
  private readonly pool: Pool;
  private readyPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env["PG_POOL_MAX"] ?? 10),
    });
  }

  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.bootstrap();
    }
    return this.readyPromise;
  }

  private async bootstrap(): Promise<void> {
    const dir = dirname(fileURLToPath(import.meta.url));
    const schemaPath = join(dir, "schema.sql");
    const schemaSql = existsSync(schemaPath)
      ? readFileSync(schemaPath, "utf8")
      : EMBEDDED_SCHEMA_SQL;
    await this.pool.query(schemaSql);

    // Seed sample demo PNRs & Tariq household idempotently if empty
    const { rows } = await this.pool.query<{ cnt: string }>(
      "SELECT COUNT(*)::text AS cnt FROM ibe_bookings",
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      for (const b of INITIAL_SAMPLE_PNRS) {
        await this.pool.query(
          `INSERT INTO ibe_bookings (rloc, owner_session_id, owner_member_id, status, payload_json)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (rloc) DO NOTHING`,
          [b.rloc, b.ownerSessionId ?? null, b.ownerMemberId ?? null, b.status, JSON.stringify(b)],
        );
      }
      await this.pool.query(
        `INSERT INTO ibe_loyalty_members (member_id, household_json, claimed_pnrs_json)
         VALUES ($1, $2, '[]'::jsonb) ON CONFLICT (member_id) DO NOTHING`,
        ["mem-tariq-01", JSON.stringify(DEFAULT_DEMO_HOUSEHOLD)],
      );
    }
  }

  async getSession(sessionId: string): Promise<BffSessionRecord | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{
      session_id: string;
      internal_pss_token: string;
      authorized_rlocs: string[];
      user_json: BffSessionRecord["user"];
      created_at: Date;
    }>(
      "SELECT session_id, internal_pss_token, authorized_rlocs, user_json, created_at FROM ibe_sessions WHERE session_id = $1",
      [sessionId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      sessionId: row.session_id,
      internalPssToken: row.internal_pss_token,
      authorizedRlocs: Array.isArray(row.authorized_rlocs) ? row.authorized_rlocs : [],
      user: row.user_json,
      createdAt: row.created_at.toISOString(),
    };
  }

  async saveSession(record: BffSessionRecord): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO ibe_sessions (session_id, internal_pss_token, authorized_rlocs, user_json, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::timestamptz, NOW())
       ON CONFLICT (session_id) DO UPDATE SET
         authorized_rlocs = EXCLUDED.authorized_rlocs,
         user_json = EXCLUDED.user_json,
         updated_at = NOW()`,
      [
        record.sessionId,
        record.internalPssToken,
        JSON.stringify(record.authorizedRlocs),
        JSON.stringify(record.user),
        record.createdAt,
      ],
    );
  }

  async getCart(cartId: string): Promise<BffCartState | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{ payload_json: BffCartState }>(
      "SELECT payload_json FROM ibe_carts WHERE cart_id = $1",
      [cartId],
    );
    return rows[0]?.payload_json ?? null;
  }

  async saveCart(cart: BffCartState): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO ibe_carts (cart_id, owner_session_id, payload_json, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (cart_id) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = NOW()`,
      [cart.cartId, cart.ownerSessionId ?? "anonymous", JSON.stringify(cart)],
    );
  }

  async deleteCart(cartId: string): Promise<void> {
    await this.ensureReady();
    await this.pool.query("DELETE FROM ibe_carts WHERE cart_id = $1", [cartId]);
  }

  async getBookings(): Promise<SavedBookingPNR[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{ payload_json: SavedBookingPNR }>(
      "SELECT payload_json FROM ibe_bookings ORDER BY updated_at DESC",
    );
    return rows.map((r) => r.payload_json);
  }

  async getBooking(rloc: string): Promise<SavedBookingPNR | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{ payload_json: SavedBookingPNR }>(
      "SELECT payload_json FROM ibe_bookings WHERE rloc = $1",
      [rloc.trim().toUpperCase()],
    );
    return rows[0]?.payload_json ?? null;
  }

  async upsertBooking(booking: SavedBookingPNR): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO ibe_bookings (rloc, owner_session_id, owner_member_id, status, payload_json, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (rloc) DO UPDATE SET
         owner_session_id = COALESCE(EXCLUDED.owner_session_id, ibe_bookings.owner_session_id),
         owner_member_id = COALESCE(EXCLUDED.owner_member_id, ibe_bookings.owner_member_id),
         status = EXCLUDED.status,
         payload_json = EXCLUDED.payload_json,
         updated_at = NOW()`,
      [
        booking.rloc.toUpperCase(),
        booking.ownerSessionId ?? null,
        booking.ownerMemberId ?? null,
        booking.status,
        JSON.stringify(booking),
      ],
    );
  }

  async getHousehold(memberId = "anonymous"): Promise<HouseholdMember[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{ household_json: HouseholdMember[] }>(
      "SELECT household_json FROM ibe_loyalty_members WHERE member_id = $1",
      [memberId],
    );
    return rows[0]?.household_json ?? [];
  }

  async setHousehold(members: HouseholdMember[], memberId = "anonymous"): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO ibe_loyalty_members (member_id, household_json, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (member_id) DO UPDATE SET household_json = EXCLUDED.household_json, updated_at = NOW()`,
      [memberId, JSON.stringify(members)],
    );
  }

  async getClaimedPnrs(memberId = "anonymous"): Promise<string[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{ claimed_pnrs_json: string[] }>(
      "SELECT claimed_pnrs_json FROM ibe_loyalty_members WHERE member_id = $1",
      [memberId],
    );
    return rows[0]?.claimed_pnrs_json ?? [];
  }

  async addClaimedPnr(pnr: string, memberId = "anonymous"): Promise<void> {
    await this.ensureReady();
    const existing = await this.getClaimedPnrs(memberId);
    if (existing.includes(pnr)) return;
    await this.pool.query(
      `INSERT INTO ibe_loyalty_members (member_id, claimed_pnrs_json, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (member_id) DO UPDATE SET claimed_pnrs_json = EXCLUDED.claimed_pnrs_json, updated_at = NOW()`,
      [memberId, JSON.stringify([...existing, pnr])],
    );
  }

  async saveHandoff(payload: BffHandoffPayload): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      "INSERT INTO ibe_handoffs (token, rloc, flow, expires_at) VALUES ($1, $2, $3, $4::timestamptz)",
      [payload.token, payload.rloc, payload.flow, payload.expiresAt],
    );
  }

  async consumeHandoff(token: string): Promise<BffHandoffPayload | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{
      token: string;
      rloc: string;
      flow: "checkin" | "manage";
      expires_at: Date;
    }>("DELETE FROM ibe_handoffs WHERE token = $1 RETURNING token, rloc, flow, expires_at", [
      token,
    ]);
    const row = rows[0];
    if (!row || Date.now() > row.expires_at.getTime()) return null;
    return {
      token: row.token,
      rloc: row.rloc,
      flow: row.flow,
      expiresAt: row.expires_at.toISOString(),
    };
  }

  async appendAuditLog(entry: BffAuditEntry): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO ibe_audit_logs (id, event_type, actor_session_id, actor_member_id, resource_id, payload_json, trace_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)`,
      [
        entry.id,
        entry.eventType,
        entry.actorSessionId ?? null,
        entry.actorMemberId ?? null,
        entry.resourceId ?? null,
        JSON.stringify(entry.payload),
        entry.traceId,
        entry.createdAt,
      ],
    );
  }

  async getAuditLogs(limit = 50): Promise<BffAuditEntry[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{
      id: string;
      event_type: string;
      actor_session_id: string | null;
      actor_member_id: string | null;
      resource_id: string | null;
      payload_json: Record<string, unknown>;
      trace_id: string;
      created_at: Date;
    }>(
      "SELECT id, event_type, actor_session_id, actor_member_id, resource_id, payload_json, trace_id, created_at FROM ibe_audit_logs ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      actorSessionId: r.actor_session_id ?? undefined,
      actorMemberId: r.actor_member_id ?? undefined,
      resourceId: r.resource_id ?? undefined,
      payload: r.payload_json,
      traceId: r.trace_id,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async getCmsState(): Promise<BffCmsState | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query<{ state_json: BffCmsState }>(
      "SELECT state_json FROM ibe_cms_state WHERE id = 'default'",
    );
    return rows[0]?.state_json ?? null;
  }

  async saveCmsState(state: BffCmsState): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO ibe_cms_state (id, state_json, updated_at)
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()`,
      [JSON.stringify(state)],
    );
  }
}
