import { AIRPORTS, OMAN_AIR_20_ROUTES, findRouteForPair } from "../../src/data/omanAirRoutes";
import { PROMO_CODES, calculateSindbadMiles } from "../../src/lib/ibe-rules";
import type { PssAdapter } from "../adapters/pssAdapter";
import type { BffSessionRecord } from "../stores/sessionStore";
import type { AppLang, BffAiChatResponse } from "../types";
import type { BffCmsService } from "./cmsService";

interface ToolTrace {
  name: string;
  summary: string;
}

/**
 * GenAI Suhail Conversational AI Service (FR-7, L1/L2 GenAI / LLM provider).
 * Executes bounded server-side domain tools (searchFlights, flightStatus, promoLookup, loyaltyTier)
 * and calls Gemini (`GEMINI_API_KEY`) when configured, with deterministic tool-backed synthesis fallback.
 */
export class SuhailAiService {
  constructor(
    private readonly pss: PssAdapter,
    private readonly cms: BffCmsService,
  ) {}

  private async runDomainTools(message: string, session: BffSessionRecord) {
    const lower = message.toLowerCase();
    const traces: ToolTrace[] = [];
    const contextFacts: string[] = [];
    let suggestedAction: BffAiChatResponse["suggestedAction"];

    const cmsState = await this.cms.getState();

    if (cmsState.darkSiteActive) {
      traces.push({ name: "get_cms_advisory", summary: "Dark Site travel advisory active" });
      contextFacts.push(`Active Travel Advisory: ${cmsState.darkSiteAdvisoryEn}`);
    }

    if (
      lower.includes("promo") ||
      lower.includes("discount") ||
      lower.includes("كود") ||
      lower.includes("خصم")
    ) {
      const activePromos = Object.entries(cmsState.dynamicPromos)
        .filter(([, p]) => p.active)
        .map(([code, p]) => `${code} (${p.discountPct}% - ${p.label})`);
      traces.push({ name: "get_active_promos", summary: `${activePromos.length} CMS promo codes` });
      contextFacts.push(`Active promo codes: ${activePromos.join("; ")}`);
    }

    if (
      lower.includes("wy4d2x") ||
      lower.includes("cancel") ||
      lower.includes("disrupt") ||
      lower.includes("rebook") ||
      lower.includes("اضطراب")
    ) {
      traces.push({ name: "check_irrops_policy", summary: "Retrieved zero-fee IRROPS options" });
      contextFacts.push(
        "IRROPS self-service allows zero-fee rebooking onto alternative departures (e.g. WY 607 / WY 611) or instant Travel Bank credit (+OMR 25 care bonus) in Manage My Booking.",
      );
      suggestedAction = { label: "Open Manage My Booking", route: "/manage" };
    }

    if (
      lower.includes("bag") ||
      lower.includes("gold") ||
      lower.includes("sindbad") ||
      lower.includes("أميال") ||
      lower.includes("سندباد")
    ) {
      const sampleMiles = calculateSindbadMiles(200, session.user.tier);
      traces.push({
        name: "inspect_sindbad_tier",
        summary: `Tier=${session.user.tier}, signedIn=${session.user.signedIn}`,
      });
      contextFacts.push(
        `Current session tier: Sindbad ${session.user.tier} (${session.user.signedIn ? `${session.user.miles} miles available` : "Guest mode"}). OMR 200 eligible spend earns +${sampleMiles} miles.`,
      );
      if (!suggestedAction) suggestedAction = { label: "Open Sindbad Portal", route: "/sindbad" };
    }

    if (lower.includes("check") || lower.includes("boarding") || lower.includes("صعود")) {
      traces.push({
        name: "check_dcs_eligibility",
        summary: "Checked online check-in & IATA BCBP capability",
      });
      contextFacts.push(
        "Online check-in issues IATA M1 BCBP scannable QR boarding passes and 10-digit Oman Air (0910) bag tags.",
      );
      if (!suggestedAction) suggestedAction = { label: "Go to Online Check-In", route: "/checkin" };
    }

    // Route lookup across all 20 routes / city names
    const matchedAirport = AIRPORTS.find(
      (a) =>
        lower.includes(a.code.toLowerCase()) ||
        lower.includes(a.city.toLowerCase().split(" ")[0] ?? a.city.toLowerCase()),
    );
    const routeMatch =
      matchedAirport && matchedAirport.code !== "MCT"
        ? findRouteForPair("MCT", matchedAirport.code)
        : OMAN_AIR_20_ROUTES.find((r) => lower.includes(r.flightNumber.toLowerCase()));

    if (routeMatch) {
      const r = "route" in routeMatch ? routeMatch.route : routeMatch;
      const dateISO = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const searchRes = await this.pss.searchFlights(
        r.origin,
        r.destination,
        dateISO,
        session.internalPssToken,
      );
      const lowest = Math.min(
        ...searchRes.calendar.filter((d) => !d.soldOut).map((d) => d.pricesOMR.ECO_SAVER),
      );
      traces.push({ name: "pss_search_flights", summary: `${r.id} low=OMR ${lowest}` });
      contextFacts.push(
        `Route ${r.origin} -> ${r.destination} (${r.flightNumber}, ${r.aircraft}): 30-day Economy Super Saver from OMR ${lowest}, taxes OMR ${r.taxesOMR}, Studio available=${r.hasStudio}.`,
      );
      if (!suggestedAction) suggestedAction = { label: "Search Flights", route: "/" };
    }

    if (traces.length === 0) {
      const defaultPromos = Object.keys(PROMO_CODES).join(", ");
      traces.push({
        name: "cms_directory_overview",
        summary: `20 routes, promos: ${defaultPromos}`,
      });
      contextFacts.push(
        `Oman Air operates 20 curated routes from Muscat (MCT), supports Award Bookings with Sindbad Miles, 24h/48h Hold My Fare, and active promo codes (${defaultPromos}).`,
      );
    }

    return { traces, contextFacts, suggestedAction };
  }

  async chat(params: {
    message: string;
    lang: AppLang;
    session: BffSessionRecord;
  }): Promise<BffAiChatResponse> {
    const { traces, contextFacts, suggestedAction } = await this.runDomainTools(
      params.message,
      params.session,
    );
    const apiKey = process.env["GEMINI_API_KEY"]?.trim();

    if (apiKey) {
      try {
        const model = process.env["GEMINI_MODEL"]?.trim() || "gemini-2.5-flash";
        const systemPrompt =
          `You are Suhail AI, Oman Air's official concierge inside the IBE Experience API. Respond concisely in ${
            params.lang === "ar" ? "Arabic" : "English"
          }. ONLY state factual fares, routes, promo codes, and rules grounded in these verified BFF tool outputs:\n` +
          contextFacts.map((f) => `- ${f}`).join("\n");

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: params.message }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 320 },
            }),
          },
        );

        if (res.ok) {
          const json = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return {
              reply: text,
              provider: "gemini",
              toolCallsExecuted: traces,
              suggestedAction,
            };
          }
        }
      } catch {
        // Gracefully degrade to grounded tool synthesis below
      }
    }

    const fallbackIntro =
      params.lang === "ar"
        ? "مرحباً! إليك المعلومات الموثّقة من نظام الطيران العُماني:"
        : "Marhaba! Based on live Oman Air BFF records:";
    return {
      reply: `${fallbackIntro} ${contextFacts.join(" ")}`,
      provider: "tool-fallback",
      toolCallsExecuted: traces,
      suggestedAction,
    };
  }
}
