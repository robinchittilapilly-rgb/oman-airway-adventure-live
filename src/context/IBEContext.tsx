import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrencyCode } from "../data/omanAirRoutes";
import { INITIAL_SAMPLE_PNRS, type SavedBookingPNR, type SindbadTier } from "../data/ancillariesAndSeats";
import { isHoldExpired } from "../lib/ibe-rules";

export type AppLang = "en" | "ar";

export interface RecentSearch {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  tripType: "roundtrip" | "oneway" | "multicity";
  passengers: number;
}

export interface HouseholdMember {
  id: string;
  name: string;
  relation: string;
  sindbadNo: string;
  contributedMiles: number;
}

interface IBEPersistedState {
  lang: AppLang;
  currency: CurrencyCode;
  sindbadSignedIn: boolean;
  sindbadMemberName: string;
  sindbadTier: SindbadTier;
  sindbadMiles: number;
  tierPoints: number;
  travelBankOMR: number;
  darkSiteMode: boolean;
  recentSearches: RecentSearch[];
  bookings: SavedBookingPNR[];
  household: HouseholdMember[];
  claimedPnrs: string[];
}

const STORAGE_KEY = "oman_air_ibe_state_v2";

const DEFAULT_STATE: IBEPersistedState = {
  lang: "en",
  currency: "OMR",
  sindbadSignedIn: true,
  sindbadMemberName: "Tariq Al-Balushi",
  sindbadTier: "Gold",
  sindbadMiles: 68450,
  tierPoints: 420,
  travelBankOMR: 65,
  darkSiteMode: false,
  recentSearches: [
    { id: "rs-1", origin: "MCT", destination: "LHR", departDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), tripType: "roundtrip", passengers: 2 },
    { id: "rs-2", origin: "MCT", destination: "DXB", departDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), tripType: "oneway", passengers: 1 },
  ],
  bookings: INITIAL_SAMPLE_PNRS,
  household: [
    { id: "hh-1", name: "Reem Al-Balushi", relation: "Spouse", sindbadNo: "SB-8841210", contributedMiles: 14200 },
    { id: "hh-2", name: "Yusuf Al-Balushi", relation: "Child", sindbadNo: "SB-9100342", contributedMiles: 4850 },
  ],
  claimedPnrs: [],
};

interface IBEContextValue extends IBEPersistedState {
  setLang: (lang: AppLang) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setSindbadTier: (tier: SindbadTier) => void;
  signInSindbad: (name?: string) => void;
  signOutSindbad: () => void;
  toggleSindbadSignIn: () => void;
  setDarkSiteMode: (enabled: boolean) => void;
  addRecentSearch: (s: Omit<RecentSearch, "id">) => void;
  addBooking: (b: SavedBookingPNR) => void;
  updateBooking: (rloc: string, updater: (prev: SavedBookingPNR) => SavedBookingPNR) => void;
  spendMiles: (miles: number) => boolean;
  addMiles: (miles: number, pnr?: string) => void;
  addTravelBank: (omr: number) => void;
  spendTravelBank: (omr: number) => void;
  addHouseholdMember: (m: Omit<HouseholdMember, "id">) => void;
  removeHouseholdMember: (id: string) => void;
}

const IBEContext = createContext<IBEContextValue | null>(null);

function enforceHoldExpiries(bookings: SavedBookingPNR[]): SavedBookingPNR[] {
  return bookings.map((b) =>
    b.status === "HELD" && isHoldExpired(b.holdExpiresAt)
      ? { ...b, status: "EXPIRED" }
      : b
  );
}

export function IBEProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IBEPersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<IBEPersistedState>;
        setState((prev) => ({
          ...prev,
          ...parsed,
          bookings: enforceHoldExpiries(parsed.bookings ?? prev.bookings),
        }));
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state, hydrated]);

  useEffect(() => {
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  const value: IBEContextValue = {
    ...state,
    setLang: (lang) => setState((s) => ({ ...s, lang })),
    setCurrency: (currency) => setState((s) => ({ ...s, currency })),
    setSindbadTier: (sindbadTier) => setState((s) => ({ ...s, sindbadTier, sindbadSignedIn: true })),
    signInSindbad: (name) =>
      setState((s) => ({
        ...s,
        sindbadSignedIn: true,
        sindbadMemberName: name?.trim() || s.sindbadMemberName || "Tariq Al-Balushi",
      })),
    signOutSindbad: () => setState((s) => ({ ...s, sindbadSignedIn: false })),
    toggleSindbadSignIn: () => setState((s) => ({ ...s, sindbadSignedIn: !s.sindbadSignedIn })),
    setDarkSiteMode: (darkSiteMode) => setState((s) => ({ ...s, darkSiteMode })),
    addRecentSearch: (search) =>
      setState((s) => ({
        ...s,
        recentSearches: [
          { ...search, id: `rs-${Date.now()}` },
          ...s.recentSearches.filter(
            (r) => !(r.origin === search.origin && r.destination === search.destination && r.departDate === search.departDate)
          ),
        ].slice(0, 5),
      })),
    addBooking: (booking) =>
      setState((s) => ({ ...s, bookings: [booking, ...s.bookings.filter((b) => b.rloc !== booking.rloc)] })),
    updateBooking: (rloc, updater) =>
      setState((s) => ({
        ...s,
        bookings: s.bookings.map((b) => (b.rloc === rloc ? updater(b) : b)),
      })),
    spendMiles: (miles) => {
      if (state.sindbadMiles < miles) return false;
      setState((s) => ({ ...s, sindbadMiles: Math.max(0, s.sindbadMiles - miles) }));
      return true;
    },
    addMiles: (miles, pnr) =>
      setState((s) => ({
        ...s,
        sindbadMiles: s.sindbadMiles + miles,
        tierPoints: s.tierPoints + Math.round(miles / 80),
        claimedPnrs: pnr ? [...s.claimedPnrs, pnr] : s.claimedPnrs,
      })),
    addTravelBank: (omr) => setState((s) => ({ ...s, travelBankOMR: +(s.travelBankOMR + omr).toFixed(2) })),
    spendTravelBank: (omr) => setState((s) => ({ ...s, travelBankOMR: Math.max(0, +(s.travelBankOMR - omr).toFixed(2)) })),
    addHouseholdMember: (m) =>
      setState((s) => ({ ...s, household: [...s.household, { ...m, id: `hh-${Date.now()}` }] })),
    removeHouseholdMember: (id) =>
      setState((s) => ({ ...s, household: s.household.filter((h) => h.id !== id) })),
  };

  return <IBEContext.Provider value={value}>{children}</IBEContext.Provider>;
}

export function useIBE() {
  const ctx = useContext(IBEContext);
  if (!ctx) throw new Error("useIBE must be used inside IBEProvider");
  return ctx;
}
