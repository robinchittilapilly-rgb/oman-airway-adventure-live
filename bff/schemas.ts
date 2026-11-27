import { z } from "zod";

const fareBrandEnum = z.enum([
  "ECO_SAVER",
  "ECO_COMFORT",
  "ECO_FLEX",
  "BIZ_COMFORT",
  "BIZ_FLEX",
  "BIZ_STUDIO",
]);

const paxRoleEnum = z.enum(["Adult", "Child", "Infant", "Student", "Senior", "Labor"]);

const paymentMethodEnum = z.enum(["card", "lpm", "wallet", "bnpl", "miles_cash"]);

export const searchSchema = z.object({
  tripType: z.enum(["roundtrip", "oneway", "multicity"]),
  origin: z.string().trim().min(3).max(4),
  destination: z.string().trim().min(3).max(4),
  departDate: z.string().trim().min(8).max(16),
  returnDate: z.string().trim().optional(),
  multiLeg2Origin: z.string().trim().optional(),
  multiLeg2Destination: z.string().trim().optional(),
  multiLeg2Date: z.string().trim().optional(),
  cabin: z.enum(["economy", "business", "studio"]),
  awardMode: z.boolean().optional(),
  passengers: z.object({
    adults: z.number().int().min(0).max(12),
    children: z.number().int().min(0).max(12),
    infants: z.number().int().min(0).max(12),
    students: z.number().int().min(0).max(12),
    seniors: z.number().int().min(0).max(12),
    labor: z.number().int().min(0).max(12),
  }),
  promoCode: z.string().trim().max(32).optional(),
  currency: z.enum(["OMR", "USD", "AED", "SAR", "EUR", "GBP"]).optional(),
  pos: z.enum(["OM", "AE", "SA", "GB", "EU", "GLOBAL"]).optional(),
  nonStopOnly: z.boolean().optional(),
  sortBy: z.enum(["price", "duration"]).optional(),
});

export const passengerInputSchema = z.object({
  role: paxRoleEnum,
  firstName: z.string().trim().max(40),
  lastName: z.string().trim().max(40),
  dob: z.string().trim().max(20),
  gender: z.string().trim().min(1).max(8),
  passport: z.string().trim().max(20),
  passportExpiry: z.string().trim().max(20).optional(),
  issuingCountry: z.string().trim().max(64).optional(),
  nationality: z.string().trim().max(64),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  emergencyName: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  sindbadNo: z.string().trim().max(32).optional(),
});

export const cartUpsertSchema = z.object({
  cartId: z.string().trim().min(4).max(80).optional(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  search: searchSchema,
  selectedOutboundId: z.string().trim().min(1).max(64),
  selectedSecondSegId: z.string().trim().max(64).optional(),
  selectedBrand: fareBrandEnum,
  selectedSeatIds: z.array(z.string().trim().max(10)).max(24).optional(),
  selectedReturnSeatIds: z.array(z.string().trim().max(10)).max(24).optional(),
  selectedBundleIds: z.array(z.string().trim().max(32)).max(10).optional(),
  selectedAncillaryIds: z.array(z.string().trim().max(32)).max(20).optional(),
  selectedMealId: z.string().trim().max(32).optional(),
  selectedMealByPax: z.array(z.string().trim().max(32)).max(12).optional(),
  selectedSsrIds: z.array(z.string().trim().max(32)).max(12).optional(),
  insuranceChoice: z.enum(["unset", "yes", "no"]).optional(),
  passengers: z.array(passengerInputSchema).max(12).optional(),
});

export const checkoutSchema = z.object({
  cartId: z.string().trim().min(4).max(80),
  mode: z.enum(["pay", "hold"]),
  holdHours: z.union([z.literal(24), z.literal(48)]).optional(),
  paymentMethod: paymentMethodEnum,
  paymentDetailLabel: z.string().trim().min(1).max(120),
  useMilesSplit: z.boolean().optional(),
  useTravelBank: z.boolean().optional(),
});

export const settleHoldSchema = z.object({
  paymentMethod: paymentMethodEnum.default("card"),
  paymentDetailLabel: z.string().trim().min(1).max(120).default("Visa Infinite •••• 4821"),
  useMilesSplit: z.boolean().optional(),
  useTravelBank: z.boolean().optional(),
});

export const retrieveBookingSchema = z.object({
  rloc: z.string().trim().min(4).max(10),
  lastName: z.string().trim().min(2).max(60),
});

export const servicePnrSchema = z.object({
  contactEmail: z.string().trim().email().max(120).optional(),
  contactPhone: z.string().trim().min(6).max(40).optional(),
  sindbadNo: z.string().trim().max(32).optional(),
});

export const exchangeBookingSchema = z.object({
  newDate: z.string().trim().min(8).max(16),
});

export const refundBookingSchema = z.object({
  toVoucher: z.boolean(),
});

export const addBookingAncillarySchema = z.object({
  label: z.string().trim().min(1).max(120),
  priceOMR: z.number().min(0).max(5000),
  payWithMiles: z.boolean().optional(),
});

export const irropsActionSchema = z.object({
  action: z.enum(["rebook", "voucher", "rebook_and_checkin"]),
  flightNumber: z.string().trim().max(16).optional(),
  departureTime: z.string().trim().max(10).optional(),
  arrivalTime: z.string().trim().max(10).optional(),
});

export const checkInCompleteSchema = z.object({
  biometricOptIn: z.boolean().optional(),
  requestBagTags: z.boolean().optional(),
});

export const checkInUpgradeSchema = z.object({
  kind: z.enum(["biz", "bag"]),
  payWithMiles: z.boolean().optional(),
});

export const biometricSchema = z.object({
  consent: z.boolean(),
});

export const handoffTokenSchema = z.object({
  rloc: z.string().trim().min(4).max(10),
  flow: z.enum(["checkin", "manage"]).optional(),
});

export const loginSchema = z.object({
  mode: z.enum(["demo", "oidc"]).default("demo"),
  memberName: z.string().trim().min(2).max(80).optional(),
  tier: z.enum(["Blue", "Silver", "Gold"]).optional(),
  role: z.enum(["member", "admin"]).optional(),
  oidcIdToken: z.string().trim().min(10).max(4096).optional(),
});

export const oidcAuthorizeSchema = z.object({
  redirectUri: z.string().trim().min(1).max(512).default("http://localhost:8080/sindbad"),
  requestedRole: z.enum(["member", "admin"]).optional(),
});

export const oidcCallbackSchema = z.object({
  state: z.string().trim().min(8).max(128),
  code: z.string().trim().min(4).max(256),
  codeVerifier: z.string().trim().min(16).max(256),
  memberName: z.string().trim().min(2).max(80).optional(),
  tier: z.enum(["Blue", "Silver", "Gold"]).optional(),
  role: z.enum(["member", "admin"]).optional(),
});

export const tierSwitchSchema = z.object({
  tier: z.enum(["Blue", "Silver", "Gold"]),
});

export const retroClaimSchema = z.object({
  pnr: z.string().trim().min(4).max(10),
});

export const redeemCatalogSchema = z.object({
  itemId: z.string().trim().min(1).max(40),
});

export const householdAddSchema = z.object({
  name: z.string().trim().min(2).max(80),
  relation: z.enum(["Spouse", "Child", "Parent", "Sibling"]),
});

export const partnerSsoSchema = z.object({
  partner: z.string().trim().min(1).max(40).default("allianz"),
});

export const cmsAdminUpdateSchema = z.object({
  darkSiteActive: z.boolean().optional(),
  darkSiteHeadlineEn: z.string().trim().max(160).optional(),
  darkSiteHeadlineAr: z.string().trim().max(160).optional(),
  darkSiteAdvisoryEn: z.string().trim().max(1000).optional(),
  darkSiteAdvisoryAr: z.string().trim().max(1000).optional(),
  heroTitleEn: z.string().trim().max(160).optional(),
  heroTitleAr: z.string().trim().max(160).optional(),
  heroSubtitleEn: z.string().trim().max(400).optional(),
  heroSubtitleAr: z.string().trim().max(400).optional(),
  featureFlags: z
    .object({
      genaiSuhailEnabled: z.boolean().optional(),
      awardBookingEnabled: z.boolean().optional(),
      biometricsEnabled: z.boolean().optional(),
      dynamicBundlesEnabled: z.boolean().optional(),
      darkSiteEmergencyBanner: z.boolean().optional(),
    })
    .optional(),
  upsertPromo: z
    .object({
      code: z.string().trim().min(3).max(24),
      discountPct: z.number().int().min(1).max(90),
      label: z.string().trim().min(2).max(80),
      active: z.boolean(),
    })
    .optional(),
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(600),
});
