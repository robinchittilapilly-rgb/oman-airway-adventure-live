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

export type PassengerRole = "Adult" | "Child" | "Infant" | "Student" | "Senior" | "Labor";

export const MAX_TOTAL_PASSENGERS = 12;

export function getTotalPassengers(counts: PassengerCounts): number {
  return (
    counts.adults +
    counts.children +
    counts.infants +
    counts.students +
    counts.seniors +
    counts.labor
  );
}

/**
 * Expands passenger counts into an ordered list of individual passenger roles (FR-58).
 */
export function expandPassengerTypes(counts: PassengerCounts): PassengerRole[] {
  const roles: PassengerRole[] = [];
  for (let i = 0; i < counts.adults; i++) roles.push("Adult");
  for (let i = 0; i < counts.seniors; i++) roles.push("Senior");
  for (let i = 0; i < counts.students; i++) roles.push("Student");
  for (let i = 0; i < counts.labor; i++) roles.push("Labor");
  for (let i = 0; i < counts.children; i++) roles.push("Child");
  for (let i = 0; i < counts.infants; i++) roles.push("Infant");
  return roles;
}

export function validatePassengerMix(counts: PassengerCounts): { valid: boolean; error?: string } {
  const total = getTotalPassengers(counts);
  const accompanyingAdults = counts.adults + counts.seniors + counts.students + counts.labor;

  if (total < 1) {
    return { valid: false, error: "Select at least 1 passenger." };
  }
  if (total > MAX_TOTAL_PASSENGERS) {
    return {
      valid: false,
      error: `Maximum ${MAX_TOTAL_PASSENGERS} passengers allowed per online booking.`,
    };
  }
  if (accompanyingAdults < 1 && counts.infants > 0) {
    return { valid: false, error: "Infants must travel with an accompanying adult." };
  }
  if (counts.infants > accompanyingAdults) {
    return { valid: false, error: "Each infant must be accompanied by one adult (1:1 ratio)." };
  }
  return { valid: true };
}

/**
 * Validates passenger date of birth against selected passenger category on travel date (FR-58).
 */
export function validatePassengerAgeForType(
  dobISO: string,
  role: PassengerRole,
  travelDateISO: string,
): { valid: boolean; error?: string } {
  if (!dobISO) return { valid: false, error: "Date of birth is required." };
  const dob = new Date(`${dobISO}T00:00:00Z`);
  const ref = new Date(`${travelDateISO}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(ref.getTime()) || dob > ref) {
    return { valid: false, error: "Date of birth must be in the past." };
  }
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const mDiff = ref.getUTCMonth() - dob.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  if (role === "Infant" && age >= 2) {
    return { valid: false, error: "Infant must be under 2 years old on departure date." };
  }
  if (role === "Child" && (age < 2 || age >= 12)) {
    return { valid: false, error: "Child must be between 2 and 11 years old." };
  }
  if (role === "Senior" && age < 60) {
    return { valid: false, error: "Senior fare requires passenger age 60 or older." };
  }
  if ((role === "Adult" || role === "Student" || role === "Labor") && age < 12) {
    return { valid: false, error: `${role} passenger must be at least 12 years old.` };
  }
  return { valid: true };
}

export const PROMO_CODES: Record<string, { discountPct: number; label: string }> = {
  OMAN2026: { discountPct: 15, label: "15% Muscat 2026 Celebration" },
  SINBAD10: { discountPct: 10, label: "10% Sindbad Member Exclusive" },
  GENZ20: { discountPct: 20, label: "20% Youth & Student Explorer" },
};

/**
 * Spend-based Sindbad Miles formula:
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
 * Contextual ancillary eligibility (FR-85): checks longHaulOnly rules.
 */
export function isAncillaryEligibleForRoute(ancillaryId: string, isLongHaul: boolean): boolean {
  const item = DIRECT_ANCILLARIES.find((a) => a.id === ancillaryId);
  if (!item) return false;
  if (item.longHaulOnly && !isLongHaul) return false;
  return true;
}

/**
 * Retailing pricing rule (FR-44, FR-86, FR-117):
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
  const hasSeatBundle = params.selectedBundleIds.some(
    (id) => VIRTUAL_BUNDLES.find((b) => b.id === id)?.waivesSeatFee,
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
  if (!icaoName.test(p.firstName.trim()))
    errors.push("First name must be 2-35 Latin letters (ICAO standard).");
  if (!icaoName.test(p.lastName.trim()))
    errors.push("Last name must be 2-35 Latin letters (ICAO standard).");
  if (!icaoPassport.test(p.passport.trim()))
    errors.push("Passport/ID must be 6-12 alphanumeric characters.");
  return { valid: errors.length === 0, errors };
}

/**
 * Generates a consistent 6-character Oman Air RLOC ('WY' + 4 alphanumeric chars).
 */
export function generateRLOC(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "WY";
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)] ?? "A";
  }
  return out;
}

/**
 * Computes exact Hold My Fare expiry timestamp for 24h or 48h holds (FR-74).
 */
export function computeHoldExpiryISO(holdHours: 24 | 48, fromMs = Date.now()): string {
  return new Date(fromMs + holdHours * 3600 * 1000).toISOString();
}

export function isHoldExpired(holdExpiresAt?: string, nowMs = Date.now()): boolean {
  if (!holdExpiresAt) return false;
  const ts = Date.parse(holdExpiresAt);
  return !Number.isNaN(ts) && ts < nowMs;
}

/**
 * Computes date-exchange fee + fare difference based on brand changePolicy (FR-123).
 */
export function computeExchangeQuote(params: {
  fareBrand: FareBrandId;
  oldFareOMR: number;
  newFareOMR: number;
}): { changeFeeOMR: number; fareDifferenceOMR: number; totalDueOMR: number } {
  const policy = FARE_BRANDS[params.fareBrand].changePolicy;
  const changeFeeOMR = policy === "free" ? 0 : policy === "reduced" ? 12 : 25;
  const fareDifferenceOMR = Math.max(0, Math.round(params.newFareOMR - params.oldFareOMR));
  return {
    changeFeeOMR,
    fareDifferenceOMR,
    totalDueOMR: changeFeeOMR + fareDifferenceOMR,
  };
}

/**
 * Computes refund eligibility and net refundable amount based on fareBrand refundPolicy (FR-124).
 */
export function computeRefundQuote(params: { fareBrand: FareBrandId; totalPaidOMR: number }): {
  cashRefundEligible: boolean;
  cancellationFeeOMR: number;
  cashRefundOMR: number;
  voucherRefundOMR: number;
} {
  const policy = FARE_BRANDS[params.fareBrand].refundPolicy;
  if (policy === "none") {
    // Non-refundable Saver fares cannot refund to original card; Travel Bank retains residual tax credit only.
    const residualTaxCredit = Math.min(params.totalPaidOMR, 18);
    return {
      cashRefundEligible: false,
      cancellationFeeOMR: Math.max(0, params.totalPaidOMR - residualTaxCredit),
      cashRefundOMR: 0,
      voucherRefundOMR: residualTaxCredit,
    };
  }
  const cancellationFeeOMR = policy === "fee" ? Math.min(25, params.totalPaidOMR) : 0;
  const net = Math.max(0, params.totalPaidOMR - cancellationFeeOMR);
  return {
    cashRefundEligible: true,
    cancellationFeeOMR,
    cashRefundOMR: net,
    voucherRefundOMR: net,
  };
}

/**
 * Miles-upgrade rules using fare brand milesUpgradeEligible flag (FR-104).
 */
export function getMilesUpgradeOption(fareBrand: FareBrandId): {
  eligible: boolean;
  targetBrand?: FareBrandId;
  milesRequired: number;
  reason?: string;
} {
  const spec = FARE_BRANDS[fareBrand];
  if (!spec.milesUpgradeEligible) {
    return {
      eligible: false,
      milesRequired: 0,
      reason: `${spec.name} is not eligible for Sindbad Miles upgrades.`,
    };
  }
  if (fareBrand === "ECO_COMFORT" || fareBrand === "ECO_FLEX") {
    return { eligible: true, targetBrand: "BIZ_COMFORT", milesRequired: 24000 };
  }
  if (fareBrand === "BIZ_FLEX") {
    return { eligible: true, targetBrand: "BIZ_STUDIO", milesRequired: 32000 };
  }
  return {
    eligible: false,
    milesRequired: 0,
    reason: "Already booked in highest cabin.",
  };
}

/**
 * Generates a PNR-unique 10-digit IATA digital bag tag number (airline code 0910 for Oman Air WY).
 */
export function generateUniqueBagTagNumber(rloc: string, paxIndex: number): string {
  const clean = rloc.trim().toUpperCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 100000;
  }
  const suffix = String((hash * 7 + paxIndex * 137 + 100000) % 1000000).padStart(6, "0");
  return `0910-${suffix}`;
}

/**
 * Builds an IATA Bar Coded Boarding Pass (BCBP) M1 payload string (FR-133).
 */
export function buildIataBcbpString(params: {
  firstName: string;
  lastName: string;
  rloc: string;
  origin: string;
  destination: string;
  flightNumber: string;
  dateISO: string;
  seat: string;
  seq: number;
}): string {
  const nameField = `${params.lastName}/${params.firstName}`
    .toUpperCase()
    .slice(0, 20)
    .padEnd(20, " ");
  const rlocField = params.rloc.toUpperCase().padEnd(7, " ");
  const flightDigits = params.flightNumber.replace(/\D/g, "").padStart(4, "0");
  const parsedDate = new Date(`${params.dateISO}T12:00:00Z`);
  const startOfYear = new Date(Date.UTC(parsedDate.getUTCFullYear(), 0, 0));
  const julianDay = String(
    Math.max(
      1,
      Math.min(366, Math.floor((parsedDate.getTime() - startOfYear.getTime()) / 86400000)),
    ),
  ).padStart(3, "0");
  const seatField = params.seat.toUpperCase().padStart(4, "0");
  const seqField = String(params.seq).padStart(4, "0");
  return `M1${nameField}E${rlocField}${params.origin}${params.destination}WY ${flightDigits} ${julianDay}Y${seatField} ${seqField}100`;
}
