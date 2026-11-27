import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  BffAuditEntry,
  BffCartState,
  BffCmsState,
  BffHandoffPayload,
  BffSessionUser,
} from "../types";
import type { HouseholdMember, SavedBookingPNR } from "../../src/data/ancillariesAndSeats";
import { INITIAL_SAMPLE_PNRS } from "../../src/data/ancillariesAndSeats";

export type MaybePromise<T> = T | Promise<T>;

export interface BffSessionRecord {
  sessionId: string;
  /** Internal PSS session identifier kept strictly on the server (FR-45). */
  internalPssToken: string;
  authorizedRlocs: string[];
  user: BffSessionUser;
  createdAt: string;
}

export interface SessionAndCartStore {
  readonly backendName: "memory-file" | "postgres";
  getSession(sessionId: string): MaybePromise<BffSessionRecord | null>;
  saveSession(record: BffSessionRecord): MaybePromise<void>;
  getCart(cartId: string): MaybePromise<BffCartState | null>;
  saveCart(cart: BffCartState): MaybePromise<void>;
  deleteCart(cartId: string): MaybePromise<void>;
  getBookings(): MaybePromise<SavedBookingPNR[]>;
  getBooking(rloc: string): MaybePromise<SavedBookingPNR | null>;
  upsertBooking(booking: SavedBookingPNR): MaybePromise<void>;
  getHousehold(memberId?: string): MaybePromise<HouseholdMember[]>;
  setHousehold(members: HouseholdMember[], memberId?: string): MaybePromise<void>;
  getClaimedPnrs(memberId?: string): MaybePromise<string[]>;
  addClaimedPnr(pnr: string, memberId?: string): MaybePromise<void>;
  saveHandoff(payload: BffHandoffPayload): MaybePromise<void>;
  consumeHandoff(token: string): MaybePromise<BffHandoffPayload | null>;
  appendAuditLog(entry: BffAuditEntry): MaybePromise<void>;
  getAuditLogs(limit?: number): MaybePromise<BffAuditEntry[]>;
  getCmsState(): MaybePromise<BffCmsState | null>;
  saveCmsState(state: BffCmsState): MaybePromise<void>;
}

interface PersistedSnapshot {
  sessions: Record<string, BffSessionRecord>;
  carts: Record<string, BffCartState>;
  bookings: SavedBookingPNR[];
  householdByMember: Record<string, HouseholdMember[]>;
  claimedPnrsByMember: Record<string, string[]>;
  handoffs: Record<string, BffHandoffPayload>;
  auditLogs: BffAuditEntry[];
  cmsState: BffCmsState | null;
}

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
 * Local JSON-file / in-memory store for dev, unit tests, and non-DB previews.
 * Production deployments configure DATABASE_URL to use PostgresSessionStore.
 */
export class FileBackedSessionStore implements SessionAndCartStore {
  readonly backendName = "memory-file" as const;
  private state: PersistedSnapshot;

  constructor(private readonly filePath?: string) {
    this.state = this.loadInitial();
  }

  private loadInitial(): PersistedSnapshot {
    if (this.filePath && existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(
          readFileSync(this.filePath, "utf8"),
        ) as Partial<PersistedSnapshot>;
        return {
          sessions: parsed.sessions ?? {},
          carts: parsed.carts ?? {},
          bookings: parsed.bookings ?? [...INITIAL_SAMPLE_PNRS],
          householdByMember: parsed.householdByMember ?? {
            "mem-tariq-01": [...DEFAULT_DEMO_HOUSEHOLD],
          },
          claimedPnrsByMember: parsed.claimedPnrsByMember ?? {},
          handoffs: parsed.handoffs ?? {},
          auditLogs: parsed.auditLogs ?? [],
          cmsState: parsed.cmsState ?? null,
        };
      } catch {
        // Fall through to clean seed state
      }
    }
    return {
      sessions: {},
      carts: {},
      bookings: [...INITIAL_SAMPLE_PNRS],
      householdByMember: { "mem-tariq-01": [...DEFAULT_DEMO_HOUSEHOLD] },
      claimedPnrsByMember: {},
      handoffs: {},
      auditLogs: [],
      cmsState: null,
    };
  }

  private flush() {
    if (!this.filePath) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch {
      // Ignore write failures in read-only runtimes
    }
  }

  getSession(sessionId: string): BffSessionRecord | null {
    return this.state.sessions[sessionId] ?? null;
  }

  saveSession(record: BffSessionRecord): void {
    this.state.sessions[record.sessionId] = record;
    this.flush();
  }

  getCart(cartId: string): BffCartState | null {
    return this.state.carts[cartId] ?? null;
  }

  saveCart(cart: BffCartState): void {
    this.state.carts[cart.cartId] = cart;
    this.flush();
  }

  deleteCart(cartId: string): void {
    delete this.state.carts[cartId];
    this.flush();
  }

  getBookings(): SavedBookingPNR[] {
    return this.state.bookings;
  }

  getBooking(rloc: string): SavedBookingPNR | null {
    const clean = rloc.trim().toUpperCase();
    return this.state.bookings.find((b) => b.rloc.toUpperCase() === clean) ?? null;
  }

  upsertBooking(booking: SavedBookingPNR): void {
    this.state.bookings = [
      booking,
      ...this.state.bookings.filter((b) => b.rloc.toUpperCase() !== booking.rloc.toUpperCase()),
    ];
    this.flush();
  }

  getHousehold(memberId = "anonymous"): HouseholdMember[] {
    return this.state.householdByMember[memberId] ?? [];
  }

  setHousehold(members: HouseholdMember[], memberId = "anonymous"): void {
    this.state.householdByMember[memberId] = members;
    this.flush();
  }

  getClaimedPnrs(memberId = "anonymous"): string[] {
    return this.state.claimedPnrsByMember[memberId] ?? [];
  }

  addClaimedPnr(pnr: string, memberId = "anonymous"): void {
    const current = this.state.claimedPnrsByMember[memberId] ?? [];
    if (!current.includes(pnr)) {
      this.state.claimedPnrsByMember[memberId] = [...current, pnr];
      this.flush();
    }
  }

  saveHandoff(payload: BffHandoffPayload): void {
    this.state.handoffs[payload.token] = payload;
    this.flush();
  }

  consumeHandoff(token: string): BffHandoffPayload | null {
    const found = this.state.handoffs[token];
    if (!found) return null;
    delete this.state.handoffs[token];
    this.flush();
    if (Date.now() > Date.parse(found.expiresAt)) {
      return null;
    }
    return found;
  }

  appendAuditLog(entry: BffAuditEntry): void {
    this.state.auditLogs = [entry, ...this.state.auditLogs].slice(0, 500);
    this.flush();
  }

  getAuditLogs(limit = 50): BffAuditEntry[] {
    return this.state.auditLogs.slice(0, limit);
  }

  getCmsState(): BffCmsState | null {
    return this.state.cmsState;
  }

  saveCmsState(state: BffCmsState): void {
    this.state.cmsState = state;
    this.flush();
  }
}
