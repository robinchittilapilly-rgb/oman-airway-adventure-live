import {
  REDEMPTION_CATALOG,
  RETRO_CLAIMABLE_PNRS,
  type HouseholdMember,
  type SindbadTier,
} from "../../src/data/ancillariesAndSeats";
import { calculateSindbadMiles } from "../../src/lib/ibe-rules";
import type { SessionAndCartStore, BffSessionRecord } from "../stores/sessionStore";

export interface LmsAdapter {
  retroClaim(session: BffSessionRecord, pnr: string): Promise<{ milesCredited: number; session: BffSessionRecord }>;
  redeemCatalogItem(session: BffSessionRecord, itemId: string): Promise<{ voucherCode: string; session: BffSessionRecord }>;
  getHousehold(): HouseholdMember[];
  addHouseholdMember(name: string, relation: string): HouseholdMember[];
  removeHouseholdMember(id: string): HouseholdMember[];
  switchTierDemo(session: BffSessionRecord, tier: SindbadTier): BffSessionRecord;
}

/**
 * Loyalty Management System (LMS) & CRM adapter via BFF (FR-24, FR-109).
 */
export class MockSindbadLmsAdapter implements LmsAdapter {
  constructor(private readonly store: SessionAndCartStore) {}

  async retroClaim(session: BffSessionRecord, pnr: string) {
    const clean = pnr.trim().toUpperCase();
    if (!session.user.signedIn) {
      throw new Error("ERR_AUTH_REQUIRED");
    }
    if (this.store.getClaimedPnrs().includes(clean)) {
      throw new Error("ERR_RETRO_NOT_ELIGIBLE");
    }
    const ledgerMatch = RETRO_CLAIMABLE_PNRS[clean];
    const bookingMatch = this.store.getBooking(clean);
    if (!ledgerMatch && (!bookingMatch || bookingMatch.status !== "CONFIRMED")) {
      throw new Error("ERR_RETRO_NOT_ELIGIBLE");
    }

    const milesCredited = ledgerMatch
      ? ledgerMatch.miles
      : calculateSindbadMiles(bookingMatch!.totalPaidOMR, session.user.tier);

    session.user.miles += milesCredited;
    session.user.tierPoints += Math.round(milesCredited / 80);
    this.store.addClaimedPnr(clean);
    this.store.saveSession(session);
    return { milesCredited, session };
  }

  async redeemCatalogItem(session: BffSessionRecord, itemId: string) {
    if (!session.user.signedIn) {
      throw new Error("ERR_AUTH_REQUIRED");
    }
    const item = REDEMPTION_CATALOG.find((r) => r.id === itemId);
    if (!item) {
      throw new Error("ERR_VALIDATION");
    }
    if (session.user.miles < item.miles) {
      throw new Error("ERR_INSUFFICIENT_MILES");
    }
    session.user.miles -= item.miles;
    this.store.saveSession(session);
    return {
      voucherCode: `WY-VCH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      session,
    };
  }

  getHousehold(): HouseholdMember[] {
    return this.store.getHousehold();
  }

  addHouseholdMember(name: string, relation: string): HouseholdMember[] {
    const clean = name.trim();
    if (!clean) throw new Error("ERR_VALIDATION");
    const next: HouseholdMember[] = [
      ...this.store.getHousehold(),
      {
        id: `hh-${Date.now()}`,
        name: clean,
        relation,
        sindbadNo: `SB-${Math.floor(8000000 + Math.random() * 999999)}`,
        contributedMiles: 1500,
      },
    ];
    this.store.setHousehold(next);
    return next;
  }

  removeHouseholdMember(id: string): HouseholdMember[] {
    const next = this.store.getHousehold().filter((h) => h.id !== id);
    this.store.setHousehold(next);
    return next;
  }

  switchTierDemo(session: BffSessionRecord, tier: SindbadTier): BffSessionRecord {
    session.user.tier = tier;
    session.user.signedIn = true;
    this.store.saveSession(session);
    return session;
  }
}
