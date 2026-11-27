import type { AppLang, BffErrorPayload } from "../types";

const ERROR_CATALOG: Record<string, { en: string; ar: string; retryable: boolean }> = {
  ERR_404_INV_CLASS: {
    en: "This seat or fare class is no longer available. Please pick another flight or date.",
    ar: "هذه الدرجة أو المقعد لم يعد متاحاً. يرجى اختيار رحلة أو تاريخ آخر.",
    retryable: true,
  },
  ERR_404_PNR: {
    en: "No matching booking found for that reference and passenger last name.",
    ar: "لم يتم العثور على حجز مطابق لرمز الحجز واسم العائلة.",
    retryable: false,
  },
  ERR_HOLD_EXPIRED: {
    en: "Your fare hold period has expired. Please start a fresh flight search.",
    ar: "انتهت مهلة تثبيت السعر. يرجى بدء بحث جديد.",
    retryable: false,
  },
  ERR_RATE_LIMIT: {
    en: "Too many search requests in a short window. Please pause a moment and try again.",
    ar: "عدد طلبات البحث كبير جداً. يرجى الانتظار لحظة ثم المحاولة مجدداً.",
    retryable: true,
  },
  ERR_VALIDATION: {
    en: "Please verify passenger details, age requirements, and travel fields.",
    ar: "يرجى التحقق من بيانات المسافرين ومتطلبات العمر وحقول السفر.",
    retryable: false,
  },
  ERR_AUTH_REQUIRED: {
    en: "Please sign in to your Sindbad account to complete this loyalty action.",
    ar: "يرجى تسجيل الدخول إلى حساب سندباد لإتمام هذه العملية.",
    retryable: false,
  },
  ERR_FORBIDDEN: {
    en: "You are not authorized to view or modify this booking or resource.",
    ar: "غير مصرح لك بعرض هذا الحجز أو تعديله.",
    retryable: false,
  },
  ERR_CONFLICT: {
    en: "A request with this Idempotency-Key is already in progress or used a different payload.",
    ar: "يوجد طلب مطابق قيد المعالجة بالفعل أو ببيانات مختلفة.",
    retryable: true,
  },
  ERR_INSUFFICIENT_MILES: {
    en: "Your Sindbad miles balance is insufficient for this selection.",
    ar: "رصيد أميال سندباد غير كافٍ لإتمام هذا الاختيار.",
    retryable: false,
  },
  ERR_NON_REFUNDABLE: {
    en: "Economy Super Saver fares are non-refundable to card; Travel Bank tax credit is available.",
    ar: "تذاكر الدرجة التوفيرية غير قابلة للاسترداد النقدي؛ يتوفر رصيد ضريبي في محفظة السفر.",
    retryable: false,
  },
  ERR_CHECKIN_INHIBITED: {
    en: "Online check-in is unavailable for this booking (check SSR UMNR or ticket status).",
    ar: "إتمام السفر الإلكتروني غير متاح لهذا الحجز (تحقق من حالة التذكرة أو طلبات الخدمة الخاصة).",
    retryable: false,
  },
  ERR_RETRO_NOT_ELIGIBLE: {
    en: "This PNR was not found in the eligible unclaimed flight ledger.",
    ar: "لم يتم العثور على رمز الحجز ضمن الرحلات المؤهلة للمطالبة بالأميال.",
    retryable: false,
  },
  ERR_INTERNAL: {
    en: "A temporary service error occurred while processing your request.",
    ar: "حدث خطأ مؤقت أثناء معالجة طلبك. يرجى المحاولة لاحقاً.",
    retryable: true,
  },
};

export class BffAppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly overrideMessage?: string,
  ) {
    super(overrideMessage ?? code);
  }
}

/**
 * Intercepts technical PSS/adapter codes and translates them into friendly, localized messages (FR-46).
 */
export function translateBffError(
  code: string,
  lang: AppLang = "en",
  overrideMessage?: string,
): BffErrorPayload {
  const entry = ERROR_CATALOG[code] ?? ERROR_CATALOG["ERR_INTERNAL"]!;
  return {
    code,
    message: overrideMessage ?? entry[lang],
    retryable: entry.retryable,
    traceId: `bff-${Math.random().toString(36).slice(2, 10)}`,
  };
}
