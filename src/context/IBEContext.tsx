import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrencyCode } from "../data/omanAirRoutes";
import { INITIAL_SAMPLE_PNRS, type HouseholdMember, type SavedBookingPNR, type SindbadTier } from "../data/ancillariesAndSeats";
export type { HouseholdMember };
import { bffClient, getConfiguredBffUrl } from "../lib/bff-client";
import { isHoldExpired } from "../lib/ibe-rules";
import type { BffSessionUser } from "../../bff/types";

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

interface IBEPersistedPrefs {
  lang: AppLang;
  currency: CurrencyCode;
  darkSiteMode: boolean;
  recentSearches: RecentSearch[];
}

const PREFS_STORAGE_KEY = "oman_air_ibe_prefs_v1";

const DEFAULT_PREFS: IBEPersistedPrefs = {
  lang: "en",
  currency: "OMR",
  darkSiteMode: false,
  recentSearches: [
    { id: "rs-1", origin: "MCT", destination: "LHR", departDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), tripType: "roundtrip", passengers: 2 },
    { id: "rs-2", origin: "MCT", destination: "DXB", departDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), tripType: "oneway", passengers: 1 },
  ],
};

interface IBEContextValue extends IBEPersistedPrefs {
  bffUrl: string | null;
  bffConnected: boolean;
  sindbadSignedIn: boolean;
  sindbadMemberName: string;
  sindbadTier: SindbadTier;
  sindbadMiles: number;
  tierPoints: number;
  travelBankOMR: number;
  bookings: SavedBookingPNR[];
  household: HouseholdMember[];
  claimedPnrs: string[];
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
  syncFromBffUser: (user: BffSessionUser) => void;
  setHouseholdList: (members: HouseholdMember[]) => void;
  refreshFromBff: () => Promise<void>;
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
  const [prefs, setPrefs] = useState<IBEPersistedPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  const bffUrl = getConfiguredBffUrl();
  const [bffConnected, setBffConnected] = useState(false);
  const [sindbadSignedIn, setSindbadSignedIn] = useState(true);
  const [sindbadMemberName, setSindbadMemberName] = useState("Tariq Al-Balushi");
  const [sindbadTier, setSindbadTierState] = useState<SindbadTier>("Gold");
  const [sindbadMiles, setSindbadMiles] = useState(68450);
  const [tierPoints, setTierPoints] = useState(420);
  const [travelBankOMR, setTravelBankOMR] = useState(65);
  const [bookings, setBookings] = useState<SavedBookingPNR[]>(INITIAL_SAMPLE_PNRS);
  const [household, setHousehold] = useState<HouseholdMember[]>([
    { id: "hh-1", name: "Reem Al-Balushi", relation: "Spouse", sindbadNo: "SB-8841210", contributedMiles: 14200 },
    { id: "hh-2", name: "Yusuf Al-Balushi", relation: "Child", sindbadNo: "SB-9100342", contributedMiles: 4850 },
  ]);
  const [claimedPnrs, setClaimedPnrs] = useState<string[]>([]);

  const syncFromBffUser = (user: BffSessionUser) => {
    setSindbadSignedIn(user.signedIn);
    if (user.memberName) setSindbadMemberName(user.memberName);
    setSindbadTierState(user.tier);
    setSindbadMiles(user.miles);
    setTierPoints(user.tierPoints);
    setTravelBankOMR(user.travelBankOMR);
  };

  const refreshFromBff = async () => {
    if (!bffUrl) return;
    try {
      const [sessRes, bookRes, loyRes] = await Promise.all([
        bffClient.getSession(prefs.lang),
        bffClient.listBookings(prefs.lang),
        bffClient.getLoyaltyProfile(prefs.lang),
      ]);
      syncFromBffUser(sessRes.user);
      setBookings(enforceHoldExpiries(bookRes.bookings));
      setHousehold(loyRes.household);
      setClaimedPnrs(loyRes.claimedPnrs);
      setBffConnected(true);
    } catch {
      setBffConnected(false);
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<IBEPersistedPrefs>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore storage quota errors
    }
  }, [prefs, hydrated]);

  useEffect(() => {
    if (!hydrated || !bffUrl) return;
    void refreshFromBff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, bffUrl]);

  useEffect(() => {
    document.documentElement.dir = prefs.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = prefs.lang;
  }, [prefs.lang]);

  const value: IBEContextValue = {
    ...prefs,
    bffUrl,
    bffConnected,
    sindbadSignedIn,
    sindbadMemberName,
    sindbadTier,
    sindbadMiles,
    tierPoints,
    travelBankOMR,
    bookings,
    household,
    claimedPnrs,
    setLang: (lang) => setPrefs((s) => ({ ...s, lang })),
    setCurrency: (currency) => setPrefs((s) => ({ ...s, currency })),
    setSindbadTier: (tier) => {
      setSindbadTierState(tier);
      setSindbadSignedIn(true);
      if (bffConnected) {
        void bffClient.switchTier(tier, prefs.lang).then((r) => syncFromBffUser(r.user)).catch(() => {});
      }
    },
    signInSindbad: (name) => {
      setSindbadSignedIn(true);
      if (name?.trim()) setSindbadMemberName(name.trim());
      if (bffConnected) {
        void bffClient.login(name, undefined, prefs.lang).then((r) => syncFromBffUser(r.user)).catch(() => {});
      }
    },
    signOutSindbad: () => {
      setSindbadSignedIn(false);
      if (bffConnected) {
        void bffClient.logout(prefs.lang).then((r) => syncFromBffUser(r.user)).catch(() => {});
      }
    },
    toggleSindbadSignIn: () => {
      const next = !sindbadSignedIn;
      setSindbadSignedIn(next);
      if (bffConnected) {
        const req = next ? bffClient.login(undefined, undefined, prefs.lang) : bffClient.logout(prefs.lang);
        void req.then((r) => syncFromBffUser(r.user)).catch(() => {});
      }
    },
    setDarkSiteMode: (darkSiteMode) => setPrefs((s) => ({ ...s, darkSiteMode })),
    addRecentSearch: (search) =>
      setPrefs((s) => ({
        ...s,
        recentSearches: [
          { ...search, id: `rs-${Date.now()}` },
          ...s.recentSearches.filter(
            (r) => !(r.origin === search.origin && r.destination === search.destination && r.departDate === search.departDate)
          ),
        ].slice(0, 5),
      })),
    addBooking: (booking) =>
      setBookings((prev) => [booking, ...prev.filter((b) => b.rloc !== booking.rloc)]),
    updateBooking: (rloc, updater) =>
      setBookings((prev) => prev.map((b) => (b.rloc === rloc ? updater(b) : b))),
    syncFromBffUser,
    setHouseholdList: setHousehold,
    refreshFromBff,
    spendMiles: (miles) => {
      if (sindbadMiles < miles) return false;
      setSindbadMiles((m) => Math.max(0, m - miles));
      return true;
    },
    addMiles: (miles, pnr) => {
      setSindbadMiles((m) => m + miles);
      setTierPoints((tp) => tp + Math.round(miles / 80));
      if (pnr) setClaimedPnrs((prev) => [...prev, pnr]);
    },
    addTravelBank: (omr) => setTravelBankOMR((v) => +(v + omr).toFixed(2)),
    spendTravelBank: (omr) => setTravelBankOMR((v) => Math.max(0, +(v - omr).toFixed(2))),
    addHouseholdMember: (m) => setHousehold((prev) => [...prev, { ...m, id: `hh-${Date.now()}` }]),
    removeHouseholdMember: (id) => setHousehold((prev) => prev.filter((h) => h.id !== id)),
  };

  return <IBEContext.Provider value={value}>{children}</IBEContext.Provider>;
}

export function useIBE() {
  const ctx = useContext(IBEContext);
  if (!ctx) throw new Error("useIBE must be used inside IBEProvider");
  return ctx;
}
