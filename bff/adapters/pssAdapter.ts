import {
  AIRPORTS,
  findRouteForPair,
  generateFlightOptions,
  get30DayFareRepository,
  OMAN_AIR_20_ROUTES,
} from "../../src/data/omanAirRoutes";
import {
  generateSeatMap,
  type SavedBookingPNR,
  type SeatCell,
} from "../../src/data/ancillariesAndSeats";
import {
  buildIataBcbpString,
  generateRLOC,
  generateUniqueBagTagNumber,
} from "../../src/lib/ibe-rules";
import type { BffFlightOffer } from "../types";
import type { SessionAndCartStore } from "../stores/sessionStore";

export interface PssAdapter {
  searchFlights(origin: string, destination: string, dateISO: string, pssToken: string): Promise<{
    routeId: string;
    isLongHaul: boolean;
    baggageGenerousRoute: boolean;
    offers: BffFlightOffer[];
    calendar: ReturnType<typeof get30DayFareRepository>;
    nearbyAlternatives: string[];
  }>;
  getSeatMap(aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8"): Promise<SeatCell[]>;
  commitBooking(booking: SavedBookingPNR, pssToken: string): Promise<SavedBookingPNR>;
  retrieveBooking(rloc: string, lastName: string, pssToken: string): Promise<SavedBookingPNR | null>;
  saveBooking(booking: SavedBookingPNR): Promise<SavedBookingPNR>;
  splitBooking(booking: SavedBookingPNR): Promise<{ parent: SavedBookingPNR; child: SavedBookingPNR }>;
  checkIn(booking: SavedBookingPNR, biometricOptIn: boolean, requestBagTags: boolean): Promise<{
    booking: SavedBookingPNR;
    bcbpPayloads: string[];
  }>;
  offloadCheckIn(booking: SavedBookingPNR): Promise<SavedBookingPNR>;
  getFlightTimetable(): Promise<typeof OMAN_AIR_20_ROUTES>;
}

/**
 * Protocol translation helper (FR-43): parses legacy Sabre-style SOAP/XML availability fragments
 * into clean REST JSON flight offers for mobile/web channels.
 */
export function translateSoapAvailabilityXmlToOffers(xmlPayload: string): BffFlightOffer[] {
  const regex = /<FlightSegment\s+([^>]+)\/>/g;
  const offers: BffFlightOffer[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlPayload)) !== null) {
    const attrs = match[1] ?? "";
    const pick = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? "";
    offers.push({
      id: pick("Id"),
      flightNumber: pick("FlightNumber"),
      origin: pick("Origin"),
      destination: pick("Destination"),
      departureTime: pick("DepartureTime"),
      arrivalTime: pick("ArrivalTime"),
      durationMinutes: Number(pick("DurationMinutes")) || 120,
      stops: pick("Stops") === "1" ? 1 : 0,
      stopLabel: pick("StopLabel") || "Non-stop",
      aircraft:
        pick("Aircraft") === "Boeing 787-9 Dreamliner"
          ? "Boeing 787-9 Dreamliner"
          : "Boeing 737 MAX 8",
      hasStudio: pick("HasStudio") === "true",
      seatsRemaining: Number(pick("SeatsRemaining")) || 4,
      priceMultiplier: Number(pick("PriceMultiplier")) || 1,
      ...(pick("Partner") ? { codesharePartner: pick("Partner") } : {}),
    });
  }
  return offers;
}

function encodeOffersAsSimulatedSoapXml(offers: BffFlightOffer[]): string {
  const segs = offers
    .map(
      (o) =>
        `<FlightSegment Id="${o.id}" FlightNumber="${o.flightNumber}" Origin="${o.origin}" Destination="${o.destination}" DepartureTime="${o.departureTime}" ArrivalTime="${o.arrivalTime}" DurationMinutes="${o.durationMinutes}" Stops="${o.stops}" StopLabel="${o.stopLabel}" Aircraft="${o.aircraft}" HasStudio="${o.hasStudio}" SeatsRemaining="${o.seatsRemaining}" PriceMultiplier="${o.priceMultiplier}" Partner="${o.codesharePartner ?? ""}" />`
    )
    .join("");
  return `<soapenv:Envelope><soapenv:Body><OTA_AirAvailRS>${segs}</OTA_AirAvailRS></soapenv:Body></soapenv:Envelope>`;
}

/**
 * PSS-agnostic Mock/Simulator implementation (FR-39, FR-43, FR-51).
 */
export class MockSabrePssAdapter implements PssAdapter {
  constructor(private readonly store: SessionAndCartStore) {}

  async searchFlights(origin: string, destination: string, dateISO: string, _pssToken: string) {
    const match = findRouteForPair(origin, destination);
    if (!match) {
      throw new Error("ERR_404_INV_CLASS");
    }
    const rawOffers = generateFlightOptions(origin, destination, dateISO);
    // Exercise SOAP/XML -> JSON translation layer boundary
    const soapXml = encodeOffersAsSimulatedSoapXml(rawOffers);
    const offers = translateSoapAvailabilityXmlToOffers(soapXml);
    const calendar = get30DayFareRepository(match.route.id);
    const nearbyAlternatives = AIRPORTS.find((a) => a.code === destination)?.nearbyCodes ?? [];

    return {
      routeId: match.route.id,
      isLongHaul: match.route.isLongHaul,
      baggageGenerousRoute: Boolean(match.route.baggageGenerousRoute),
      offers,
      calendar,
      nearbyAlternatives,
    };
  }

  async getSeatMap(aircraft: "Boeing 787-9 Dreamliner" | "Boeing 737 MAX 8"): Promise<SeatCell[]> {
    return generateSeatMap(aircraft);
  }

  async commitBooking(booking: SavedBookingPNR, _pssToken: string): Promise<SavedBookingPNR> {
    this.store.upsertBooking(booking);
    return booking;
  }

  async retrieveBooking(rloc: string, lastName: string, _pssToken: string): Promise<SavedBookingPNR | null> {
    const found = this.store.getBooking(rloc);
    if (!found) return null;
    const cleanLast = lastName.trim().toUpperCase();
    const matchesPax = found.passengers.some((p) => p.lastName.toUpperCase() === cleanLast);
    return matchesPax ? found : null;
  }

  async saveBooking(booking: SavedBookingPNR): Promise<SavedBookingPNR> {
    this.store.upsertBooking(booking);
    return booking;
  }

  async splitBooking(booking: SavedBookingPNR): Promise<{ parent: SavedBookingPNR; child: SavedBookingPNR }> {
    const paxCount = booking.passengers.length;
    const splitShare = Math.round(booking.totalPaidOMR / paxCount);
    const remainingShare = Math.max(0, booking.totalPaidOMR - splitShare);
    const splitPax = booking.passengers[paxCount - 1]!;
    const childRloc = generateRLOC();

    const parent: SavedBookingPNR = {
      ...booking,
      passengers: booking.passengers.slice(0, -1),
      totalPaidOMR: remainingShare,
    };
    const child: SavedBookingPNR = {
      ...booking,
      rloc: childRloc,
      passengers: [splitPax],
      totalPaidOMR: splitShare,
    };
    this.store.upsertBooking(parent);
    this.store.upsertBooking(child);
    return { parent, child };
  }

  async checkIn(booking: SavedBookingPNR, biometricOptIn: boolean, requestBagTags: boolean) {
    const updated: SavedBookingPNR = {
      ...booking,
      biometricOptIn,
      passengers: booking.passengers.map((p, idx) => ({
        ...p,
        checkedIn: true,
        ...(requestBagTags ? { bagTagNumber: generateUniqueBagTagNumber(booking.rloc, idx) } : {}),
      })),
    };
    this.store.upsertBooking(updated);
    const bcbpPayloads = updated.passengers.map((p, idx) =>
      buildIataBcbpString({
        firstName: p.firstName,
        lastName: p.lastName,
        rloc: updated.rloc,
        origin: updated.origin,
        destination: updated.destination,
        flightNumber: updated.flightNumber,
        dateISO: updated.dateISO,
        seat: p.seat,
        seq: idx + 1,
      })
    );
    return { booking: updated, bcbpPayloads };
  }

  async offloadCheckIn(booking: SavedBookingPNR): Promise<SavedBookingPNR> {
    const updated: SavedBookingPNR = {
      ...booking,
      passengers: booking.passengers.map((p) => ({ ...p, checkedIn: false })),
    };
    this.store.upsertBooking(updated);
    return updated;
  }

  async getFlightTimetable() {
    return OMAN_AIR_20_ROUTES;
  }
}
