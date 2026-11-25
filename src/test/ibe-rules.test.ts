import { describe, expect, it } from "vitest";
import {
  calculateSindbadMiles,
  calculateTotalBaggageKg,
  computeAncillaryPriceOMR,
  computeSeatFeeOMR,
  validateIcaoPassenger,
  validatePassengerMix,
} from "../lib/ibe-rules";
import { OMAN_AIR_20_ROUTES, get30DayFareRepository } from "../data/omanAirRoutes";

describe("Oman Air IBE Business Rules", () => {
  it("enforces max 12 passengers and 1:1 infant-to-adult ratio (FR-3)", () => {
    expect(
      validatePassengerMix({ adults: 8, children: 4, infants: 1, students: 0, seniors: 0, labor: 0 }).valid
    ).toBe(false);
    expect(
      validatePassengerMix({ adults: 1, children: 0, infants: 2, students: 0, seniors: 0, labor: 0 }).valid
    ).toBe(false);
    expect(
      validatePassengerMix({ adults: 2, children: 2, infants: 1, students: 1, seniors: 0, labor: 0 }).valid
    ).toBe(true);
  });

  it("computes spend-based Sindbad miles accurately across tiers (FR-102)", () => {
    expect(calculateSindbadMiles(100, "Blue")).toBe(1040);
    expect(calculateSindbadMiles(100, "Silver")).toBe(1300);
    expect(calculateSindbadMiles(100, "Gold")).toBe(1560);
  });

  it("waives seat and lounge fees for Gold members and Virtual Bundles (FR-44, FR-117)", () => {
    expect(
      computeSeatFeeOMR({ baseSeatPriceOMR: 18, fareBrand: "ECO_SAVER", tier: "Gold", selectedBundleIds: [] }).priceOMR
    ).toBe(0);
    expect(
      computeSeatFeeOMR({ baseSeatPriceOMR: 18, fareBrand: "ECO_SAVER", tier: "Blue", selectedBundleIds: ["BND_COMFORT"] }).priceOMR
    ).toBe(0);
    expect(
      computeAncillaryPriceOMR({ ancillaryId: "LNG_MAJAN", tier: "Gold", selectedBundleIds: [] }).priceOMR
    ).toBe(0);
    expect(
      computeAncillaryPriceOMR({ ancillaryId: "BAG_10", tier: "Blue", selectedBundleIds: ["BND_COMFORT"] }).priceOMR
    ).toBe(0);
  });

  it("calculates total baggage allowance including Sindbad tier bonus (FR-90)", () => {
    const res = calculateTotalBaggageKg({
      fareBrand: "ECO_COMFORT",
      tier: "Gold",
      selectedBundleIds: [],
      selectedAncillaryIds: ["BAG_10"],
    });
    expect(res.totalKg).toBe(45); // 20kg + 15kg Gold + 10kg purchased
  });

  it("validates ICAO passenger names and passport numbers (FR-69)", () => {
    expect(validateIcaoPassenger({ firstName: "Tariq", lastName: "AlBalushi", passport: "OM4928174" }).valid).toBe(true);
    expect(validateIcaoPassenger({ firstName: "T", lastName: "AlBalushi", passport: "123" }).valid).toBe(false);
  });

  it("provides 20 Oman Air routes with 30 days of fare-brand prices", () => {
    expect(OMAN_AIR_20_ROUTES).toHaveLength(20);
    const repo = get30DayFareRepository("MCT-LHR");
    expect(repo).toHaveLength(30);
    expect(repo[0]?.pricesOMR.BIZ_STUDIO).toBeGreaterThan(repo[0]?.pricesOMR.ECO_SAVER ?? 0);
  });
});