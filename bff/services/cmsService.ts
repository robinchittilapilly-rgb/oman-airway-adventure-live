import { PROMO_CODES } from "../../src/lib/ibe-rules";
import type { SessionAndCartStore } from "../stores/sessionStore";
import type { BffCmsArticle, BffCmsState, BffFeatureFlags } from "../types";

const DEFAULT_ARTICLES: BffCmsArticle[] = [
  {
    id: "art-baggage-01",
    slug: "baggage-allowance-rules",
    category: "baggage",
    titleEn: "Oman Air Checked & Cabin Baggage Policy",
    titleAr: "سياسة الأمتعة المسجلة واليدوية للطيران العُماني",
    bodyEn:
      "Economy Super Saver includes 7 kg cabin bag; Economy Comfort includes 20 kg checked; Business & Business Studio include 40–60 kg plus 2×7 kg cabin pieces. Sindbad Silver adds +10 kg and Gold adds +15 kg.",
    bodyAr:
      "تشمل الدرجة السياحية التوفيرية 7 كجم حقيبة يد، والسياحية المريحة 20 كجم مسجلة، ودرجة رجال الأعمال والأستوديو 40–60 كجم بالإضافة إلى مزايا سندباد.",
    routeLink: "/",
    published: true,
  },
  {
    id: "art-sindbad-02",
    slug: "sindbad-tier-benefits",
    category: "sindbad",
    titleEn: "Sindbad Gold & oneworld Emerald/Sapphire Privileges",
    titleAr: "مزايا فئة سندباد الذهبية وتحالف oneworld",
    bodyEn:
      "Earn 4×/5×/6× miles per USD equivalent spend. Gold unlocks FFP-blocked bulkhead seats, complimentary Majan Lounge at Muscat (MCT), Fast Track security, and Muscat Chauffeur on long-haul itineraries.",
    bodyAr:
      "اكسب 4×/5×/6× أميال مقابل كل دولار أمريكي. تفتح الفئة الذهبية المقاعد الأمامية مجاناً وصالة مجان والمسار السريع وخدمة السائق الخاص.",
    routeLink: "/sindbad",
    published: true,
  },
  {
    id: "art-irrops-03",
    slug: "irrops-self-service-policy",
    category: "advisory",
    titleEn: "Flight Disruption & Self-Service Rebooking Policy",
    titleAr: "سياسة إعادة الحجز الذاتي عند اضطراب الرحلات",
    bodyEn:
      "In weather or operational disruptions, affected passengers qualify for zero-fee self-service re-protection in Manage My Booking or instant Travel Bank voucher conversion (+OMR 25 care bonus).",
    bodyAr:
      "عند حدوث اضطرابات جوية أو تشغيلية، يحق للمسافرين المتأثرين إعادة الحجز مجاناً أو استلام رصيد فوري في محفظة السفر.",
    routeLink: "/manage",
    published: true,
  },
  {
    id: "art-studio-04",
    slug: "business-studio-dreamliner",
    category: "destination",
    titleEn: "Boeing 787-9 Dreamliner Business Studio Experience",
    titleAr: "تجربة أستوديو الأعمال على طائرة دريملاينر 787-9",
    bodyEn:
      "Private enclosed suites operating to London (LHR), Paris (CDG), Frankfurt (FRA), Amsterdam (AMS), Bangkok (BKK), and Kuala Lumpur (KUL) with direct aisle access and gourmet Omani dining.",
    bodyAr:
      "أجنحة خاصة مغلقة على رحلات لندن وباريس وفرانكفورت وأمستردام وبانكوك وكوالالمبور مع دخول مباشر للممر وقائمة طعام عُمانية فاخرة.",
    routeLink: "/",
    published: true,
  },
  {
    id: "art-hold-05",
    slug: "hold-my-fare-terms",
    category: "policy",
    titleEn: "Hold My Fare & Voluntary Refund Rules",
    titleAr: "شروط تثبيت السعر والاسترداد الطوعي",
    bodyEn:
      "Lock your itinerary and fare for 24 hours (OMR 9) or 48 hours (OMR 15) and settle the ticket balance later inside Manage My Booking before hold expiry.",
    bodyAr:
      "ثبّت رحلتك وسعرك لمدة 24 ساعة (9 ر.ع) أو 48 ساعة (15 ر.ع) وأكمل الدفع لاحقاً عبر إدارة الحجز.",
    routeLink: "/manage",
    published: true,
  },
];

export function createDefaultCmsState(): BffCmsState {
  const dynamicPromos: BffCmsState["dynamicPromos"] = {};
  for (const [code, spec] of Object.entries(PROMO_CODES)) {
    dynamicPromos[code] = { ...spec, active: true };
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "system-seed",
    darkSiteActive: false,
    darkSiteHeadlineEn: "OMAN AIR · TRAVEL ADVISORY PORTAL",
    darkSiteHeadlineAr: "الطيران العُماني · بوابة تنبيهات السفر الطارئة",
    darkSiteAdvisoryEn:
      "Weather cells near Dubai (DXB) may affect select departures such as WY 603. Complimentary fee-waived rebooking and instant care vouchers are active in Manage My Booking.",
    darkSiteAdvisoryAr:
      "بسبب الأحوال الجوية قرب دبي (DXB)، قد تتأثر بعض الرحلات مثل WY 603. تتوفر إعادة الحجز المجانية وقسائم الرعاية عبر إدارة الحجز.",
    heroTitleEn: "Fly Omani Luxury. Book in Seconds.",
    heroTitleAr: "سافر بأناقة عُمانية إلى 20 وجهة عالمية",
    heroSubtitleEn:
      "30-day fares across 20 Oman Air routes, interactive Dreamliner seat maps, dynamic bundles, award flights, and Sindbad perks.",
    heroSubtitleAr:
      "أسعار 30 يوماً شفافة، خرائط مقاعد دريملاينر التفاعلية، رحلات المكافآت ومزايا سندباد الفورية.",
    featureFlags: {
      genaiSuhailEnabled: true,
      awardBookingEnabled: true,
      biometricsEnabled: true,
      dynamicBundlesEnabled: true,
      darkSiteEmergencyBanner: false,
    },
    dynamicPromos,
    articles: DEFAULT_ARTICLES,
  };
}

export class BffCmsService {
  constructor(private readonly store: SessionAndCartStore) {}

  async getState(): Promise<BffCmsState> {
    const existing = await this.store.getCmsState();
    if (existing) return existing;
    const seeded = createDefaultCmsState();
    await this.store.saveCmsState(seeded);
    return seeded;
  }

  async updateState(
    patch: {
      darkSiteActive?: boolean | undefined;
      darkSiteHeadlineEn?: string | undefined;
      darkSiteHeadlineAr?: string | undefined;
      darkSiteAdvisoryEn?: string | undefined;
      darkSiteAdvisoryAr?: string | undefined;
      heroTitleEn?: string | undefined;
      heroTitleAr?: string | undefined;
      heroSubtitleEn?: string | undefined;
      heroSubtitleAr?: string | undefined;
      featureFlags?: { [K in keyof BffFeatureFlags]?: BffFeatureFlags[K] | undefined } | undefined;
      upsertPromo?:
        { code: string; discountPct: number; label: string; active: boolean } | undefined;
    },
    actorName: string,
  ): Promise<BffCmsState> {
    const cur = await this.getState();
    const nextPromos = { ...cur.dynamicPromos };
    if (patch.upsertPromo) {
      const code = patch.upsertPromo.code.trim().toUpperCase();
      nextPromos[code] = {
        discountPct: patch.upsertPromo.discountPct,
        label: patch.upsertPromo.label,
        active: patch.upsertPromo.active,
      };
    }
    const mergedFlags: BffFeatureFlags = { ...cur.featureFlags };
    if (patch.featureFlags) {
      for (const k of Object.keys(patch.featureFlags) as (keyof BffFeatureFlags)[]) {
        const val = patch.featureFlags[k];
        if (val !== undefined) mergedFlags[k] = val;
      }
    }
    const next: BffCmsState = {
      ...cur,
      version: cur.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actorName,
      darkSiteActive: patch.darkSiteActive ?? cur.darkSiteActive,
      darkSiteHeadlineEn: patch.darkSiteHeadlineEn ?? cur.darkSiteHeadlineEn,
      darkSiteHeadlineAr: patch.darkSiteHeadlineAr ?? cur.darkSiteHeadlineAr,
      darkSiteAdvisoryEn: patch.darkSiteAdvisoryEn ?? cur.darkSiteAdvisoryEn,
      darkSiteAdvisoryAr: patch.darkSiteAdvisoryAr ?? cur.darkSiteAdvisoryAr,
      heroTitleEn: patch.heroTitleEn ?? cur.heroTitleEn,
      heroTitleAr: patch.heroTitleAr ?? cur.heroTitleAr,
      heroSubtitleEn: patch.heroSubtitleEn ?? cur.heroSubtitleEn,
      heroSubtitleAr: patch.heroSubtitleAr ?? cur.heroSubtitleAr,
      featureFlags: mergedFlags,
      dynamicPromos: nextPromos,
    };
    await this.store.saveCmsState(next);
    return next;
  }

  async searchArticles(query: string): Promise<BffCmsArticle[]> {
    const state = await this.getState();
    const q = query.trim().toLowerCase();
    return state.articles.filter((a) => {
      if (!a.published) return false;
      if (!q) return true;
      return (
        a.titleEn.toLowerCase().includes(q) ||
        a.titleAr.toLowerCase().includes(q) ||
        a.bodyEn.toLowerCase().includes(q) ||
        a.bodyAr.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }
}
