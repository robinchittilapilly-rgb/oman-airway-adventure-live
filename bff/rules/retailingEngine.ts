import {
  DIRECT_ANCILLARIES,
  MEAL_OPTIONS,
  VIRTUAL_BUNDLES,
  type SeatCell,
  type SindbadTier,
} from "../../src/data/ancillariesAndSeats";
import {
  FARE_BRANDS,
  findRouteForPair,
  get30DayFareRepository,
  type FareBrandId,
} from "../../src/data/omanAirRoutes";
import {
  PROMO_CODES,
  calculateSindbadMiles,
  calculateTotalBaggageKg,
  computeAncillaryPriceOMR,
  computeSeatFeeOMR,
  getTotalPassengers,
  isAncillaryEligibleForRoute,
} from "../../src/lib/ibe-rules";
import type {
  BffBrandedFareQuote,
  BffCartPricing,
  BffCartState,
  BffCmsState,
  BffFlightOffer,
  BffSearchRequest,
  PointOfSale,
} from "../types";

function resolveActivePromos(cmsPromos?: BffCmsState["dynamicPromos"]) {
  const out: Record<string, { discountPct: number; label: string }> = { ...PROMO_CODES };
  if (cmsPromos) {
    for (const [code, spec] of Object.entries(cmsPromos)) {
      if (spec.active)
        out[code.toUpperCase()] = { discountPct: spec.discountPct, label: spec.label };
      else delete out[code.toUpperCase()];
    }
  }
  return out;
}

/**
 * Server-side Retailing & Contextual Upsell Engine (FR-44, FR-85, FR-103, FR-113).
 * Never trusts client-computed prices, tier waivers, or promo totals.
 */
export function buildBrandedFareQuotes(params: {
  search: BffSearchRequest;
  outboundOffer: BffFlightOffer;
  secondSegOffer?: BffFlightOffer | undefined;
  tier: SindbadTier;
  cmsPromos?: BffCmsState["dynamicPromos"] | undefined;
}): {
  quotes: BffBrandedFareQuote[];
  promoApplied?: { code: string; discountPct: number; label: string } | undefined;
} {
  const match = findRouteForPair(params.search.origin, params.search.destination);
  if (!match) return { quotes: [] };

  const repo = get30DayFareRepository(match.route.id);
  const outDay = repo.find((d) => d.dateISO === params.search.departDate) ?? repo[0]!;

  const secondRepo =
    params.search.tripType === "multicity" &&
    params.search.multiLeg2Origin &&
    params.search.multiLeg2Destination
      ? get30DayFareRepository(
          findRouteForPair(params.search.multiLeg2Origin, params.search.multiLeg2Destination)?.route
            .id ?? match.route.id,
        )
      : repo;
  const secondDate =
    params.search.tripType === "roundtrip"
      ? (params.search.returnDate ?? params.search.departDate)
      : (params.search.multiLeg2Date ?? params.search.departDate);
  const secondDay = secondRepo.find((d) => d.dateISO === secondDate) ?? secondRepo[0]!;

  const brandIds: FareBrandId[] =
    params.search.cabin === "studio" && match.route.hasStudio
      ? ["BIZ_COMFORT", "BIZ_FLEX", "BIZ_STUDIO"]
      : params.search.cabin === "business"
        ? match.route.hasStudio
          ? ["BIZ_COMFORT", "BIZ_FLEX", "BIZ_STUDIO"]
          : ["BIZ_COMFORT", "BIZ_FLEX"]
        : ["ECO_SAVER", "ECO_COMFORT", "ECO_FLEX"];

  const promoMap = resolveActivePromos(params.cmsPromos);
  const cleanPromo = params.search.promoCode?.trim().toUpperCase() ?? "";
  const promoSpec = cleanPromo ? promoMap[cleanPromo] : undefined;

  const leg2TaxOMR =
    params.search.tripType === "roundtrip"
      ? match.route.taxesOMR
      : params.search.tripType === "multicity" &&
          params.search.multiLeg2Origin &&
          params.search.multiLeg2Destination
        ? (findRouteForPair(params.search.multiLeg2Origin, params.search.multiLeg2Destination)
            ?.route.taxesOMR ?? 0)
        : 0;

  const quotes: BffBrandedFareQuote[] = brandIds.map((brandId) => {
    const spec = FARE_BRANDS[brandId];
    const outPrice = Math.round(outDay.pricesOMR[brandId] * params.outboundOffer.priceMultiplier);
    const secondPrice =
      params.search.tripType === "oneway"
        ? 0
        : Math.round(secondDay.pricesOMR[brandId] * (params.secondSegOffer?.priceMultiplier ?? 1));
    const rawPricePerPaxOMR = outPrice + secondPrice;
    const discountedPricePerPaxOMR = params.search.awardMode
      ? 0
      : promoSpec
        ? Math.round(rawPricePerPaxOMR * (1 - promoSpec.discountPct / 100))
        : rawPricePerPaxOMR;
    const awardMilesPerPax = Math.max(4500, Math.round(rawPricePerPaxOMR * 120));

    return {
      brandId,
      name: spec.name,
      nameAr: spec.nameAr,
      tagline: spec.tagline,
      taglineAr: spec.taglineAr,
      rawPricePerPaxOMR: params.search.awardMode ? 0 : rawPricePerPaxOMR,
      discountedPricePerPaxOMR,
      ...(params.search.awardMode ? { awardMilesPerPax } : {}),
      taxesPerPaxOMR: match.route.taxesOMR + leg2TaxOMR,
      earnedMilesPerPax: params.search.awardMode
        ? 0
        : calculateSindbadMiles(discountedPricePerPaxOMR, params.tier),
      checkedBagKg: spec.checkedBagKg,
      cabinBagText: spec.cabinBagText,
      seatSelection: spec.seatSelection,
      changePolicy: spec.changePolicy,
      refundPolicy: spec.refundPolicy,
      loungeIncluded: spec.loungeIncluded,
      fastTrackIncluded: spec.fastTrackIncluded,
      milesUpgradeEligible: spec.milesUpgradeEligible,
    };
  });

  return {
    quotes,
    ...(promoSpec && !params.search.awardMode
      ? { promoApplied: { code: cleanPromo, ...promoSpec } }
      : {}),
  };
}

export function evaluateContextualOffers(params: {
  isLongHaul: boolean;
  tier: SindbadTier;
  pos: PointOfSale;
  selectedBundleIds: string[];
  experimentVariant: "control" | "bundle_highlight_v2";
}) {
  return DIRECT_ANCILLARIES.filter((item) =>
    isAncillaryEligibleForRoute(item.id, params.isLongHaul),
  ).map((item) => {
    const pricing = computeAncillaryPriceOMR({
      ancillaryId: item.id,
      tier: params.tier,
      selectedBundleIds: params.selectedBundleIds,
    });
    const overlayDiscount =
      params.pos === "OM" &&
      pricing.priceOMR > 0 &&
      params.experimentVariant === "bundle_highlight_v2"
        ? 1
        : 0;
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      nameAr: item.nameAr,
      description: item.description,
      basePriceOMR: item.priceOMR,
      effectivePriceOMR: Math.max(0, pricing.priceOMR - overlayDiscount),
      waivedReason: pricing.waivedReason,
      badge: item.badge,
      extraBagKg: item.extraBagKg,
      ...(overlayDiscount > 0 ? { overlayTag: "OM BFF Offer (-1 OMR)" } : {}),
    };
  });
}

export function computeServerCartPricing(params: {
  search: BffSearchRequest;
  outboundOffer: BffFlightOffer;
  secondSegOffer?: BffFlightOffer | undefined;
  selectedBrand: FareBrandId;
  selectedSeatIds: string[];
  selectedReturnSeatIds?: string[] | undefined;
  seatMap: SeatCell[];
  returnSeatMap?: SeatCell[] | undefined;
  selectedBundleIds: string[];
  selectedAncillaryIds: string[];
  selectedMealId: string;
  selectedMealByPax?: string[] | undefined;
  insuranceChoice: "unset" | "yes" | "no";
  insuranceUnitOMR: number;
  tier: SindbadTier;
  pos: PointOfSale;
  experimentVariant: "control" | "bundle_highlight_v2";
  cmsPromos?: BffCmsState["dynamicPromos"] | undefined;
}): {
  pricing: BffCartPricing;
  baggageSummary: BffCartState["baggageSummary"];
  contextualOffers: BffCartState["contextualOffers"];
} {
  const totalPax = getTotalPassengers(params.search.passengers);
  const match = findRouteForPair(params.search.origin, params.search.destination);
  const isLongHaul = match?.route.isLongHaul ?? false;

  const { quotes, promoApplied } = buildBrandedFareQuotes({
    search: params.search,
    outboundOffer: params.outboundOffer,
    secondSegOffer: params.secondSegOffer,
    tier: params.tier,
    cmsPromos: params.cmsPromos,
  });
  const activeQuote = quotes.find((q) => q.brandId === params.selectedBrand) ?? quotes[0];

  const baseFareOMR = (activeQuote?.rawPricePerPaxOMR ?? 0) * totalPax;
  const awardMilesRequired = params.search.awardMode
    ? (activeQuote?.awardMilesPerPax ?? 0) * totalPax
    : 0;
  const taxesOMR = (activeQuote?.taxesPerPaxOMR ?? 0) * totalPax;

  const pscOMR = Math.round(taxesOMR * 0.45);
  const yqOMR = Math.round(taxesOMR * 0.35);
  const xtOMR = Math.max(0, taxesOMR - pscOMR - yqOMR);
  const taxBreakdown = [
    { code: "OM", label: "Muscat / Airport Passenger Service Charge", amountOMR: pscOMR },
    { code: "YQ", label: "Carrier Imposed Surcharge", amountOMR: yqOMR },
    { code: "XT", label: "Arrival & Security Taxes", amountOMR: xtOMR },
  ];

  const promoDiscountOMR = promoApplied
    ? Math.round(baseFareOMR * (promoApplied.discountPct / 100))
    : 0;

  const calcSeatFees = (seatIds: string[], map: SeatCell[]) =>
    seatIds.reduce((sum, seatId) => {
      const seat = map.find((s) => s.id === seatId);
      if (!seat) return sum;
      return (
        sum +
        computeSeatFeeOMR({
          baseSeatPriceOMR: seat.priceOMR,
          fareBrand: params.selectedBrand,
          tier: params.tier,
          selectedBundleIds: params.selectedBundleIds,
        }).priceOMR
      );
    }, 0);

  const seatsFeeOMR =
    calcSeatFees(params.selectedSeatIds, params.seatMap) +
    calcSeatFees(params.selectedReturnSeatIds ?? [], params.returnSeatMap ?? params.seatMap);

  const bundlesOMR = params.selectedBundleIds.reduce(
    (sum, id) => sum + (VIRTUAL_BUNDLES.find((b) => b.id === id)?.priceOMR ?? 0) * totalPax,
    0,
  );

  const contextualOffers = evaluateContextualOffers({
    isLongHaul,
    tier: params.tier,
    pos: params.pos,
    selectedBundleIds: params.selectedBundleIds,
    experimentVariant: params.experimentVariant,
  });

  const directAncillariesOMR = params.selectedAncillaryIds.reduce((sum, id) => {
    const offer = contextualOffers.find((o) => o.id === id);
    return sum + (offer?.effectivePriceOMR ?? 0) * totalPax;
  }, 0);

  const mealOMR =
    params.selectedMealByPax && params.selectedMealByPax.length > 0
      ? params.selectedMealByPax.reduce(
          (sum, id) => sum + (MEAL_OPTIONS.find((m) => m.id === id)?.priceOMR ?? 0),
          0,
        )
      : (MEAL_OPTIONS.find((m) => m.id === params.selectedMealId)?.priceOMR ?? 0) * totalPax;

  const insuranceOMR = params.insuranceChoice === "yes" ? params.insuranceUnitOMR * totalPax : 0;
  const ancillariesOMR = seatsFeeOMR + bundlesOMR + directAncillariesOMR + mealOMR + insuranceOMR;

  const totalOMR = Math.max(0, baseFareOMR + taxesOMR + ancillariesOMR - promoDiscountOMR);
  const earnedMiles = params.search.awardMode
    ? calculateSindbadMiles(ancillariesOMR, params.tier)
    : calculateSindbadMiles(
        Math.max(0, baseFareOMR - promoDiscountOMR) + ancillariesOMR,
        params.tier,
      );

  const baggageSummary = calculateTotalBaggageKg({
    fareBrand: params.selectedBrand,
    baggageGenerousRoute: match?.route.baggageGenerousRoute,
    tier: params.tier,
    selectedBundleIds: params.selectedBundleIds,
    selectedAncillaryIds: params.selectedAncillaryIds,
  });

  return {
    pricing: {
      baseFareOMR,
      ...(params.search.awardMode ? { awardMilesRequired } : {}),
      taxesOMR,
      taxBreakdown,
      seatsFeeOMR,
      bundlesOMR,
      directAncillariesOMR,
      mealOMR,
      insuranceOMR,
      ancillariesOMR,
      promoDiscountOMR,
      totalOMR,
      earnedMiles,
    },
    baggageSummary,
    contextualOffers,
  };
}
