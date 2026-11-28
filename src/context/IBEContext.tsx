import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrencyCode } from "../data/omanAirRoutes";
import {
  INITIAL_SAMPLE_PNRS,
  type HouseholdMember,
  type SavedBookingPNR,
  type SindbadTier,
} from "../data/ancillariesAndSeats";
export type { HouseholdMember };
import { bffClient, getConfiguredBffUrl } from "../lib/bff-client";
import { isHoldExpired } from "../lib/ibe-rules";
import type { BffCmsState, BffSessionUser } from "../../bff/types";

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
    {
      id: "rs-1",
      origin: "MCT",
      destination: "LHR",
      departDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      tripType: "roundtrip",
      passengers: 2,
    },
    {
      id: "rs-2",
      origin: "MCT",
      destination: "DXB",
      departDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      tripType: "oneway",
      passengers: 1,
    },
  ],
};

interface IBEContextValue extends IBEPersistedPrefs {
  bffUrl: string | null;
  bffConnected: boolean;
  demoModeEnabled: boolean;
  role: "guest" | "member" | "admin";
  cmsState: BffCmsState | null;
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
  signInOidcPkce: (
    name?: string,
    tier?: SindbadTier,
    requestedRole?: "member" | "admin",
  ) => Promise<void>;
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
    b.status === "HELD" && isHoldExpired(b.holdExpiresAt) ? { ...b, status: "EXPIRED" } : b,
  );
}

export function IBEProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<IBEPersistedPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  const [bffUrl, setBffUrl] = useState<string | null>(null);
  const [bffConnected, setBffConnected] = useState(false);
  const [demoModeEnabled, setDemoModeEnabled] = useState(true);
  const [role, setRole] = useState<"guest" | "member" | "admin">("guest");
  const [cmsState, setCmsState] = useState<BffCmsState | null>(null);
  const [sindbadSignedIn, setSindbadSignedIn] = useState(false);
  const [sindbadMemberName, setSindbadMemberName] = useState("Tariq Al-Balushi");
  const [sindbadTier, setSindbadTierState] = useState<SindbadTier>("Blue");
  const [sindbadMiles, setSindbadMiles] = useState(0);
  const [tierPoints, setTierPoints] = useState(0);
  const [travelBankOMR, setTravelBankOMR] = useState(0);
  const [bookings, setBookings] = useState<SavedBookingPNR[]>([]);
  const [household, setHousehold] = useState<HouseholdMember[]>([]);
  const [claimedPnrs, setClaimedPnrs] = useState<string[]>([]);

  const syncFromBffUser = (user: BffSessionUser) => {
    setDemoModeEnabled(user.demoModeEnabled !== false);
    setRole(user.role);
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
      const [sessRes, bookRes, loyRes, cmsRes] = await Promise.all([
        bffClient.getSession(prefs.lang),
        bffClient.listBookings(prefs.lang),
        bffClient.getLoyaltyProfile(prefs.lang),
        bffClient.getCmsContent(prefs.lang).catch(() => null),
      ]);
      syncFromBffUser(sessRes.user);
      setBookings(enforceHoldExpiries(bookRes.bookings));
      setHousehold(loyRes.household);
      setClaimedPnrs(loyRes.claimedPnrs);
      if (cmsRes) {
        setCmsState(cmsRes.cms);
        if (cmsRes.cms.darkSiteActive) {
          setPrefs((s) => ({ ...s, darkSiteMode: true }));
        }
      }
      setBffConnected(true);
    } catch {
      setBffConnected(false);
    }
  };

  useEffect(() => {
    const detectedBffUrl = getConfiguredBffUrl();
    setBffUrl(detectedBffUrl);
    if (!detectedBffUrl) {
      setRole("member");
      setSindbadSignedIn(true);
      setSindbadTierState("Gold");
      setSindbadMiles(68450);
      setTierPoints(420);
      setTravelBankOMR(65);
      setBookings(INITIAL_SAMPLE_PNRS);
      setHousehold([
        {
          id: "hh-1",
          name: "Reem Al-Balushi",
          relation: "Spouse",
          sindbadNo: "SB-8841210",
          contributedMiles: 14200,
        },
        {
          id: "hh-2",
          name: "Yusuf Al-Balushi",
          relation: "Child",
          sindbadNo: "SB-9100342",
          contributedMiles: 4850,
        },
      ]);
    }
    try {
      const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<IBEPersistedPrefs>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      } else {
        if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ar")) {
          // FR-30: browser-language detection on first visit
          setPrefs((prev) => ({ ...prev, lang: "ar" }));
        }
        if (detectedBffUrl) {
          void bffClient
            .getEdgeContext()
            .then((edge) => {
              setPrefs((prev) => ({
                ...prev,
                currency: edge.currency,
                lang: edge.lang,
              }));
            })
            .catch(() => undefined);
        }
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

  const signInOidcPkce = async (
    name = "Tariq Al-Balushi",
    tier: SindbadTier = "Gold",
    requestedRole: "member" | "admin" = "member",
  ) => {
    if (!bffConnected) {
      setSindbadSignedIn(true);
      setRole(requestedRole);
      setSindbadMemberName(name);
      setSindbadTierState(tier);
      return;
    }
    const authInit = await bffClient.startOidcPkce(window.location.href, requestedRole, prefs.lang);
    if (authInit.mode === "external-oidc") {
      window.location.assign(authInit.authorizationUrl);
      return;
    }
    if (authInit.sandboxAuthCode && authInit.sandboxCodeVerifier) {
      const cb = await bffClient.completeOidcCallback(
        {
          state: authInit.state,
          code: authInit.sandboxAuthCode,
          codeVerifier: authInit.sandboxCodeVerifier,
          memberName: name,
          tier,
          role: requestedRole,
        },
        prefs.lang,
      );
      syncFromBffUser(cb.user);
      const [bookRes, loyRes] = await Promise.all([
        bffClient.listBookings(prefs.lang),
        bffClient.getLoyaltyProfile(prefs.lang),
      ]);
      setBookings(enforceHoldExpiries(bookRes.bookings));
      setHousehold(loyRes.household);
      setClaimedPnrs(loyRes.claimedPnrs);
    }
  };

  const value: IBEContextValue = {
    ...prefs,
    bffUrl,
    bffConnected,
    demoModeEnabled,
    role,
    cmsState,
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
        void bffClient
          .switchTier(tier, prefs.lang)
          .then((r) => syncFromBffUser(r.user))
          .catch(() => {});
      }
    },
    signInSindbad: (name) => {
      void signInOidcPkce(name || "Tariq Al-Balushi", "Gold", "member");
    },
    signInOidcPkce,
    signOutSindbad: () => {
      setSindbadSignedIn(false);
      setRole("guest");
      if (bffConnected) {
        void bffClient
          .logout(prefs.lang)
          .then(async (r) => {
            syncFromBffUser(r.user);
            const [bookRes, loyRes] = await Promise.all([
              bffClient.listBookings(prefs.lang),
              bffClient.getLoyaltyProfile(prefs.lang),
            ]);
            setBookings(enforceHoldExpiries(bookRes.bookings));
            setHousehold(loyRes.household);
            setClaimedPnrs(loyRes.claimedPnrs);
          })
          .catch(() => {});
      }
    },
    toggleSindbadSignIn: () => {
      if (sindbadSignedIn) {
        setSindbadSignedIn(false);
        setRole("guest");
        if (bffConnected) {
          void bffClient
            .logout(prefs.lang)
            .then((r) => syncFromBffUser(r.user))
            .catch(() => {});
        }
      } else {
        void signInOidcPkce("Tariq Al-Balushi", "Gold", "member");
      }
    },
    setDarkSiteMode: (darkSiteMode) => setPrefs((s) => ({ ...s, darkSiteMode })),
    addRecentSearch: (search) =>
      setPrefs((s) => ({
        ...s,
        recentSearches: [
          { ...search, id: `rs-${Date.now()}` },
          ...s.recentSearches.filter(
            (r) =>
              !(
                r.origin === search.origin &&
                r.destination === search.destination &&
                r.departDate === search.departDate
              ),
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
