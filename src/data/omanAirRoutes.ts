export type CabinClass = "economy" | "business" | "studio";

export type FareBrandId =
  | "ECO_SAVER"
  | "ECO_COMFORT"
  | "ECO_FLEX"
  | "BIZ_COMFORT"
  | "BIZ_FLEX"
  | "BIZ_STUDIO";

export type CurrencyCode = "OMR" | "USD" | "AED" | "SAR" | "EUR" | "GBP";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  rateFromOMR: number;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  OMR: { code: "OMR", symbol: "OMR", rateFromOMR: 1, decimals: 3 },
  USD: { code: "USD", symbol: "$", rateFromOMR: 2.6, decimals: 0 },
  AED: { code: "AED", symbol: "AED", rateFromOMR: 9.55, decimals: 0 },
  SAR: { code: "SAR", symbol: "SAR", rateFromOMR: 9.75, decimals: 0 },
  EUR: { code: "EUR", symbol: "€", rateFromOMR: 2.42, decimals: 0 },
  GBP: { code: "GBP", symbol: "£", rateFromOMR: 2.05, decimals: 0 },
};

export interface Airport {
  code: string;
  city: string;
  cityAr: string;
  country: string;
  name: string;
  region: "Oman" | "GCC & MENA" | "Europe" | "Asia" | "Africa";
  cityGroup?: string;
  nearbyCodes?: string[];
  /** Nearby/partner airport routed via a primary hub */
  viaHubAirport?: string;
}

export const AIRPORTS: Airport[] = [
  { code: "MCT", city: "Muscat", cityAr: "مسقط", country: "Oman", name: "Muscat International Airport", region: "Oman" },
  { code: "SLL", city: "Salalah", cityAr: "صلالة", country: "Oman", name: "Salalah International Airport", region: "Oman" },
  { code: "DXB", city: "Dubai", cityAr: "دبي", country: "UAE", name: "Dubai International Airport", region: "GCC & MENA", cityGroup: "DXB", nearbyCodes: ["AUH", "SHJ"] },
  { code: "AUH", city: "Abu Dhabi (Nearby UAE)", cityAr: "أبوظبي (مطار قريب)", country: "UAE", name: "Zayed International Airport", region: "GCC & MENA", cityGroup: "DXB", nearbyCodes: ["DXB", "SHJ"], viaHubAirport: "DXB" },
  { code: "SHJ", city: "Sharjah (Nearby UAE)", cityAr: "الشارقة (مطار قريب)", country: "UAE", name: "Sharjah International Airport", region: "GCC & MENA", cityGroup: "DXB", nearbyCodes: ["DXB", "AUH"], viaHubAirport: "DXB" },
  { code: "DOH", city: "Doha", cityAr: "الدوحة", country: "Qatar", name: "Hamad International Airport", region: "GCC & MENA" },
  { code: "RUH", city: "Riyadh", cityAr: "الرياض", country: "Saudi Arabia", name: "King Khalid International Airport", region: "GCC & MENA" },
  { code: "JED", city: "Jeddah", cityAr: "جدة", country: "Saudi Arabia", name: "King Abdulaziz International Airport", region: "GCC & MENA" },
  { code: "BAH", city: "Bahrain", cityAr: "البحرين", country: "Bahrain", name: "Bahrain International Airport", region: "GCC & MENA" },
  { code: "KWI", city: "Kuwait", cityAr: "الكويت", country: "Kuwait", name: "Kuwait International Airport", region: "GCC & MENA" },
  { code: "CAI", city: "Cairo", cityAr: "القاهرة", country: "Egypt", name: "Cairo International Airport", region: "GCC & MENA" },
  { code: "IST", city: "Istanbul", cityAr: "إسطنبول", country: "Türkiye", name: "Istanbul Airport", region: "Europe" },
  { code: "LHR", city: "London Heathrow", cityAr: "لندن هيثرو", country: "United Kingdom", name: "London Heathrow Airport", region: "Europe", cityGroup: "LON", nearbyCodes: ["LGW", "STN"] },
  { code: "LGW", city: "London Gatwick (Nearby)", cityAr: "لندن غاتويك (قريب)", country: "United Kingdom", name: "London Gatwick Airport", region: "Europe", cityGroup: "LON", nearbyCodes: ["LHR", "STN"], viaHubAirport: "LHR" },
  { code: "STN", city: "London Stansted (Nearby)", cityAr: "لندن ستانستيد (قريب)", country: "United Kingdom", name: "London Stansted Airport", region: "Europe", cityGroup: "LON", nearbyCodes: ["LHR", "LGW"], viaHubAirport: "LHR" },
  { code: "FRA", city: "Frankfurt", cityAr: "فرانكفورت", country: "Germany", name: "Frankfurt Airport", region: "Europe" },
  { code: "CDG", city: "Paris CDG", cityAr: "باريس شارل ديغول", country: "France", name: "Paris Charles de Gaulle", region: "Europe", cityGroup: "PAR", nearbyCodes: ["ORY"] },
  { code: "ORY", city: "Paris Orly (Nearby)", cityAr: "باريس أورلي (قريب)", country: "France", name: "Paris Orly Airport", region: "Europe", cityGroup: "PAR", nearbyCodes: ["CDG"], viaHubAirport: "CDG" },
  { code: "AMS", city: "Amsterdam", cityAr: "أمستردام", country: "Netherlands", name: "Amsterdam Schiphol", region: "Europe" },
  { code: "MXP", city: "Milan", cityAr: "ميلانو", country: "Italy", name: "Milan Malpensa Airport", region: "Europe", cityGroup: "MIL" },
  { code: "BKK", city: "Bangkok", cityAr: "بانكوك", country: "Thailand", name: "Suvarnabhumi Airport", region: "Asia" },
  { code: "KUL", city: "Kuala Lumpur", cityAr: "كوالالمبور", country: "Malaysia", name: "Kuala Lumpur International", region: "Asia" },
  { code: "MNL", city: "Manila", cityAr: "مانيلا", country: "Philippines", name: "Ninoy Aquino International", region: "Asia" },
  { code: "BOM", city: "Mumbai", cityAr: "مومباي", country: "India", name: "Chhatrapati Shivaji Maharaj", region: "Asia" },
  { code: "DEL", city: "New Delhi", cityAr: "نيودلهي", country: "India", name: "Indira Gandhi International", region: "Asia" },
  { code: "ZNZ", city: "Zanzibar", cityAr: "زنجبار", country: "Tanzania", name: "Abeid Amani Karume International", region: "Africa" },
];

export interface FareBrandSpec {
  id: FareBrandId;
  cabin: CabinClass;
  name: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  multiplier: number;
  checkedBagKg: number;
  cabinBagText: string;
  seatSelection: "paid" | "free";
  changePolicy: "fee" | "reduced" | "free";
  refundPolicy: "none" | "fee" | "free";
  loungeIncluded: boolean;
  fastTrackIncluded: boolean;
  milesUpgradeEligible: boolean;
}

export const FARE_BRANDS: Record<FareBrandId, FareBrandSpec> = {
  ECO_SAVER: {
    id: "ECO_SAVER",
    cabin: "economy",
    name: "Economy Super Saver",
    nameAr: "السياحية التوفيرية",
    tagline: "Travel light with our sharpest fare",
    taglineAr: "سفر خفيف بأفضل سعر اقتصادي",
    multiplier: 1.0,
    checkedBagKg: 0,
    cabinBagText: "1 × 7 kg",
    seatSelection: "paid",
    changePolicy: "fee",
    refundPolicy: "none",
    loungeIncluded: false,
    fastTrackIncluded: false,
    milesUpgradeEligible: false,
  },
  ECO_COMFORT: {
    id: "ECO_COMFORT",
    cabin: "economy",
    name: "Economy Comfort",
    nameAr: "السياحية المريحة",
    tagline: "20 kg baggage & flexible rebooking",
    taglineAr: "20 كجم أمتعة ومرونة في التعديل",
    multiplier: 1.22,
    checkedBagKg: 20,
    cabinBagText: "1 × 7 kg",
    seatSelection: "paid",
    changePolicy: "reduced",
    refundPolicy: "fee",
    loungeIncluded: false,
    fastTrackIncluded: false,
    milesUpgradeEligible: true,
  },
  ECO_FLEX: {
    id: "ECO_FLEX",
    cabin: "economy",
    name: "Economy Flex",
    nameAr: "السياحية المرنة",
    tagline: "30 kg baggage, free seat & easy changes",
    taglineAr: "30 كجم أمتعة ومقعد مجاني وتعديلات ميسرة",
    multiplier: 1.46,
    checkedBagKg: 30,
    cabinBagText: "1 × 7 kg",
    seatSelection: "free",
    changePolicy: "free",
    refundPolicy: "free",
    loungeIncluded: false,
    fastTrackIncluded: false,
    milesUpgradeEligible: true,
  },
  BIZ_COMFORT: {
    id: "BIZ_COMFORT",
    cabin: "business",
    name: "Business Comfort",
    nameAr: "الأعمال المريحة",
    tagline: "Lie-flat Apex Suite, 40 kg & Majan Lounge",
    taglineAr: "أجنحة مسطحة بالكامل، 40 كجم وصالة مجان",
    multiplier: 2.9,
    checkedBagKg: 40,
    cabinBagText: "2 × 7 kg",
    seatSelection: "free",
    changePolicy: "reduced",
    refundPolicy: "fee",
    loungeIncluded: true,
    fastTrackIncluded: true,
    milesUpgradeEligible: false,
  },
  BIZ_FLEX: {
    id: "BIZ_FLEX",
    cabin: "business",
    name: "Business Flex",
    nameAr: "الأعمال المرنة",
    tagline: "50 kg baggage, full flexibility & Studio upgrade eligible",
    taglineAr: "50 كجم أمتعة، مرونة كاملة وقابلة للترقية للأستوديو",
    multiplier: 3.45,
    checkedBagKg: 50,
    cabinBagText: "2 × 7 kg",
    seatSelection: "free",
    changePolicy: "free",
    refundPolicy: "free",
    loungeIncluded: true,
    fastTrackIncluded: true,
    milesUpgradeEligible: true,
  },
  BIZ_STUDIO: {
    id: "BIZ_STUDIO",
    cabin: "studio",
    name: "Business Studio",
    nameAr: "أستوديو الأعمال",
    tagline: "Private enclosed suite, 60 kg & bespoke Omani dining",
    taglineAr: "جناح خاص مغلق، 60 كجم وضيافة عُمانية فاخرة",
    multiplier: 4.85,
    checkedBagKg: 60,
    cabinBagText: "2 × 7 kg",
    seatSelection: "free",
    changePolicy: "free",
    refundPolicy: "free",
    loungeIncluded: true,
    fastTrackIncluded: true,
    milesUpgradeEligible: true,
  },
};

export interface OmanAirRouteDef {
  id: string;
  origin: string;
  destination: string;
  flightNumber: string;
  returnFlightNumber: string;
  departureTime: string;
  arrivalTime: string;
  returnDepartureTime: string;
  returnArrivalTime: string;
  durationMinutes: number;
  aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8";
  hasStudio: boolean;
  baseEcoOMR: number;
  taxesOMR: number;
  distanceKm: number;
  isLongHaul: boolean;
  baggageGenerousRoute?: boolean;
  codesharePartner?: string;
  highlightTag: string;
  highlightNote: string;
}

export const OMAN_AIR_20_ROUTES: OmanAirRouteDef[] = [
  { id: "MCT-LHR", origin: "MCT", destination: "LHR", flightNumber: "WY 101", returnFlightNumber: "WY 102", departureTime: "14:20", arrivalTime: "18:25", returnDepartureTime: "20:05", returnArrivalTime: "07:15+1", durationMinutes: 485, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 168, taxesOMR: 54, distanceKm: 5834, isLongHaul: true, highlightTag: "Flagship", highlightNote: "Double-daily Dreamliner with private Business Studio" },
  { id: "MCT-DXB", origin: "MCT", destination: "DXB", flightNumber: "WY 603", returnFlightNumber: "WY 604", departureTime: "08:45", arrivalTime: "09:55", returnDepartureTime: "11:15", returnArrivalTime: "12:25", durationMinutes: 70, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 38, taxesOMR: 18, distanceKm: 349, isLongHaul: false, highlightTag: "Hourly Shuttle", highlightNote: "Fast GCC hop with Seamless Fast Track" },
  { id: "MCT-DOH", origin: "MCT", destination: "DOH", flightNumber: "WY 661", returnFlightNumber: "WY 662", departureTime: "10:15", arrivalTime: "10:50", returnDepartureTime: "12:20", returnArrivalTime: "14:55", durationMinutes: 95, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 46, taxesOMR: 21, distanceKm: 702, isLongHaul: false, codesharePartner: "oneworld Partner", highlightTag: "oneworld Hub", highlightNote: "Seamless oneworld alliance connections" },
  { id: "MCT-RUH", origin: "MCT", destination: "RUH", flightNumber: "WY 677", returnFlightNumber: "WY 678", departureTime: "13:10", arrivalTime: "14:30", returnDepartureTime: "16:00", returnArrivalTime: "19:15", durationMinutes: 140, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 54, taxesOMR: 22, distanceKm: 1188, isLongHaul: false, highlightTag: "Trending", highlightNote: "Direct to Riyadh Season & business district" },
  { id: "MCT-JED", origin: "MCT", destination: "JED", flightNumber: "WY 673", returnFlightNumber: "WY 674", departureTime: "15:30", arrivalTime: "17:55", returnDepartureTime: "19:30", returnArrivalTime: "23:45", durationMinutes: 205, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 69, taxesOMR: 26, distanceKm: 1978, isLongHaul: false, highlightTag: "Red Sea", highlightNote: "Widebody Dreamliner comfort for Umrah & Red Sea" },
  { id: "MCT-SLL", origin: "MCT", destination: "SLL", flightNumber: "WY 903", returnFlightNumber: "WY 904", departureTime: "07:30", arrivalTime: "09:10", returnDepartureTime: "10:15", returnArrivalTime: "11:55", durationMinutes: 100, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 29, taxesOMR: 9, distanceKm: 856, isLongHaul: false, highlightTag: "Khareef Escape", highlightNote: "Oman's lush southern coast & Frankincense Trail" },
  { id: "MCT-CAI", origin: "MCT", destination: "CAI", flightNumber: "WY 405", returnFlightNumber: "WY 406", departureTime: "14:00", arrivalTime: "16:35", returnDepartureTime: "18:10", returnArrivalTime: "00:15+1", durationMinutes: 275, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 94, taxesOMR: 32, distanceKm: 2786, isLongHaul: false, baggageGenerousRoute: true, highlightTag: "Extra Bag Route", highlightNote: "Generous baggage allowance for family travel" },
  { id: "MCT-IST", origin: "MCT", destination: "IST", flightNumber: "WY 165", returnFlightNumber: "WY 166", departureTime: "14:40", arrivalTime: "19:00", returnDepartureTime: "20:30", returnArrivalTime: "02:35+1", durationMinutes: 320, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 112, taxesOMR: 38, distanceKm: 3340, isLongHaul: true, highlightTag: "Gen Z Pick", highlightNote: "Where East meets West — direct from Muscat" },
  { id: "MCT-FRA", origin: "MCT", destination: "FRA", flightNumber: "WY 115", returnFlightNumber: "WY 116", departureTime: "14:10", arrivalTime: "18:45", returnDepartureTime: "20:20", returnArrivalTime: "06:30+1", durationMinutes: 455, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 158, taxesOMR: 49, distanceKm: 5187, isLongHaul: true, highlightTag: "Europe Gateway", highlightNote: "Non-stop Dreamliner to central Europe" },
  { id: "MCT-CDG", origin: "MCT", destination: "CDG", flightNumber: "WY 131", returnFlightNumber: "WY 132", departureTime: "14:35", arrivalTime: "19:30", returnDepartureTime: "21:15", returnArrivalTime: "07:35+1", durationMinutes: 475, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 174, taxesOMR: 52, distanceKm: 5584, isLongHaul: true, highlightTag: "Culture & Fashion", highlightNote: "Evening arrival in Paris with lie-flat luxury" },
  { id: "MCT-AMS", origin: "MCT", destination: "AMS", flightNumber: "WY 171", returnFlightNumber: "WY 172", departureTime: "14:05", arrivalTime: "19:10", returnDepartureTime: "20:00", returnArrivalTime: "05:50+1", durationMinutes: 465, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 164, taxesOMR: 48, distanceKm: 5525, isLongHaul: true, highlightTag: "New 2025/26", highlightNote: "Direct Muscat–Amsterdam Dreamliner service" },
  { id: "MCT-MXP", origin: "MCT", destination: "MXP", flightNumber: "WY 143", returnFlightNumber: "WY 144", departureTime: "14:50", arrivalTime: "19:05", returnDepartureTime: "21:00", returnArrivalTime: "06:40+1", durationMinutes: 435, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 149, taxesOMR: 45, distanceKm: 5002, isLongHaul: true, highlightTag: "Design Capital", highlightNote: "Direct to Milan & Northern Italy" },
  { id: "MCT-BKK", origin: "MCT", destination: "BKK", flightNumber: "WY 817", returnFlightNumber: "WY 818", departureTime: "22:00", arrivalTime: "06:45+1", returnDepartureTime: "09:00", returnArrivalTime: "12:10", durationMinutes: 345, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 128, taxesOMR: 36, distanceKm: 4565, isLongHaul: true, highlightTag: "Most Booked", highlightNote: "Overnight Dreamliner to Bangkok's street culture" },
  { id: "MCT-KUL", origin: "MCT", destination: "KUL", flightNumber: "WY 823", returnFlightNumber: "WY 824", departureTime: "09:15", arrivalTime: "20:05", returnDepartureTime: "21:25", returnArrivalTime: "00:15+1", durationMinutes: 410, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 136, taxesOMR: 37, distanceKm: 5202, isLongHaul: true, codesharePartner: "Malaysia Airlines", highlightTag: "oneworld Asia", highlightNote: "Halal-friendly luxury & SE Asia connections" },
  { id: "MCT-MNL", origin: "MCT", destination: "MNL", flightNumber: "WY 843", returnFlightNumber: "WY 844", departureTime: "09:15", arrivalTime: "21:30", returnDepartureTime: "07:15", returnArrivalTime: "12:00", durationMinutes: 495, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 148, taxesOMR: 41, distanceKm: 6532, isLongHaul: true, baggageGenerousRoute: true, highlightTag: "Island Gateway", highlightNote: "Non-stop to Manila with extra baggage tiers" },
  { id: "MCT-BOM", origin: "MCT", destination: "BOM", flightNumber: "WY 203", returnFlightNumber: "WY 204", departureTime: "08:50", arrivalTime: "13:15", returnDepartureTime: "15:20", returnArrivalTime: "16:55", durationMinutes: 175, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 58, taxesOMR: 22, distanceKm: 1585, isLongHaul: false, baggageGenerousRoute: true, highlightTag: "Daily Express", highlightNote: "Quick hop across the Arabian Sea" },
  { id: "MCT-DEL", origin: "MCT", destination: "DEL", flightNumber: "WY 241", returnFlightNumber: "WY 242", departureTime: "09:25", arrivalTime: "14:05", returnDepartureTime: "16:15", returnArrivalTime: "18:10", durationMinutes: 190, aircraft: "Boeing 787-9 Dreamliner", hasStudio: true, baseEcoOMR: 64, taxesOMR: 24, distanceKm: 1966, isLongHaul: false, baggageGenerousRoute: true, highlightTag: "Widebody India", highlightNote: "Dreamliner service to India's capital" },
  { id: "MCT-BAH", origin: "MCT", destination: "BAH", flightNumber: "WY 651", returnFlightNumber: "WY 652", departureTime: "09:10", arrivalTime: "09:50", returnDepartureTime: "10:50", returnArrivalTime: "13:30", durationMinutes: 100, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 44, taxesOMR: 19, distanceKm: 834, isLongHaul: false, highlightTag: "Weekend Hop", highlightNote: "Direct morning & evening Gulf frequencies" },
  { id: "MCT-KWI", origin: "MCT", destination: "KWI", flightNumber: "WY 643", returnFlightNumber: "WY 644", departureTime: "13:30", arrivalTime: "14:45", returnDepartureTime: "15:50", returnArrivalTime: "19:00", durationMinutes: 135, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 52, taxesOMR: 20, distanceKm: 1210, isLongHaul: false, highlightTag: "Gulf Direct", highlightNote: "Seamless business & family travel" },
  { id: "MCT-ZNZ", origin: "MCT", destination: "ZNZ", flightNumber: "WY 705", returnFlightNumber: "WY 706", departureTime: "10:45", arrivalTime: "15:10", returnDepartureTime: "16:25", returnArrivalTime: "22:45", durationMinutes: 325, aircraft: "Boeing 737 MAX 8", hasStudio: false, baseEcoOMR: 134, taxesOMR: 39, distanceKm: 3768, isLongHaul: true, baggageGenerousRoute: true, highlightTag: "Heritage Route", highlightNote: "Historic Omani–Zanzibar turquoise coast link" },
];

export interface DailyFarePoint {
  dateISO: string;
  dayOffset: number;
  pricesOMR: Record<FareBrandId, number>;
  seatsRemaining: number;
  soldOut: boolean;
}

function seededFactor(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function getDateISO(offsetFromToday: number): string {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + offsetFromToday);
  return base.toISOString().slice(0, 10);
}

/**
 * Generates the 30-day rolling synthetic fare repository for any of the 20 Oman Air routes.
 */
export function get30DayFareRepository(routeId: string): DailyFarePoint[] {
  const route = OMAN_AIR_20_ROUTES.find((r) => r.id === routeId) ?? OMAN_AIR_20_ROUTES[0]!;
  const routeHash = route.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const days: DailyFarePoint[] = [];

  for (let i = 0; i < 30; i++) {
    const dateISO = getDateISO(i);
    const dow = new Date(dateISO + "T12:00:00Z").getUTCDay();
    const isWeekend = dow === 4 || dow === 5 || dow === 6; // GCC Thu-Sat peak
    const wave = 0.86 + seededFactor(routeHash + i * 17) * 0.32;
    const weekendBump = isWeekend ? 1.12 : 1.0;
    const demandMult = wave * weekendBump;
    const seatsRemaining = Math.floor(seededFactor(routeHash + i * 31) * 14);
    const soldOut = i === 6 && route.destination === "LHR";

    const pricesOMR = {} as Record<FareBrandId, number>;
    (Object.keys(FARE_BRANDS) as FareBrandId[]).forEach((brandId) => {
      const spec = FARE_BRANDS[brandId];
      pricesOMR[brandId] = Math.round(route.baseEcoOMR * demandMult * spec.multiplier);
    });

    days.push({
      dateISO,
      dayOffset: i,
      pricesOMR,
      seatsRemaining: soldOut ? 0 : Math.max(2, seatsRemaining),
      soldOut,
    });
  }
  return days;
}

export function resolveCityOrAirport(query: string): Airport[] {
  const q = query.trim().toUpperCase();
  if (!q) return AIRPORTS;
  return AIRPORTS.filter(
    (a) =>
      a.code.includes(q) ||
      a.city.toUpperCase().includes(q) ||
      a.country.toUpperCase().includes(q) ||
      a.cityAr.includes(query.trim()) ||
      (a.cityGroup && a.cityGroup.includes(q)) ||
      (a.nearbyCodes && a.nearbyCodes.some((c) => c.includes(q)))
  );
}

function resolveHubAirportCode(code: string): string {
  const ap = AIRPORTS.find((a) => a.code === code);
  return ap?.viaHubAirport ?? code;
}

export function findRouteForPair(origin: string, destination: string): {
  route: OmanAirRouteDef;
  isReverse: boolean;
  isConnectingViaMCT: boolean;
  resolvedOrigin: string;
  resolvedDestination: string;
  usesNearbyPartner: boolean;
} | null {
  const effOrigin = resolveHubAirportCode(origin);
  const effDest = resolveHubAirportCode(destination);
  const usesNearbyPartner = effOrigin !== origin || effDest !== destination;

  const direct = OMAN_AIR_20_ROUTES.find(
    (r) => r.origin === effOrigin && r.destination === effDest
  );
  if (direct) {
    return {
      route: direct,
      isReverse: false,
      isConnectingViaMCT: usesNearbyPartner,
      resolvedOrigin: effOrigin,
      resolvedDestination: effDest,
      usesNearbyPartner,
    };
  }

  const reverse = OMAN_AIR_20_ROUTES.find(
    (r) => r.origin === effDest && r.destination === effOrigin
  );
  if (reverse) {
    return {
      route: reverse,
      isReverse: true,
      isConnectingViaMCT: usesNearbyPartner,
      resolvedOrigin: effOrigin,
      resolvedDestination: effDest,
      usesNearbyPartner,
    };
  }

  const leg2 = OMAN_AIR_20_ROUTES.find((r) => r.destination === effDest);
  if (leg2 && effOrigin !== effDest) {
    return {
      route: leg2,
      isReverse: false,
      isConnectingViaMCT: true,
      resolvedOrigin: effOrigin,
      resolvedDestination: effDest,
      usesNearbyPartner,
    };
  }
  return null;
}

export interface FlightOption {
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
  priceMultiplier: number;
  seatsRemaining: number;
  codesharePartner?: string | undefined;
}

function shiftHHMM(hhmm: string, deltaMinutes: number): string {
  const clean = hhmm.replace("+1", "");
  const [hStr, mStr] = clean.split(":");
  const total = ((Number(hStr) || 0) * 60 + (Number(mStr) || 0) + deltaMinutes + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return hhmm.includes("+1") ? `${hh}:${mm}+1` : `${hh}:${mm}`;
}

/**
 * Generates multiple selectable flight frequencies & connecting options so Filters (non-stop)
 * and Sort (lowest price / shortest duration) operate on real result choices (FR-53..FR-56).
 */
export function generateFlightOptions(origin: string, destination: string, dateISO: string): FlightOption[] {
  const match = findRouteForPair(origin, destination);
  if (!match) return [];
  const repo = get30DayFareRepository(match.route.id);
  const day = repo.find((d) => d.dateISO === dateISO) ?? repo[0]!;
  const baseDep = match.isReverse ? match.route.returnDepartureTime : match.route.departureTime;
  const baseArr = match.isReverse ? match.route.returnArrivalTime : match.route.arrivalTime;
  const baseNum = match.isReverse ? match.route.returnFlightNumber : match.route.flightNumber;
  const numDigits = Number(baseNum.replace(/\D/g, "")) || 100;

  if (match.isConnectingViaMCT) {
    return [
      {
        id: `${baseNum}-CON1`,
        flightNumber: `${baseNum}`,
        origin,
        destination,
        departureTime: baseDep,
        arrivalTime: shiftHHMM(baseArr, 105),
        durationMinutes: match.route.durationMinutes + 105,
        stops: 1,
        stopLabel: match.usesNearbyPartner ? `1 Stop (via ${match.resolvedDestination})` : "1 Stop via Muscat (MCT)",
        aircraft: match.route.aircraft,
        hasStudio: match.route.hasStudio,
        priceMultiplier: 1.0,
        seatsRemaining: day.seatsRemaining,
        codesharePartner: match.route.codesharePartner ?? (match.usesNearbyPartner ? "oneworld / Interline Rail-Air" : undefined),
      },
      {
        id: `${baseNum}-CON2`,
        flightNumber: `WY ${numDigits + 4}`,
        origin,
        destination,
        departureTime: shiftHHMM(baseDep, 210),
        arrivalTime: shiftHHMM(baseArr, 285),
        durationMinutes: match.route.durationMinutes + 75,
        stops: 1,
        stopLabel: "1 Stop via Muscat (MCT) · Fast Connect",
        aircraft: match.route.aircraft,
        hasStudio: match.route.hasStudio,
        priceMultiplier: 1.08,
        seatsRemaining: Math.max(2, day.seatsRemaining - 1),
        codesharePartner: match.route.codesharePartner,
      },
    ];
  }

  return [
    {
      id: `${baseNum}-NS1`,
      flightNumber: baseNum,
      origin,
      destination,
      departureTime: baseDep,
      arrivalTime: baseArr,
      durationMinutes: match.route.durationMinutes,
      stops: 0,
      stopLabel: "Non-stop",
      aircraft: match.route.aircraft,
      hasStudio: match.route.hasStudio,
      priceMultiplier: 1.0,
      seatsRemaining: day.seatsRemaining,
      codesharePartner: match.route.codesharePartner,
    },
    {
      id: `${baseNum}-NS2`,
      flightNumber: `WY ${numDigits + 2}`,
      origin,
      destination,
      departureTime: shiftHHMM(baseDep, 240),
      arrivalTime: shiftHHMM(baseArr, 240),
      durationMinutes: match.route.durationMinutes + 10,
      stops: 0,
      stopLabel: "Non-stop",
      aircraft: match.route.aircraft,
      hasStudio: match.route.hasStudio,
      priceMultiplier: 0.94,
      seatsRemaining: Math.max(3, day.seatsRemaining + 2),
      codesharePartner: match.route.codesharePartner,
    },
    {
      id: `${baseNum}-1S`,
      flightNumber: `WY ${numDigits + 6}`,
      origin,
      destination,
      departureTime: shiftHHMM(baseDep, -150),
      arrivalTime: shiftHHMM(baseArr, 35),
      durationMinutes: match.route.durationMinutes + 125,
      stops: 1,
      stopLabel: "1 Stop via Doha (DOH)",
      aircraft: "Boeing 737 MAX 8",
      hasStudio: false,
      priceMultiplier: 0.89,
      seatsRemaining: 8,
      codesharePartner: "oneworld Partner",
    },
  ];
}

export function formatMoney(amountOMR: number, currency: CurrencyCode): string {
  const info = CURRENCIES[currency];
  const converted = amountOMR * info.rateFromOMR;
  if (currency === "OMR") {
    return `OMR ${converted.toFixed(info.decimals)}`;
  }
  if (currency === "AED" || currency === "SAR") {
    return `${currency} ${Math.round(converted).toLocaleString()}`;
  }
  return `${info.symbol}${Math.round(converted).toLocaleString()}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
