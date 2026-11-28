import { AIRPORTS, findRouteForPair, get30DayFareRepository } from "../../src/data/omanAirRoutes";
import { computeExchangeQuote } from "../../src/lib/ibe-rules";
import type { PssAdapter } from "../adapters/pssAdapter";
import { canSessionAccessBooking } from "../middleware/authSession";
import { BffAppError } from "../middleware/errorTranslator";
import type { BffSessionRecord, SessionAndCartStore } from "../stores/sessionStore";
import type { AppLang, BffAiChatResponse } from "../types";
import { recordAudit } from "./auditService";
import type { BffCmsService } from "./cmsService";

interface ToolTrace {
  name: string;
  summary: string;
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /reveal\s+(your\s+)?(system\s+prompt|secrets?|env|token)/i,
  /internalPssToken|BFF_SESSION_SECRET|GEMINI_API_KEY/i,
  /act\s+as\s+(root|admin|system)|override\s+role/i,
  /<\s*script\b|javascript:/i,
];

export function detectPromptInjection(raw: string): string | null {
  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(raw)) return pat.source;
  }
  return null;
}

const GEMINI_FUNCTION_DECLARATIONS = [
  {
    name: "searchFlights",
    description:
      "Search Oman Air flights and 30-day lowest OMR fares for an origin and destination IATA code.",
    parameters: {
      type: "OBJECT",
      properties: {
        origin: { type: "STRING", description: "3-letter IATA origin code, e.g. MCT" },
        destination: {
          type: "STRING",
          description: "3-letter IATA destination code, e.g. LHR, DXB, BKK",
        },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "quoteExchange",
    description:
      "Compute a date-exchange fee and fare difference quote for an authorized PNR RLOC.",
    parameters: {
      type: "OBJECT",
      properties: {
        rloc: {
          type: "STRING",
          description: "6-character Oman Air booking reference (e.g. WY7K9M)",
        },
        newDate: { type: "STRING", description: "Requested new departure date YYYY-MM-DD" },
      },
      required: ["rloc", "newDate"],
    },
  },
  {
    name: "checkIrrops",
    description:
      "Check disruption status and fee-waived IRROPS options for an authorized PNR RLOC.",
    parameters: {
      type: "OBJECT",
      properties: {
        rloc: {
          type: "STRING",
          description: "6-character Oman Air booking reference (e.g. WY4D2X)",
        },
      },
      required: ["rloc"],
    },
  },
  {
    name: "checkStatus",
    description:
      "Check live schedule, terminal, gate, and disruption status across the 20 Oman Air routes.",
    parameters: {
      type: "OBJECT",
      properties: {
        flightQuery: {
          type: "STRING",
          description: "Flight number (e.g. WY 603) or city/airport code",
        },
      },
      required: ["flightQuery"],
    },
  },
];

/**
 * GenAI Suhail Conversational AI Service (FR-7, L1/L2 GenAI / LLM provider).
 * Executes structured Gemini function-calling tools strictly scoped to authenticated/authorized
 * session context, protected by prompt-injection guardrails and audit logging.
 */
export class SuhailAiService {
  constructor(
    private readonly pss: PssAdapter,
    private readonly cms: BffCmsService,
    private readonly store: SessionAndCartStore,
  ) {}

  private async executeStructuredTool(
    name: string,
    args: Record<string, unknown>,
    session: BffSessionRecord,
  ): Promise<{
    result: Record<string, unknown>;
    trace: ToolTrace;
    suggestedRoute?: "/" | "/manage" | "/checkin" | "/status" | "/sindbad";
  }> {
    if (name === "searchFlights") {
      const origin = String(args["origin"] ?? "MCT")
        .trim()
        .toUpperCase()
        .slice(0, 3);
      const destRaw = String(args["destination"] ?? "LHR")
        .trim()
        .toUpperCase();
      const airport = AIRPORTS.find(
        (a) => a.code === destRaw || a.city.toUpperCase().includes(destRaw),
      );
      const destination = airport?.code ?? destRaw.slice(0, 3);
      const dateISO = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const match = findRouteForPair(origin, destination);
      if (!match) {
        return {
          trace: { name: "searchFlights", summary: `${origin}->${destination} not found` },
          result: {
            found: false,
            message: `No direct schedule found for ${origin} -> ${destination}.`,
          },
        };
      }
      const res = await this.pss.searchFlights(
        origin,
        destination,
        dateISO,
        session.internalPssToken,
      );
      const openDays = res.calendar.filter((d) => !d.soldOut);
      const lowest = Math.min(...openDays.map((d) => d.pricesOMR.ECO_SAVER));
      return {
        trace: { name: "searchFlights", summary: `${res.routeId} from OMR ${lowest}` },
        suggestedRoute: "/",
        result: {
          found: true,
          routeId: res.routeId,
          lowestEcoSaverOMR: lowest,
          taxesOMR: match.route.taxesOMR,
          aircraft: res.offers[0]?.aircraft,
          offersCount: res.offers.length,
        },
      };
    }

    if (name === "quoteExchange") {
      const rloc = String(args["rloc"] ?? "")
        .trim()
        .toUpperCase();
      const booking = rloc ? await this.store.getBooking(rloc) : null;
      if (!booking || !canSessionAccessBooking(session, booking)) {
        return {
          trace: { name: "quoteExchange", summary: `${rloc || "NONE"} denied (not authorized)` },
          suggestedRoute: "/manage",
          result: {
            authorized: false,
            error:
              "Booking access requires signed-in ownership or verification with RLOC + Passenger Last Name in Manage My Booking.",
          },
        };
      }
      const newDate = String(
        args["newDate"] ?? new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      );
      const cal = get30DayFareRepository(`${booking.origin}-${booking.destination}`);
      const oldDay = cal.find((d) => d.dateISO === booking.dateISO) ?? cal[0]!;
      const newDay = cal.find((d) => d.dateISO === newDate) ?? cal[0]!;
      const q = computeExchangeQuote({
        fareBrand: booking.fareBrand,
        oldFareOMR: oldDay.pricesOMR[booking.fareBrand],
        newFareOMR: newDay.pricesOMR[booking.fareBrand],
      });
      const paxCount = Math.max(1, booking.passengers.length);
      return {
        trace: {
          name: "quoteExchange",
          summary: `${rloc} -> ${newDate} total OMR ${q.totalDueOMR * paxCount}`,
        },
        suggestedRoute: "/manage",
        result: {
          authorized: true,
          rloc,
          newDate,
          totalDueOMR: q.totalDueOMR * paxCount,
          changeFeeOMR: q.changeFeeOMR * paxCount,
        },
      };
    }

    if (name === "checkIrrops") {
      const rloc = String(args["rloc"] ?? "")
        .trim()
        .toUpperCase();
      const booking = rloc ? await this.store.getBooking(rloc) : null;
      if (!booking || !canSessionAccessBooking(session, booking)) {
        return {
          trace: { name: "checkIrrops", summary: `${rloc || "NONE"} denied (not authorized)` },
          suggestedRoute: "/manage",
          result: {
            authorized: false,
            error:
              "Please retrieve the booking using RLOC and Passenger Last Name first to inspect IRROPS options.",
          },
        };
      }
      return {
        trace: { name: "checkIrrops", summary: `${rloc} status=${booking.status}` },
        suggestedRoute: booking.status === "DISRUPTED_CXL" ? "/manage" : "/checkin",
        result: {
          authorized: true,
          rloc: booking.rloc,
          status: booking.status,
          flightNumber: booking.flightNumber,
          disruptionNote: booking.disruptionNote ?? "Operating normally.",
          freeRebookOptions:
            booking.status === "DISRUPTED_CXL"
              ? ["WY 607 (14:15)", "WY 611 (19:40)", "Travel Bank +25 OMR"]
              : [],
        },
      };
    }

    // checkStatus
    const q = String(args["flightQuery"] ?? "")
      .trim()
      .toUpperCase();
    const routes = await this.pss.getFlightTimetable();
    const matches = routes
      .map((r, idx) => ({
        flightNumber: r.flightNumber,
        route: `${r.origin}->${r.destination}`,
        departureTime: r.departureTime,
        gate: `T1 · A${10 + (idx % 12)}`,
        status:
          r.flightNumber === "WY 603"
            ? "DISRUPTED (IRROPS)"
            : idx % 5 === 1
              ? "BOARDING"
              : "ON TIME",
      }))
      .filter((r) => !q || r.flightNumber.toUpperCase().includes(q) || r.route.includes(q))
      .slice(0, 3);
    return {
      trace: { name: "checkStatus", summary: `${matches.length} flight(s) matched` },
      suggestedRoute: "/status",
      result: { flights: matches },
    };
  }

  private inferFallbackTools(message: string): { name: string; args: Record<string, unknown> }[] {
    const lower = message.toLowerCase();
    const rlocMatch = message.toUpperCase().match(/\b(WY[A-Z0-9]{4})\b/);
    const calls: { name: string; args: Record<string, unknown> }[] = [];

    if (
      rlocMatch &&
      (lower.includes("exchange") || lower.includes("change") || lower.includes("date"))
    ) {
      calls.push({
        name: "quoteExchange",
        args: {
          rloc: rlocMatch[1],
          newDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        },
      });
    }
    if (
      rlocMatch ||
      lower.includes("irrop") ||
      lower.includes("cancel") ||
      lower.includes("disrupt") ||
      lower.includes("rebook")
    ) {
      calls.push({ name: "checkIrrops", args: { rloc: rlocMatch?.[1] ?? "WY4D2X" } });
    }
    if (
      lower.includes("status") ||
      lower.includes("gate") ||
      lower.includes("wy 603") ||
      lower.includes("wy101")
    ) {
      const flt = message.toUpperCase().match(/\bWY\s*\d{3}\b/)?.[0] ?? "WY 603";
      calls.push({ name: "checkStatus", args: { flightQuery: flt } });
    }

    const matchedAirport = AIRPORTS.find(
      (a) =>
        a.code !== "MCT" &&
        (lower.includes(a.code.toLowerCase()) ||
          lower.includes((a.city.split(" ")[0] ?? a.city).toLowerCase())),
    );
    if (
      matchedAirport ||
      lower.includes("fare") ||
      lower.includes("flight") ||
      lower.includes("book")
    ) {
      calls.push({
        name: "searchFlights",
        args: { origin: "MCT", destination: matchedAirport?.code ?? "LHR" },
      });
    }

    if (calls.length === 0) {
      calls.push({ name: "checkStatus", args: { flightQuery: "WY 101" } });
    }
    return calls;
  }

  async chat(params: {
    message: string;
    lang: AppLang;
    session: BffSessionRecord;
  }): Promise<BffAiChatResponse> {
    const cleanMsg = params.message.replace(/[\r\n\t]+/g, " ").trim();
    const injection = detectPromptInjection(cleanMsg);
    if (injection) {
      await recordAudit(this.store, {
        eventType: "AI_GUARDRAIL_TRIGGERED",
        actorSessionId: params.session.sessionId,
        actorMemberId: params.session.user.memberId,
        payload: { matchedRule: injection },
      });
      throw new BffAppError(
        "ERR_FORBIDDEN",
        403,
        params.lang === "ar"
          ? "تم حظر هذا الطلب بواسطة ضوابط الأمان الخاصة بمساعد سهيل."
          : "Request blocked by Suhail AI prompt-injection and session security guardrails.",
      );
    }

    const cmsState = await this.cms.getState();
    const apiKey = process.env["GEMINI_API_KEY"]?.trim();
    const traces: ToolTrace[] = [];
    let suggestedRoute: "/" | "/manage" | "/checkin" | "/status" | "/sindbad" | undefined;

    if (apiKey) {
      try {
        const model = process.env["GEMINI_MODEL"]?.trim() || "gemini-2.5-flash";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const systemInstruction = {
          parts: [
            {
              text: `You are Suhail AI, Oman Air's IBE concierge. Respond in ${params.lang === "ar" ? "Arabic" : "English"}. Always use the provided tools for fares, statuses, IRROPS, or booking quotes. Never fabricate booking data. Current authenticated user signedIn=${params.session.user.signedIn}, tier=${params.session.user.tier}.`,
            },
          ],
        };

        const contents: Record<string, unknown>[] = [{ role: "user", parts: [{ text: cleanMsg }] }];
        for (let turn = 0; turn < 3; turn++) {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction,
              tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
              contents,
              generationConfig: { temperature: 0.2, maxOutputTokens: 350 },
            }),
          });
          if (!res.ok) break;
          const json = (await res.json()) as {
            candidates?: {
              content?: {
                parts?: {
                  text?: string;
                  functionCall?: { name: string; args?: Record<string, unknown> };
                }[];
              };
            }[];
          };
          const parts = json.candidates?.[0]?.content?.parts ?? [];
          const fnCalls = parts.filter((p) => p.functionCall);
          if (fnCalls.length === 0) {
            const replyText = parts
              .map((p) => p.text ?? "")
              .join("")
              .trim();
            if (replyText) {
              return {
                reply: replyText,
                provider: "gemini",
                toolCallsExecuted: traces,
                ...(suggestedRoute
                  ? { suggestedAction: { label: "Continue in IBE", route: suggestedRoute } }
                  : {}),
              };
            }
            break;
          }

          contents.push({ role: "model", parts });
          const fnResponses = [];
          for (const part of fnCalls) {
            const call = part.functionCall!;
            const exec = await this.executeStructuredTool(
              call.name,
              call.args ?? {},
              params.session,
            );
            traces.push(exec.trace);
            if (!suggestedRoute && exec.suggestedRoute) suggestedRoute = exec.suggestedRoute;
            fnResponses.push({
              functionResponse: { name: call.name, response: exec.result },
            });
          }
          contents.push({ role: "function", parts: fnResponses });
        }
      } catch {
        // Degrade safely to local structured tool dispatch below
      }
    }

    const planned = this.inferFallbackTools(cleanMsg);
    const summaries: string[] = [];
    for (const p of planned) {
      const exec = await this.executeStructuredTool(p.name, p.args, params.session);
      traces.push(exec.trace);
      if (!suggestedRoute && exec.suggestedRoute) suggestedRoute = exec.suggestedRoute;
      summaries.push(`${exec.trace.name}: ${JSON.stringify(exec.result)}`);
    }

    const activePromos = Object.entries(cmsState.dynamicPromos)
      .filter(([, pr]) => pr.active)
      .map(([c, pr]) => `${c} (-${pr.discountPct}%)`)
      .join(", ");

    const reply =
      params.lang === "ar"
        ? `تم التحقق من أدوات النظام (${traces.map((t) => t.name).join("، ")}): ${summaries.join(" | ")}. العروض النشطة: ${activePromos}.`
        : `Verified via BFF structured tools (${traces.map((t) => t.name).join(", ")}): ${summaries.join(" | ")}. Active promos: ${activePromos}.`;

    const actionLabels: Record<NonNullable<typeof suggestedRoute>, string> = {
      "/": "Search Flights",
      "/manage": "Open Manage My Booking",
      "/checkin": "Go to Online Check-In",
      "/status": "View Flight Status",
      "/sindbad": "View Sindbad Portal",
    };

    return {
      reply,
      provider: "tool-fallback",
      toolCallsExecuted: traces,
      ...(suggestedRoute
        ? { suggestedAction: { label: actionLabels[suggestedRoute], route: suggestedRoute } }
        : {}),
    };
  }
}
