import type { FareBrandId } from "./omanAirRoutes";

export type SindbadTier = "Blue" | "Silver" | "Gold";

export interface AncillaryItem {
  id: string;
  code: string;
  category: "bundle" | "baggage" | "lounge" | "priority" | "meal" | "ssr" | "insurance";
  name: string;
  nameAr: string;
  description: string;
  priceOMR: number;
  extraBagKg?: number;
  waivesSeatFee?: boolean;
  waivesBagIds?: string[];
  waivesIds?: string[];
  goldComplimentary?: boolean;
  silverComplimentary?: boolean;
  longHaulOnly?: boolean;
  badge?: string;
}

export const VIRTUAL_BUNDLES: AncillaryItem[] = [
  {
    id: "BND_COMFORT",
    code: "VBD1",
    category: "bundle",
    name: "Comfort Bundle",
    nameAr: "باقة الراحة",
    description: "Extra Legroom Seat + 10 kg Extra Bag + Priority Boarding (saves 28%)",
    priceOMR: 29,
    extraBagKg: 10,
    waivesSeatFee: true,
    waivesIds: ["BAG_10", "PRI_BOARD"],
    badge: "Most Popular",
  },
  {
    id: "BND_EXPLORER",
    code: "VBD2",
    category: "bundle",
    name: "Majan Explorer Bundle",
    nameAr: "باقة مجان للاستكشاف",
    description: "Majan Lounge Access + Fast Track Security + 20 kg Extra Bag + Seat",
    priceOMR: 46,
    extraBagKg: 20,
    waivesSeatFee: true,
    waivesIds: ["BAG_20", "LNG_MAJAN", "PRI_FAST"],
    badge: "Best Value",
  },
];

export const DIRECT_ANCILLARIES: AncillaryItem[] = [
  { id: "BAG_10", code: "XB10", category: "baggage", name: "+10 kg Extra Checked Bag", nameAr: "+10 كجم أمتعة إضافية", description: "Pre-paid airport rate savings up to 40%", priceOMR: 16, extraBagKg: 10 },
  { id: "BAG_20", code: "XB20", category: "baggage", name: "+20 kg Extra Checked Bag", nameAr: "+20 كجم أمتعة إضافية", description: "Ideal for shopping & extended stays", priceOMR: 28, extraBagKg: 20 },
  { id: "LNG_MAJAN", code: "LNGM", category: "lounge", name: "Majan Lounge Access (MCT)", nameAr: "دخول صالة مجان (مسقط)", description: "Omani kahwa, hot buffet, quiet nap suites & showers", priceOMR: 24, goldComplimentary: true, longHaulOnly: false },
  { id: "PRI_FAST", code: "FSTK", category: "priority", name: "Security Fast Track", nameAr: "المسار السريع", description: "Dedicated priority immigration & security lanes", priceOMR: 11, goldComplimentary: true },
  { id: "PRI_BOARD", code: "PRBD", category: "priority", name: "Priority Boarding & Bag Drop", nameAr: "أولوية الصعود للطائرة", description: "Board first with guaranteed overhead bin space", priceOMR: 9, goldComplimentary: true, silverComplimentary: true },
  { id: "CHAUF_LH", code: "CHAF", category: "priority", name: "Muscat Chauffeur & Transit Suite", nameAr: "خدمة السائق الخاص في مسقط", description: "Long-haul exclusive private airport transfer & transit suite", priceOMR: 32, goldComplimentary: true, longHaulOnly: true, badge: "Long-Haul Only" },
];

export const MEAL_OPTIONS = [
  { id: "MEAL_STD", code: "AVML_STD", name: "Omani Signature Meal (Halal)", note: "Complimentary · Shuwa spiced lamb or grilled kingfish", priceOMR: 0 },
  { id: "MEAL_VGML", code: "VGML", name: "Plant-Based / Vegan", note: "Complimentary · Roasted za'atar vegetables & quinoa", priceOMR: 0 },
  { id: "MEAL_GFML", code: "GFML", name: "Gluten-Free", note: "Complimentary · Certified allergen-safe", priceOMR: 0 },
  { id: "MEAL_CHML", code: "CHML", name: "Gen Alpha Kids Box", note: "Complimentary · Fun healthy snack & activity pack", priceOMR: 0 },
  { id: "MEAL_PREM", code: "PRML", name: "Chef's Gourmet Upgrade", note: "Pre-order Omani lobster & saffron dessert", priceOMR: 14 },
];

export const SSR_OPTIONS = [
  { id: "SSR_WCHR", code: "WCHR", name: "Wheelchair Assistance", status: "HK" as const, note: "Ground team request recorded (demo)" },
  { id: "SSR_BSCT", code: "BSCT", name: "Infant Bassinet (Bulkhead)", status: "PN" as const, note: "Pending aircraft bulkhead allocation (demo)" },
  { id: "SSR_UMNR", code: "UMNR", name: "Unaccompanied Minor Escort", status: "HK" as const, note: "Dedicated crew escort (requires airport check-in)" },
];

export type SeatKind = "free" | "paid" | "legroom" | "exit" | "blocked_ffp" | "occupied";

export interface SeatCell {
  id: string;
  row: number;
  col: string;
  cabin: "studio" | "business" | "economy";
  kind: SeatKind;
  priceOMR: number;
}

export function generateSeatMap(aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8"): SeatCell[] {
  const seats: SeatCell[] = [];
  if (aircraft === "Boeing 787-9 Dreamliner") {
    for (let r = 1; r <= 2; r++) {
      for (const col of ["A", "D", "G", "K"]) {
        const occupied = r === 1 && col === "K";
        seats.push({ id: `${r}${col}`, row: r, col, cabin: "studio", kind: occupied ? "occupied" : "free", priceOMR: 0 });
      }
    }
    for (let r = 3; r <= 5; r++) {
      for (const col of ["A", "B", "D", "G", "J", "K"]) {
        const occupied = (r === 3 && col === "A") || (r === 4 && col === "G");
        seats.push({ id: `${r}${col}`, row: r, col, cabin: "business", kind: occupied ? "occupied" : "free", priceOMR: 0 });
      }
    }
    for (let r = 11; r <= 18; r++) {
      for (const col of ["A", "B", "C", "D", "E", "F", "H", "J", "K"]) {
        const hash = (r * 13 + col.charCodeAt(0)) % 11;
        let kind: SeatKind = "free";
        let priceOMR = 0;
        if (r === 11) {
          kind = col === "A" || col === "K" ? "blocked_ffp" : "legroom";
          priceOMR = 18;
        } else if (r === 14) {
          kind = "exit";
          priceOMR = 22;
        } else if (hash === 0 || hash === 4) {
          kind = "occupied";
          priceOMR = 0;
        } else if (r <= 13) {
          kind = "paid";
          priceOMR = 9;
        }
        seats.push({ id: `${r}${col}`, row: r, col, cabin: "economy", kind, priceOMR });
      }
    }
  } else {
    for (let r = 1; r <= 3; r++) {
      for (const col of ["A", "C", "D", "F"]) {
        const occupied = r === 1 && col === "A";
        seats.push({ id: `${r}${col}`, row: r, col, cabin: "business", kind: occupied ? "occupied" : "free", priceOMR: 0 });
      }
    }
    for (let r = 7; r <= 15; r++) {
      for (const col of ["A", "B", "C", "D", "E", "F"]) {
        const hash = (r * 7 + col.charCodeAt(0)) % 9;
        let kind: SeatKind = "free";
        let priceOMR = 0;
        if (r === 7) {
          kind = col === "A" || col === "F" ? "blocked_ffp" : "legroom";
          priceOMR = 15;
        } else if (r === 12) {
          kind = "exit";
          priceOMR = 19;
        } else if (hash === 1 || hash === 5) {
          kind = "occupied";
          priceOMR = 0;
        } else if (r <= 10) {
          kind = "paid";
          priceOMR = 7;
        }
        seats.push({ id: `${r}${col}`, row: r, col, cabin: "economy", kind, priceOMR });
      }
    }
  }
  return seats;
}

export interface SavedBookingPNR {
  rloc: string;
  status: "CONFIRMED" | "HELD" | "DISRUPTED_CXL" | "REFUNDED" | "VOUCHERED" | "EXPIRED";
  origin: string;
  destination: string;
  flightNumber: string;
  dateISO: string;
  departureTime: string;
  arrivalTime: string;
  returnSegment?: {
    flightNumber: string;
    dateISO: string;
    departureTime: string;
    arrivalTime: string;
    origin: string;
    destination: string;
  };
  aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8";
  fareBrand: FareBrandId;
  passengers: {
    firstName: string;
    lastName: string;
    type: string;
    passport: string;
    seat: string;
    checkedIn: boolean;
    bagTagNumber?: string;
  }[];
  ancillaries: string[];
  ssrs: { code: string; name: string; status: "HK" | "PN" }[];
  totalPaidOMR: number;
  paymentMethod: string;
  gate: string;
  terminal: string;
  disruptionNote?: string;
  holdExpiresAt?: string;
  biometricOptIn?: boolean;
}

export const INITIAL_SAMPLE_PNRS: SavedBookingPNR[] = [
  {
    rloc: "WY7K9M",
    status: "CONFIRMED",
    origin: "MCT",
    destination: "LHR",
    flightNumber: "WY 101",
    dateISO: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    departureTime: "14:20",
    arrivalTime: "18:25",
    aircraft: "Boeing 787-9 Dreamliner",
    fareBrand: "ECO_COMFORT",
    passengers: [
      { firstName: "TARIQ", lastName: "ALBALUSHI", type: "Adult", passport: "OM4928174", seat: "14A", checkedIn: false },
      { firstName: "REEM", lastName: "ALBALUSHI", type: "Adult", passport: "OM4928175", seat: "14B", checkedIn: false },
    ],
    ancillaries: ["Comfort Bundle", "Travel Insurance"],
    ssrs: [{ code: "VGML", name: "Plant-Based Meal", status: "HK" }],
    totalPaidOMR: 486,
    paymentMethod: "OmanNet / Visa •••• 4821",
    gate: "A12",
    terminal: "T1",
  },
  {
    rloc: "WY4D2X",
    status: "DISRUPTED_CXL",
    origin: "MCT",
    destination: "DXB",
    flightNumber: "WY 603",
    dateISO: new Date().toISOString().slice(0, 10),
    departureTime: "08:45",
    arrivalTime: "09:55",
    aircraft: "Boeing 737 MAX 8",
    fareBrand: "ECO_FLEX",
    passengers: [
      { firstName: "LAYLA", lastName: "ALHARTHI", type: "Adult", passport: "OM8831022", seat: "7C", checkedIn: false },
    ],
    ancillaries: ["Majan Lounge Access (MCT)"],
    ssrs: [],
    totalPaidOMR: 78,
    paymentMethod: "Apple Pay",
    gate: "B04",
    terminal: "T1",
    disruptionNote: "Weather disruption in Dubai airspace. Complimentary re-accommodation or Hotel/Refreshment Voucher is available with all fees waived.",
  },
  {
    rloc: "WY9U1R",
    status: "CONFIRMED",
    origin: "MCT",
    destination: "DOH",
    flightNumber: "WY 661",
    dateISO: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    departureTime: "10:15",
    arrivalTime: "10:50",
    aircraft: "Boeing 737 MAX 8",
    fareBrand: "ECO_COMFORT",
    passengers: [
      { firstName: "ZAID", lastName: "ALMAWALI", type: "Child", passport: "OM7712904", seat: "8A", checkedIn: false },
    ],
    ancillaries: [],
    ssrs: [{ code: "UMNR", name: "Unaccompanied Minor Escort", status: "HK" }],
    totalPaidOMR: 84,
    paymentMethod: "Visa •••• 9102",
    gate: "B08",
    terminal: "T1",
  },
];

export const SINDBAD_SAVED_TRAVELERS = [
  { id: "trv-1", firstName: "TARIQ", lastName: "ALBALUSHI", dob: "1996-05-14", gender: "M", passport: "OM4928174", nationality: "Oman", sindbadNo: "SB-8841209" },
  { id: "trv-2", firstName: "REEM", lastName: "ALBALUSHI", dob: "1998-11-03", gender: "F", passport: "OM4928175", nationality: "Oman", sindbadNo: "SB-8841210" },
  { id: "trv-3", firstName: "YUSUF", lastName: "ALBALUSHI", dob: "2019-02-22", gender: "M", passport: "OM4928199", nationality: "Oman", sindbadNo: "SB-9100342" },
];

/** Seeded unclaimed historical PNRs for simulated LMS retro-claim validation (FR-20). */
export const RETRO_CLAIMABLE_PNRS: Record<string, { route: string; flightNumber: string; miles: number }> = {
  WY5M2K: { route: "MCT → LHR", flightNumber: "WY 101", miles: 2840 },
  WY3P8N: { route: "MCT → BKK", flightNumber: "WY 817", miles: 2150 },
  WY2J4Q: { route: "MCT → DXB", flightNumber: "WY 603", miles: 680 },
};

export const REDEMPTION_CATALOG = [
  { id: "RED_DF", partner: "Muscat Duty Free", title: "OMR 25 Duty Free Voucher", miles: 6500, category: "Duty Free" },
  { id: "RED_HTL", partner: "Al Bustan Palace, A Ritz-Carlton Hotel", title: "1 Night Sea-View Stay in Muscat", miles: 38000, category: "Hotels" },
  { id: "RED_CAR", partner: "Sixt Oman", title: "2-Day Luxury SUV Rental (MCT)", miles: 14500, category: "Car Rental" },
  { id: "RED_LNG", partner: "Oman Air Majan Lounge", title: "Guest Lounge Pass (3 Hours)", miles: 5200, category: "Airport" },
];
