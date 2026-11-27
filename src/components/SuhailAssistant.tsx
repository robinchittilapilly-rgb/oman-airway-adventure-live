import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { useIBE } from "../context/IBEContext";
import { OMAN_AIR_20_ROUTES, formatMoney } from "../data/omanAirRoutes";
import { bffClient } from "../lib/bff-client";
import { Button } from "./ui/button";

interface ChatMsg {
  role: "assistant" | "user";
  text: string;
  meta?: string;
  action?: { label: string; onClick: () => void };
}

/**
 * FR-7: Conversational GenAI Assistant ("Suhail AI") wired to POST /api/bff/v1/ai/chat
 * (Gemini / BFF domain tools) with seamless local fallback.
 */
export function SuhailAssistant() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const { currency, sindbadTier, setLang, lang, bffConnected } = useIBE();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Marhaba! I'm Suhail, your Oman Air GenAI concierge. Ask me about live route fares, award flights, promo codes, baggage rules, or IRROPS rebooking.",
    },
  ]);

  const handleSend = async (preset?: string) => {
    const q = (preset ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);

    if (bffConnected) {
      setLoading(true);
      try {
        const res = await bffClient.chatSuhail(q, lang);
        const tools = res.toolCallsExecuted.map((t) => t.name).join(", ");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: res.reply,
            meta: `${res.provider === "gemini" ? "Gemini LLM" : "BFF Tool Engine"} · ${tools}`,
            ...(res.suggestedAction
              ? {
                  action: {
                    label: res.suggestedAction.label,
                    onClick: () => {
                      setOpen(false);
                      void navigate({ to: res.suggestedAction!.route });
                    },
                  },
                }
              : {}),
          },
        ]);
        return;
      } catch {
        // Degrade gracefully to local fallback below
      } finally {
        setLoading(false);
      }
    }

    const lower = q.toLowerCase();
    let reply: ChatMsg = {
      role: "assistant",
      text: "Try asking about routes like London, Bangkok, or Salalah, promo code OMAN2026 (15% off), or disrupted booking WY4D2X.",
      meta: "Offline Demo Fallback",
    };

    if (lower.includes("promo") || lower.includes("discount")) {
      reply = {
        role: "assistant",
        text: "Active Oman Air promo codes: OMAN2026 (15% off), SINBAD10 (10% off), and GENZ20 (20% off). Enter them directly in the Flight Search bar!",
        meta: "Offline Demo Fallback",
      };
    } else if (lower.includes("arabic") || lower.includes("عربي")) {
      reply = {
        role: "assistant",
        text: "Switching the booking engine to Arabic (RTL) right now.",
        action: { label: "Switch to العربية", onClick: () => setLang("ar") },
      };
    } else if (
      lower.includes("wy4d2x") ||
      lower.includes("cancel") ||
      lower.includes("disrupt") ||
      lower.includes("rebook")
    ) {
      reply = {
        role: "assistant",
        text: "PNR WY4D2X (MCT → DXB) has a weather disruption waiver active. You can rebook for free or claim an instant hotel/refreshment voucher.",
        action: {
          label: "Open Manage My Booking",
          onClick: () => {
            setOpen(false);
            void navigate({ to: "/manage" });
          },
        },
      };
    } else if (lower.includes("bag") || lower.includes("gold") || lower.includes("sindbad")) {
      reply = {
        role: "assistant",
        text: `As a Sindbad ${sindbadTier} member, you receive ${sindbadTier === "Gold" ? "+15 kg extra baggage, complimentary seat selection & Majan Lounge" : sindbadTier === "Silver" ? "+10 kg extra baggage & Priority Boarding" : "4 Sindbad miles per USD spent"}.`,
        action: {
          label: "View Sindbad Portal",
          onClick: () => {
            setOpen(false);
            void navigate({ to: "/sindbad" });
          },
        },
      };
    } else {
      const routeMatch = OMAN_AIR_20_ROUTES.find(
        (r) =>
          lower.includes(r.destination.toLowerCase()) ||
          lower.includes(r.id.toLowerCase()) ||
          (r.destination === "LHR" && lower.includes("london")) ||
          (r.destination === "DXB" && lower.includes("dubai")) ||
          (r.destination === "BKK" && lower.includes("bangkok")) ||
          (r.destination === "SLL" && lower.includes("salalah")),
      );
      if (routeMatch) {
        reply = {
          role: "assistant",
          text: `Oman Air flies ${routeMatch.origin} → ${routeMatch.destination} (${routeMatch.flightNumber}) on a ${routeMatch.aircraft}. 30-day fares start from ${formatMoney(routeMatch.baseEcoOMR, currency)} in Economy Super Saver.`,
          action: {
            label: "Go to Flight Search",
            onClick: () => {
              setOpen(false);
              void navigate({ to: "/" });
            },
          },
        };
      }
    }

    setMessages((prev) => [...prev, reply]);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
          aria-label="Open Suhail AI travel assistant"
        >
          <Sparkles className="h-4 w-4 text-gold" />
          <span>{lang === "ar" ? "مساعد سهيل" : "Suhail AI"}</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Suhail AI Concierge"
          className="fixed bottom-5 end-5 z-50 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between bg-teal-deep px-4 py-3 text-teal-deep-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-gold" />
              <div>
                <p className="font-display text-sm font-bold">Suhail AI Concierge</p>
                <p className="text-xs opacity-85">
                  {bffConnected ? "BFF Gemini + Domain Tools" : "Offline Tool Preview"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-md p-1 hover:bg-teal-deep-foreground/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            aria-live="polite"
            className="flex max-h-72 flex-col gap-2.5 overflow-y-auto p-3 text-sm"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[88%] rounded-xl px-3 py-2 ${
                  m.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted text-foreground"
                }`}
              >
                <p>{m.text}</p>
                {m.meta && <p className="mt-1 text-[11px] opacity-75">{m.meta}</p>}
                {m.action && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 h-7 text-xs"
                    onClick={m.action.onClick}
                  >
                    {m.action.label}
                  </Button>
                )}
              </div>
            ))}
            {loading && (
              <div className="self-start rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                Consulting BFF tools...
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-border bg-muted/40 px-3 py-2">
            {["London fares", "Promo codes", "Rebook WY4D2X"].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void handleSend(chip)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary"
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2 border-t border-border p-2.5"
          >
            <label htmlFor="suhail-chat-input" className="sr-only">
              Ask Suhail AI
            </label>
            <input
              id="suhail-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Suhail AI..."
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading}
              className="h-9 w-9 shrink-0"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
