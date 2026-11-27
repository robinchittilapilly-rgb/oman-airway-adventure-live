import { randomUUID } from "node:crypto";
import {
  REDEMPTION_CATALOG,
  RETRO_CLAIMABLE_PNRS,
  type HouseholdMember,
  type SindbadTier,
} from "../../src/data/ancillariesAndSeats";
import { calculateSindbadMiles } from "../../src/lib/ibe-rules";
import type { BffSessionRecord, SessionAndCartStore } from "../stores/sessionStore";

export interface LmsAdapter {
  retroClaim(
    session: BffSessionRecord,
    pnr: string,
  ): Promise<{ milesCredited: number; session: BffSessionRecord }>;
  redeemCatalogItem(
    session: BffSessionRecord,
    itemId: string,
  ): Promise<{ voucherCode: string; session: BffSessionRecord }>;
  getHousehold(memberId?: string): Promise<HouseholdMember[]>;
  getClaimedPnrs(memberId?: string): Promise<string[]>;
  addHouseholdMember(memberId: string, name: string, relation: string): Promise<HouseholdMember[]>;
  removeHouseholdMember(memberId: string, id: string): Promise<HouseholdMember[]>;
  switchTierDemo(session: BffSessionRecord, tier: SindbadTier): Promise<BffSessionRecord>;
}

/**
 * Loyalty Management System (LMS) & CRM adapter via BFF (FR-24, FR-109).
 */
export class MockSindbadLmsAdapter implements LmsAdapter {
  constructor(private readonly store: SessionAndCartStore) {}

  async retroClaim(session: BffSessionRecord, pnr: string) {
    const clean = pnr.trim().toUpperCase();
    if (!session.user.signedIn || !session.user.memberId) {
      throw new Error("ERR_AUTH_REQUIRED");
    }
    const memberId = session.user.memberId;
    const claimed = await this.store.getClaimedPnrs(memberId);
    if (claimed.includes(clean)) {
      throw new Error("ERR_RETRO_NOT_ELIGIBLE");
    }
    const ledgerMatch = RETRO_CLAIMABLE_PNRS[clean];
    const bookingMatch = await this.store.getBooking(clean);
    if (!ledgerMatch && (!bookingMatch || bookingMatch.status !== "CONFIRMED")) {
      throw new Error("ERR_RETRO_NOT_ELIGIBLE");
    }

    const milesCredited = ledgerMatch
      ? ledgerMatch.miles
      : calculateSindbadMiles(bookingMatch!.totalPaidOMR, session.user.tier);

    session.user.miles += milesCredited;
    session.user.tierPoints += Math.round(milesCredited / 80);
    await this.store.addClaimedPnr(clean, memberId);
    await this.store.saveSession(session);
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
    await this.store.saveSession(session);
    return {
      voucherCode: `WY-VCH-${randomUUID().slice(0, 8).toUpperCase()}`,
      session,
    };
  }

  async getHousehold(memberId?: string): Promise<HouseholdMember[]> {
    if (!memberId) return [];
    return this.store.getHousehold(memberId);
  }

  async getClaimedPnrs(memberId?: string): Promise<string[]> {
    if (!memberId) return [];
    return this.store.getClaimedPnrs(memberId);
  }

  async addHouseholdMember(
    memberId: string,
    name: string,
    relation: string,
  ): Promise<HouseholdMember[]> {
    const clean = name.trim();
    if (!clean) throw new Error("ERR_VALIDATION");
    const existing = await this.store.getHousehold(memberId);
    const next: HouseholdMember[] = [
      ...existing,
      {
        id: `hh-${randomUUID().slice(0, 8)}`,
        name: clean,
        relation,
        sindbadNo: `SB-${8000000 + Math.floor(Math.random() * 999999)}`,
        contributedMiles: 1500,
      },
    ];
    await this.store.setHousehold(next, memberId);
    return next;
  }

  async removeHouseholdMember(memberId: string, id: string): Promise<HouseholdMember[]> {
    const existing = await this.store.getHousehold(memberId);
    const next = existing.filter((h) => h.id !== id);
    await this.store.setHousehold(next, memberId);
    return next;
  }

  async switchTierDemo(session: BffSessionRecord, tier: SindbadTier): Promise<BffSessionRecord> {
    session.user.tier = tier;
    session.user.signedIn = true;
    session.user.role = "member";
    session.user.authProvider = "demo";
    session.user.memberId = session.user.memberId ?? "mem-tariq-01";
    session.user.memberName = session.user.memberName ?? "Tariq Al-Balushi";
    session.user.sindbadNo = session.user.sindbadNo ?? "SB-8841209";
    if (session.user.miles === 0) session.user.miles = 68450;
    if (session.user.tierPoints === 0) session.user.tierPoints = 420;
    if (session.user.travelBankOMR === 0) session.user.travelBankOMR = 65;
    await this.store.saveSession(session);
    return session;
  }
}
