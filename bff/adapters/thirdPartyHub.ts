import type { SindbadTier } from "../../src/data/ancillariesAndSeats";
import type { PointOfSale } from "../types";

export interface InsuranceQuote {
  provider: string;
  basePriceOMR: number;
  effectivePriceOMR: number;
  overlayTag?: string;
}

export interface PartnerSsoToken {
  partner: string;
  handoffToken: string;
  redirectUrl: string;
  expiresAt: string;
}

/**
 * Centralized 3rd-party integration hub (FR-52, FR-119, FR-121).
 * Keeps vendor keys, dynamic price overlays, and partner SSO handoffs strictly inside the BFF.
 */
export class ThirdPartyIntegrationHub {
  quoteInsurance(params: { pos: PointOfSale; tier: SindbadTier; isLongHaul: boolean }): InsuranceQuote {
    const basePriceOMR = params.isLongHaul ? 14 : 10;
    let multiplier = 1.0;
    let overlayTag: string | undefined;

    if (params.tier === "Gold") {
      multiplier = 0.85;
      overlayTag = "15% Gold Overlay";
    } else if (params.pos === "GB" || params.pos === "EU") {
      multiplier = 1.1;
      overlayTag = "EU/UK Regional Cover";
    }

    return {
      provider: "Allianz Travel (Demo Hub)",
      basePriceOMR,
      effectivePriceOMR: Math.round(basePriceOMR * multiplier),
      ...(overlayTag ? { overlayTag } : {}),
    };
  }

  issuePartnerSsoHandoff(partner: string, memberId?: string): PartnerSsoToken {
    const token = `sso_${Math.random().toString(36).slice(2, 12)}`;
    return {
      partner,
      handoffToken: token,
      redirectUrl: `https://partners.omanair.example/${encodeURIComponent(partner)}?token=${token}${memberId ? `&member=${encodeURIComponent(memberId)}` : ""}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  authorizePaymentIntent(params: {
    amountOMR: number;
    method: string;
    sessionId: string;
  }): { approved: boolean; gatewayRef: string; riskScore: number } {
    return {
      approved: true,
      gatewayRef: `PG-${Date.now().toString(36).toUpperCase()}`,
      riskScore: 12,
    };
  }
}
