import { describe, expect, it } from "vitest";
import {
  buildIataBcbpString,
  calculateSindbadMiles,
  calculateTotalBaggageKg,
  computeAncillaryPriceOMR,
  computeExchangeQuote,
  computeHoldExpiryISO,
  computeRefundQuote,
  computeSeatFeeOMR,
  expandPassengerTypes,
  generateUniqueBagTagNumber,
  getMilesUpgradeOption,
  isAncillaryEligibleForRoute,
  isHoldExpired,
  validateIcaoPassenger,
  validatePassengerAgeForType,
  validatePassengerMix,
} from "../lib/ibe-rules";
import {
  OMAN_AIR_20_ROUTES,
  generateFlightOptions,
  get30DayFareRepository,
  resolveCityOrAirport,
} from "../data/omanAirRoutes";

describe("Oman Air IBE Business Rules", () => {
  it("enforces max 12 passengers and 1:1 infant-to-adult ratio (FR-3)", () => {
    expect(
      validatePassengerMix({
        adults: 8,
        children: 4,
        infants: 1,
        students: 0,
        seniors: 0,
        labor: 0,
      }).valid,
    ).toBe(false);
    expect(
      validatePassengerMix({
        adults: 1,
        children: 0,
        infants: 2,
        students: 0,
        seniors: 0,
        labor: 0,
      }).valid,
    ).toBe(false);
    expect(
      validatePassengerMix({
        adults: 2,
        children: 2,
        infants: 1,
        students: 1,
        seniors: 0,
        labor: 0,
      }).valid,
    ).toBe(true);
  });

  it("expands passenger roles and validates DOB age against passenger type (FR-58)", () => {
    const roles = expandPassengerTypes({
      adults: 1,
      children: 1,
      infants: 1,
      students: 0,
      seniors: 1,
      labor: 0,
    });
    expect(roles).toEqual(["Adult", "Senior", "Child", "Infant"]);
    expect(validatePassengerAgeForType("2025-10-01", "Infant", "2026-11-25").valid).toBe(true);
    expect(validatePassengerAgeForType("2020-01-01", "Infant", "2026-11-25").valid).toBe(false);
    expect(validatePassengerAgeForType("2018-01-01", "Child", "2026-11-25").valid).toBe(true);
    expect(validatePassengerAgeForType("1960-01-01", "Senior", "2026-11-25").valid).toBe(true);
    expect(validatePassengerAgeForType("1995-01-01", "Senior", "2026-11-25").valid).toBe(false);
  });

  it("computes spend-based Sindbad miles accurately across tiers (FR-102)", () => {
    expect(calculateSindbadMiles(100, "Blue")).toBe(1040);
    expect(calculateSindbadMiles(100, "Silver")).toBe(1300);
    expect(calculateSindbadMiles(100, "Gold")).toBe(1560);
  });

  it("waives seat and lounge fees for Gold members and Virtual Bundles (FR-44, FR-117)", () => {
    expect(
      computeSeatFeeOMR({
        baseSeatPriceOMR: 18,
        fareBrand: "ECO_SAVER",
        tier: "Gold",
        selectedBundleIds: [],
      }).priceOMR,
    ).toBe(0);
    expect(
      computeSeatFeeOMR({
        baseSeatPriceOMR: 18,
        fareBrand: "ECO_SAVER",
        tier: "Blue",
        selectedBundleIds: ["BND_COMFORT"],
      }).priceOMR,
    ).toBe(0);
    expect(
      computeAncillaryPriceOMR({ ancillaryId: "LNG_MAJAN", tier: "Gold", selectedBundleIds: [] })
        .priceOMR,
    ).toBe(0);
    expect(
      computeAncillaryPriceOMR({
        ancillaryId: "BAG_10",
        tier: "Blue",
        selectedBundleIds: ["BND_COMFORT"],
      }).priceOMR,
    ).toBe(0);
  });

  it("calculates total baggage allowance including Sindbad tier bonus (FR-90)", () => {
    const res = calculateTotalBaggageKg({
      fareBrand: "ECO_COMFORT",
      tier: "Gold",
      selectedBundleIds: [],
      selectedAncillaryIds: ["BAG_10"],
    });
    expect(res.totalKg).toBe(45);
  });

  it("validates ICAO passenger names and passport numbers (FR-69)", () => {
    expect(
      validateIcaoPassenger({ firstName: "Tariq", lastName: "AlBalushi", passport: "OM4928174" })
        .valid,
    ).toBe(true);
    expect(
      validateIcaoPassenger({ firstName: "T", lastName: "AlBalushi", passport: "123" }).valid,
    ).toBe(false);
  });

  it("resolves city groups including nearby airports LGW/STN/ORY/AUH/SHJ (FR-55)", () => {
    const lonCodes = resolveCityOrAirport("LON").map((a) => a.code);
    expect(lonCodes).toEqual(expect.arrayContaining(["LHR", "LGW", "STN"]));
    const parCodes = resolveCityOrAirport("PAR").map((a) => a.code);
    expect(parCodes).toEqual(expect.arrayContaining(["CDG", "ORY"]));
  });

  it("evaluates Hold My Fare 24h vs 48h expiry, refund rules, exchange quotes, and miles upgrades", () => {
    const now = Date.UTC(2026, 10, 25, 12, 0, 0);
    const exp48 = computeHoldExpiryISO(48, now);
    expect(Date.parse(exp48) - now).toBe(48 * 3600 * 1000);
    expect(isHoldExpired(exp48, now + 49 * 3600 * 1000)).toBe(true);
    expect(isHoldExpired(exp48, now + 25 * 3600 * 1000)).toBe(false);

    expect(
      computeRefundQuote({ fareBrand: "ECO_SAVER", totalPaidOMR: 120 }).cashRefundEligible,
    ).toBe(false);
    expect(computeRefundQuote({ fareBrand: "ECO_FLEX", totalPaidOMR: 120 }).cashRefundOMR).toBe(
      120,
    );
    expect(
      computeExchangeQuote({ fareBrand: "ECO_FLEX", oldFareOMR: 150, newFareOMR: 180 }).totalDueOMR,
    ).toBe(30);
    expect(getMilesUpgradeOption("ECO_SAVER").eligible).toBe(false);
    expect(getMilesUpgradeOption("ECO_COMFORT").eligible).toBe(true);
    expect(isAncillaryEligibleForRoute("CHAUF_LH", false)).toBe(false);
    expect(isAncillaryEligibleForRoute("CHAUF_LH", true)).toBe(true);
  });

  it("generates PNR-unique bag tags, IATA BCBP strings, and selectable flight options", () => {
    expect(generateUniqueBagTagNumber("WY7K9M", 0)).not.toBe(
      generateUniqueBagTagNumber("WY4D2X", 0),
    );
    const bcbp = buildIataBcbpString({
      firstName: "TARIQ",
      lastName: "ALBALUSHI",
      rloc: "WY7K9M",
      origin: "MCT",
      destination: "LHR",
      flightNumber: "WY 101",
      dateISO: "2026-11-26",
      seat: "14A",
      seq: 1,
    });
    expect(bcbp.startsWith("M1ALBALUSHI/TARIQ")).toBe(true);
    expect(generateFlightOptions("MCT", "LHR", "2026-11-27").length).toBeGreaterThan(1);
    expect(OMAN_AIR_20_ROUTES).toHaveLength(20);
    expect(get30DayFareRepository("MCT-LHR")).toHaveLength(30);
  });
});
