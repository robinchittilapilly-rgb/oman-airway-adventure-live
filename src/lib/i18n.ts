import type { AppLang } from "../context/IBEContext";

export const UI_TEXT = {
  en: {
    brandFooterTitle: "OMAN AIR · الطيران العماني",
    brandFooterSub: "Member of the oneworld Alliance · Hub: Muscat International Airport (MCT)",
    brandFooterNote: "Interactive Web IBE Prototype · Synthetic 20-Route 30-Day Data · Simulated PSS & Payment Flows",
    nav: {
      book: "Book",
      manage: "Manage",
      checkin: "Check-in",
      status: "Flight Status",
      sindbad: "Sindbad",
      signIn: "Sign in",
      signOut: "Sign out",
      guest: "Guest",
    },
    hero: {
      badge: "Oman Air · Official oneworld Member",
      title: "Fly Omani Luxury. Book in Seconds.",
      subtitle:
        "30-day fares across 20 Oman Air routes, interactive Dreamliner seat maps, dynamic bundles, and Sindbad perks.",
    },
    manage: {
      title: "Manage My Booking (MMB) & Self-Service IRROPS",
      subtitle:
        "Retrieve your booking using RLOC and passenger last name to exchange dates, handle disruptions, purchase ancillaries, upgrade with miles, split passengers, or refund.",
      rlocPlaceholder: "Booking Ref (RLOC) e.g. WY7K9M",
      lastNamePlaceholder: "Passenger Last Name (e.g. ALBALUSHI)",
      retrieve: "Retrieve Booking",
      exchangeTitle: "Exchange Flight Date",
      confirmExchange: "Calculate & Confirm Exchange",
      shopTitle: "Post-Ticketing Shop & Upgrades",
      refundTitle: "Voluntary Refund & Travel Bank",
    },
    checkin: {
      title: "Online Check-In & Digital Boarding Pass",
      subtitle:
        "Select a booking to verify document format, generate unique digital bag tags, and issue IATA BCBP boarding passes.",
      completeCheckIn: "Complete Check-In & Issue Boarding Passes",
      undoCheckIn: "Undo Check-In (Demo DCS)",
      addToWallet: "Preview / Download Wallet Pass",
      printPdf: "Print / PDF",
    },
    status: {
      title: "Flight Status & 20-Route Timetable",
      subtitle:
        "Simulated read-only schedule & gate feed (synthetic demo telemetry; no live PSS connection).",
      searchPlaceholder: "Filter by flight (WY 101) or city...",
    },
    sindbad: {
      title: "Sindbad Frequent Flyer Portal",
      subtitle: "Track tier status, calculate miles, pool family miles, retro-claim eligible PNRs, and redeem rewards.",
      retroTitle: "Claim Missing Miles (Retro-Claim)",
      familyTitle: "Family & Household Miles Pooling",
      catalogTitle: "Non-Flight Partner Redemption Catalog",
    },
    darkSite: {
      title: "OMAN AIR · TRAVEL ADVISORY PORTAL",
      subtitle: "Lightweight High-Availability Dark Site Mode (Demo Emergency Template)",
      exit: "Exit Dark Site",
      advisoryHeading: "Operational Update — Gulf Airspace Weather Advisory",
      statusHeading: "Read-Only Flight Status Check (Simulated Feed)",
      directoryHeading: "24/7 Emergency Assistance Directory",
    },
  },
  ar: {
    brandFooterTitle: "الطيران العُماني · OMAN AIR",
    brandFooterSub: "عضو تحالف oneworld · المركز الرئيسي: مطار مسقط الدولي (MCT)",
    brandFooterNote: "نموذج أولي لمحرك الحجز الإلكتروني · بيانات تجريبية لـ 20 وجهة · محاكاة أنظمة الحجز والدفع",
    nav: {
      book: "احجز",
      manage: "إدارة الحجز",
      checkin: "إتمام السفر",
      status: "حالة الرحلة",
      sindbad: "سندباد",
      signIn: "تسجيل الدخول",
      signOut: "تسجيل الخروج",
      guest: "زائر",
    },
    hero: {
      badge: "الطيران العُماني · عضو تحالف oneworld الرسمي",
      title: "سافر بأناقة عُمانية إلى 20 وجهة عالمية",
      subtitle:
        "أسعار 30 يوماً شفافة، خرائط مقاعد دريملاينر التفاعلية، باقات مرنة ومكافآت سندباد الفورية.",
    },
    manage: {
      title: "إدارة الحجز وإعادة الحجز الذاتي عند الاضطرابات",
      subtitle:
        "استرجع حجزك برمز الحجز واسم العائلة لتعديل المواعيد، معالجة الاضطرابات، إضافة الأمتعة، الترقية بالأميال، فصل الحجز أو الاسترداد.",
      rlocPlaceholder: "مرجع الحجز (RLOC) مثال: WY7K9M",
      lastNamePlaceholder: "اسم العائلة للمسافر (مثال: ALBALUSHI)",
      retrieve: "استرجاع الحجز",
      exchangeTitle: "تغيير موعد الرحلة",
      confirmExchange: "احسب الفرق وأكّد التغيير",
      shopTitle: "الخدمات الإضافية والترقيات",
      refundTitle: "الاسترداد الطوعي ورصيد السفر",
    },
    checkin: {
      title: "إتمام إجراءات السفر وبطاقة الصعود الرقمية",
      subtitle:
        "اختر حجزا للتحقق من بيانات الجواز، إصدار بطاقات الأمتعة الرقمية وبطاقات الصعود بنظام IATA BCBP.",
      completeCheckIn: "إتمام السفر وإصدار بطاقات الصعود",
      undoCheckIn: "إلغاء إتمام السفر (محاكاة DCS)",
      addToWallet: "معاينة / تنزيل بطاقة المحفظة",
      printPdf: "طباعة / PDF",
    },
    status: {
      title: "حالة الرحلات وجدول 20 وجهة",
      subtitle: "بيانات جدول وبوابات تجريبية للقراءة فقط (محاكاة بدون اتصال حي بالنظام).",
      searchPlaceholder: "ابحث برقم الرحلة (WY 101) أو المدينة...",
    },
    sindbad: {
      title: "بوابة برنامج الولاء سندباد",
      subtitle: "تتبع الفئة، احسب الأميال، اجمع أميال العائلة، طالب بالأميال المفقودة واستبدل المكافآت.",
      retroTitle: "المطالبة بالأميال المفقودة",
      familyTitle: "تجميع أميال العائلة والأسرة",
      catalogTitle: "كتالوج استبدال المكافآت",
    },
    darkSite: {
      title: "الطيران العُماني · بوابة تنبيهات السفر الطارئة",
      subtitle: "وضع الموقع الطارئ خفيف الوزن عالي التوافر (نموذج تجريبي)",
      exit: "الخروج من الوضع الطارئ",
      advisoryHeading: "تحديث تشغيلي — تنبيه الأحوال الجوية في أجواء الخليج",
      statusHeading: "التحقق من حالة الرحلة (بيانات محاكاة)",
      directoryHeading: "دليل المساعدة الطارئة على مدار الساعة",
    },
  },
} as const;

export function t(lang: AppLang) {
  return UI_TEXT[lang];
}
