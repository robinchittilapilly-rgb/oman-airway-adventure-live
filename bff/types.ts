import type { CabinClass, CurrencyCode, FareBrandId } from "../src/data/omanAirRoutes";
import type { SavedBookingPNR, SindbadTier } from "../src/data/ancillariesAndSeats";
import type { PassengerCounts, PassengerRole } from "../src/lib/ibe-rules";

export type AppLang = "en" | "ar";
export type PointOfSale = "OM" | "AE" | "SA" | "GB" | "EU" | "GLOBAL";

export interface BffErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  traceId: string;
}

export interface BffSessionUser {
  signedIn: boolean;
  memberId?: string;
  memberName?: string;
  sindbadNo?: string;
  tier: SindbadTier;
  miles: number;
  tierPoints: number;
  travelBankOMR: number;
  pos: PointOfSale;
  experimentVariant: "control" | "bundle_highlight_v2";
}

export interface BffSearchRequest {
  tripType: "roundtrip" | "oneway" | "multicity";
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | undefined;
  multiLeg2Origin?: string | undefined;
  multiLeg2Destination?: string | undefined;
  multiLeg2Date?: string | undefined;
  cabin: CabinClass;
  passengers: PassengerCounts;
  promoCode?: string | undefined;
  currency?: CurrencyCode | undefined;
  pos?: PointOfSale | undefined;
  nonStopOnly?: boolean | undefined;
  sortBy?: "price" | "duration" | undefined;
}

export interface BffFlightOffer {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: 0 | 1;
  stopLabel: string;
  aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8";
  hasStudio: boolean;
  seatsRemaining: number;
  codesharePartner?: string | undefined;
  priceMultiplier: number;
}

export interface BffBrandedFareQuote {
  brandId: FareBrandId;
  name: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  rawPricePerPaxOMR: number;
  discountedPricePerPaxOMR: number;
  taxesPerPaxOMR: number;
  earnedMilesPerPax: number;
  checkedBagKg: number;
  cabinBagText: string;
  seatSelection: "paid" | "free";
  changePolicy: "fee" | "reduced" | "free";
  refundPolicy: "none" | "fee" | "free";
  loungeIncluded: boolean;
  fastTrackIncluded: boolean;
  milesUpgradeEligible: boolean;
}

export interface BffSearchResponse {
  searchId: string;
  cached: boolean;
  routeId: string;
  isLongHaul: boolean;
  baggageGenerousRoute: boolean;
  outboundOptions: BffFlightOffer[];
  secondSegmentOptions: BffFlightOffer[];
  calendar: {
    dateISO: string;
    pricesOMR: Record<FareBrandId, number>;
    seatsRemaining: number;
    soldOut: boolean;
  }[];
  brandedFares: BffBrandedFareQuote[];
  promoApplied?: { code: string; discountPct: number; label: string } | undefined;
  experimentVariant: "control" | "bundle_highlight_v2";
  nearbyAlternatives: string[];
}

export interface BffPassengerInput {
  role: PassengerRole;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  passport: string;
  nationality: string;
  email?: string | undefined;
  phone?: string | undefined;
  emergencyName?: string | undefined;
  emergencyPhone?: string | undefined;
  sindbadNo?: string | undefined;
}

export interface BffCartState {
  cartId: string;
  updatedAt: string;
  step: 1 | 2 | 3 | 4;
  search: BffSearchRequest;
  selectedOutboundId: string;
  selectedSecondSegId?: string | undefined;
  selectedBrand: FareBrandId;
  selectedSeatIds: string[];
  selectedBundleIds: string[];
  selectedAncillaryIds: string[];
  selectedMealId: string;
  selectedSsrIds: string[];
  insuranceChoice: "unset" | "yes" | "no";
  passengers: BffPassengerInput[];
  pricing: BffCartPricing;
  contextualOffers: {
    id: string;
    code: string;
    name: string;
    nameAr: string;
    description: string;
    basePriceOMR: number;
    effectivePriceOMR: number;
    waivedReason?: string | undefined;
    badge?: string | undefined;
    extraBagKg?: number | undefined;
    overlayTag?: string | undefined;
  }[];
  baggageSummary: {
    includedKg: number;
    tierBonusKg: number;
    purchasedKg: number;
    totalKg: number;
  };
}

export interface BffCartPricing {
  baseFareOMR: number;
  taxesOMR: number;
  seatsFeeOMR: number;
  bundlesOMR: number;
  directAncillariesOMR: number;
  mealOMR: number;
  insuranceOMR: number;
  ancillariesOMR: number;
  promoDiscountOMR: number;
  totalOMR: number;
  earnedMiles: number;
}

export interface BffCheckoutRequest {
  cartId: string;
  mode: "pay" | "hold";
  holdHours?: 24 | 48 | undefined;
  paymentMethod: "card" | "lpm" | "wallet" | "bnpl" | "miles_cash";
  paymentDetailLabel: string;
  useMilesSplit?: boolean | undefined;
  useTravelBank?: boolean | undefined;
}

export interface BffCheckoutResponse {
  booking: SavedBookingPNR;
  milesUsed: number;
  milesEarned: number;
  travelBankUsedOMR: number;
  finalCashOMR: number;
  session: BffSessionUser;
}

export interface BffHandoffPayload {
  token: string;
  rloc: string;
  flow: "checkin" | "manage";
  expiresAt: string;
}

export type BookingListItem = SavedBookingPNR;
