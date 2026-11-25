import { FARE_BRANDS, type FareBrandId } from "../data/omanAirRoutes";
import { DIRECT_ANCILLARIES, VIRTUAL_BUNDLES, type SindbadTier } from "../data/ancillariesAndSeats";

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
  students: number;
  seniors: number;
  labor: number;
}

export const MAX_TOTAL_PASSENGERS = 12;

export function getTotalPassengers(counts: PassengerCounts): number {
  return counts.adults + counts.children + counts.infants + counts.students + counts.seniors + counts.labor;
}

export function validatePassengerMix(counts: PassengerCounts): { valid: boolean; error?: string } {
  const total = getTotalPassengers(counts);
  const accompanyingAdults = counts.adults + counts.seniors + counts.students + counts.labor;

  if (total < 1) {
    return { valid: false, error: "Select at least 1 passenger." };
  }
  if (total > MAX_TOTAL_PASSENGERS) {
    return { valid: false, error: `Maximum ${MAX_TOTAL_PASSENGERS} passengers allowed per online booking.` };
  }
  if (accompanyingAdults < 1 && counts.infants > 0) {
    return { valid: false, error: "Infants must travel with an accompanying adult." };
  }
  if (counts.infants > accompanyingAdults) {
    return { valid: false, error: "Each infant must be accompanied by one adult (1:1 ratio)." };
  }
  return { valid: true };
}

export const PROMO_CODES: Record<string, { discountPct: number; label: string }> = {
  OMAN2026: { discountPct: 15, label: "15% Muscat 2026 Celebration" },
  SINBAD10: { discountPct: 10, label: "10% Sindbad Member Exclusive" },
  GENZ20: { discountPct: 20, label: "20% Youth & Student Explorer" },
};

/**
 * Spend-based Sindbad Miles formula (official Oman Air rule):
 * Blue = 4 miles/USD, Silver = 5 miles/USD, Gold = 6 miles/USD on base airfare + add-ons (excluding taxes).
 */
export function calculateSindbadMiles(eligibleSpendOMR: number, tier: SindbadTier): number {
  const usdEquivalent = eligibleSpendOMR * 2.6;
  const multiplier = tier === "Gold" ? 6 : tier === "Silver" ? 5 : 4;
  return Math.round(usdEquivalent * multiplier);
}

/**
 * Baggage calculator (FR-90): included brand bag + Sindbad tier bonus + purchased extra bag.
 */
export function calculateTotalBaggageKg(params: {
  fareBrand: FareBrandId;
  baggageGenerousRoute?: boolean | undefined;
  tier: SindbadTier;
  selectedBundleIds: string[];
  selectedAncillaryIds: string[];
}): { includedKg: number; tierBonusKg: number; purchasedKg: number; totalKg: number } {
  const brand = FARE_BRANDS[params.fareBrand];
  const includedKg =
    brand.cabin === "economy" && params.baggageGenerousRoute
      ? brand.checkedBagKg + (brand.id === "ECO_SAVER" ? 20 : 10)
      : brand.checkedBagKg;

  const tierBonusKg = params.tier === "Gold" ? 15 : params.tier === "Silver" ? 10 : 0;

  let purchasedKg = 0;
  for (const id of params.selectedBundleIds) {
    const b = VIRTUAL_BUNDLES.find((x) => x.id === id);
    if (b?.extraBagKg) purchasedKg += b.extraBagKg;
  }
  for (const id of params.selectedAncillaryIds) {
    const a = DIRECT_ANCILLARIES.find((x) => x.id === id);
    if (a?.extraBagKg) purchasedKg += a.extraBagKg;
  }

  return {
    includedKg,
    tierBonusKg,
    purchasedKg,
    totalKg: includedKg + tierBonusKg + purchasedKg,
  };
}

/**
 * BFF Retailing pricing rule (FR-44, FR-86, FR-117):
 * - Gold members get complimentary seat fees & Majan Lounge / Fast Track / Priority Boarding.
 * - Selecting a Virtual Bundle automatically waives individual fees for included seats & ancillaries.
 */
export function computeAncillaryPriceOMR(params: {
  ancillaryId: string;
  tier: SindbadTier;
  selectedBundleIds: string[];
}): { priceOMR: number; waivedReason?: string } {
  const item = DIRECT_ANCILLARIES.find((a) => a.id === params.ancillaryId);
  if (!item) return { priceOMR: 0 };

  for (const bId of params.selectedBundleIds) {
    const bundle = VIRTUAL_BUNDLES.find((b) => b.id === bId);
    if (bundle?.waivesIds?.includes(item.id)) {
      return { priceOMR: 0, waivedReason: `Included in ${bundle.name}` };
    }
  }
  if (params.tier === "Gold" && item.goldComplimentary) {
    return { priceOMR: 0, waivedReason: "Complimentary for Sindbad Gold" };
  }
  if (params.tier === "Silver" && item.silverComplimentary) {
    return { priceOMR: 0, waivedReason: "Complimentary for Sindbad Silver" };
  }
  return { priceOMR: item.priceOMR };
}

export function computeSeatFeeOMR(params: {
  baseSeatPriceOMR: number;
  fareBrand: FareBrandId;
  tier: SindbadTier;
  selectedBundleIds: string[];
}): { priceOMR: number; waivedReason?: string } {
  if (params.baseSeatPriceOMR === 0) return { priceOMR: 0 };
  if (FARE_BRANDS[params.fareBrand].seatSelection === "free") {
    return { priceOMR: 0, waivedReason: `Included in ${FARE_BRANDS[params.fareBrand].name}` };
  }
  if (params.tier === "Gold") {
    return { priceOMR: 0, waivedReason: "Waived for Sindbad Gold" };
  }
  const hasSeatBundle = params.selectedBundleIds.some((id) =>
    VIRTUAL_BUNDLES.find((b) => b.id === id)?.waivesSeatFee
  );
  if (hasSeatBundle) {
    return { priceOMR: 0, waivedReason: "Included in Virtual Bundle" };
  }
  return { priceOMR: params.baseSeatPriceOMR };
}

export function validateIcaoPassenger(p: {
  firstName: string;
  lastName: string;
  passport: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const icaoName = /^[A-Za-z\s'-]{2,35}$/;
  const icaoPassport = /^[A-Za-z0-9]{6,12}$/;
  if (!icaoName.test(p.firstName.trim())) errors.push("First name must be 2-35 Latin letters (ICAO standard).");
  if (!icaoName.test(p.lastName.trim())) errors.push("Last name must be 2-35 Latin letters (ICAO standard).");
  if (!icaoPassport.test(p.passport.trim())) errors.push("Passport/ID must be 6-12 alphanumeric characters.");
  return { valid: errors.length === 0, errors };
}