import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BffCartState, BffHandoffPayload, BffSessionUser } from "../types";
import type { HouseholdMember, SavedBookingPNR } from "../../src/data/ancillariesAndSeats";
import { INITIAL_SAMPLE_PNRS } from "../../src/data/ancillariesAndSeats";

export interface BffSessionRecord {
  sessionId: string;
  /** Internal PSS session identifier kept strictly on the server (FR-45). */
  internalPssToken: string;
  user: BffSessionUser;
  createdAt: string;
}

export interface SessionAndCartStore {
  getSession(sessionId: string): BffSessionRecord | null;
  saveSession(record: BffSessionRecord): void;
  getCart(cartId: string): BffCartState | null;
  saveCart(cart: BffCartState): void;
  deleteCart(cartId: string): void;
  getBookings(): SavedBookingPNR[];
  getBooking(rloc: string): SavedBookingPNR | null;
  upsertBooking(booking: SavedBookingPNR): void;
  getHousehold(): HouseholdMember[];
  setHousehold(members: HouseholdMember[]): void;
  getClaimedPnrs(): string[];
  addClaimedPnr(pnr: string): void;
  saveHandoff(payload: BffHandoffPayload): void;
  consumeHandoff(token: string): BffHandoffPayload | null;
}

interface PersistedSnapshot {
  sessions: Record<string, BffSessionRecord>;
  carts: Record<string, BffCartState>;
  bookings: SavedBookingPNR[];
  household: HouseholdMember[];
  claimedPnrs: string[];
  handoffs: Record<string, BffHandoffPayload>;
}

/**
 * Server-side store for sessions, omnichannel carts, PNRs, and handoff tokens
 * (FR-2, FR-40, FR-49, FR-79, FR-88, FR-109).
 */
export class FileBackedSessionStore implements SessionAndCartStore {
  private state: PersistedSnapshot;

  constructor(private readonly filePath?: string) {
    this.state = this.loadInitial();
  }

  private loadInitial(): PersistedSnapshot {
    if (this.filePath && existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<PersistedSnapshot>;
        return {
          sessions: parsed.sessions ?? {},
          carts: parsed.carts ?? {},
          bookings: parsed.bookings ?? [...INITIAL_SAMPLE_PNRS],
          household: parsed.household ?? [
            { id: "hh-1", name: "Reem Al-Balushi", relation: "Spouse", sindbadNo: "SB-8841210", contributedMiles: 14200 },
            { id: "hh-2", name: "Yusuf Al-Balushi", relation: "Child", sindbadNo: "SB-9100342", contributedMiles: 4850 },
          ],
          claimedPnrs: parsed.claimedPnrs ?? [],
          handoffs: parsed.handoffs ?? {},
        };
      } catch {
        // Fall through to clean seed state
      }
    }
    return {
      sessions: {},
      carts: {},
      bookings: [...INITIAL_SAMPLE_PNRS],
      household: [
        { id: "hh-1", name: "Reem Al-Balushi", relation: "Spouse", sindbadNo: "SB-8841210", contributedMiles: 14200 },
        { id: "hh-2", name: "Yusuf Al-Balushi", relation: "Child", sindbadNo: "SB-9100342", contributedMiles: 4850 },
      ],
      claimedPnrs: [],
      handoffs: {},
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

  getHousehold(): HouseholdMember[] {
    return this.state.household;
  }

  setHousehold(members: HouseholdMember[]): void {
    this.state.household = members;
    this.flush();
  }

  getClaimedPnrs(): string[] {
    return this.state.claimedPnrs;
  }

  addClaimedPnr(pnr: string): void {
    if (!this.state.claimedPnrs.includes(pnr)) {
      this.state.claimedPnrs.push(pnr);
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
    if (Date.now() > Date.parse(found.expiresAt)) {
      delete this.state.handoffs[token];
      this.flush();
      return null;
    }
    return found;
  }
}
