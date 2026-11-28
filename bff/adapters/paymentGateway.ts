import { randomUUID } from "node:crypto";
import type { CacheStore } from "../stores/cacheStore";
import { BffAppError } from "../middleware/errorTranslator";

export interface TokenizedCardRecord {
  paymentToken: string;
  scheme: "Visa" | "Mastercard" | "AMEX" | "Diners" | "JCB";
  maskedPan: string;
  expiry: string;
  cardholderName: string;
  accertifyRiskScore: number;
  threeDsRequired: boolean;
  threeDsVerified: boolean;
}

export interface ThreeDsChallengeSession {
  threeDsTransId: string;
  paymentToken: string;
  acsUrl: string;
  otpHint: string;
  verified: boolean;
  cavv?: string | undefined;
  eci?: string | undefined;
}

/**
 * PCI-DSS L1 SAQ-A Payment Tokenization, Accertify Risk Scoring & EMV 3DS2 Sandbox Hub
 * (FR-92, FR-96, FR-97, FR-100). Never persists raw PAN or CVV on order/booking records.
 */
export class PaymentGatewaySandbox {
  constructor(private readonly cache: CacheStore) {}

  async tokenizeCard(params: {
    cardLast4: string;
    expiry: string;
    cardholderName: string;
    scheme: "Visa" | "Mastercard" | "AMEX" | "Diners" | "JCB";
    amountOMR: number;
  }): Promise<TokenizedCardRecord> {
    if (!/^\d{4}$/.test(params.cardLast4)) {
      throw new BffAppError("ERR_VALIDATION", 400, "Invalid tokenized last 4 digits.");
    }
    const token = `tok_wy_${randomUUID().slice(0, 14)}`;
    // Simulate Accertify pre-auth risk scoring (higher amount or non-default card -> step-up 3DS2)
    const accertifyRiskScore = params.amountOMR >= 100 ? 34 : 11;
    const threeDsRequired = params.amountOMR >= 80;
    const record: TokenizedCardRecord = {
      paymentToken: token,
      scheme: params.scheme,
      maskedPan: `${params.scheme} •••• ${params.cardLast4}`,
      expiry: params.expiry,
      cardholderName: params.cardholderName.trim().toUpperCase(),
      accertifyRiskScore,
      threeDsRequired,
      threeDsVerified: !threeDsRequired,
    };
    await this.cache.set(`paytok:${token}`, record, 900);
    return record;
  }

  async initiateThreeDs2(paymentToken: string): Promise<ThreeDsChallengeSession> {
    const tok = await this.cache.get<TokenizedCardRecord>(`paytok:${paymentToken}`);
    if (!tok) {
      throw new BffAppError("ERR_VALIDATION", 404, "Payment token invalid or expired.");
    }
    const threeDsTransId = `3ds2_${randomUUID().slice(0, 12)}`;
    const challenge: ThreeDsChallengeSession = {
      threeDsTransId,
      paymentToken,
      acsUrl: "https://acs-sandbox.omanair.example/3ds2/challenge",
      otpHint: "123456",
      verified: false,
    };
    await this.cache.set(`3ds2:${threeDsTransId}`, challenge, 600);
    return challenge;
  }

  async verifyThreeDs2Challenge(
    threeDsTransId: string,
    otpCode: string,
  ): Promise<ThreeDsChallengeSession> {
    const challenge = await this.cache.get<ThreeDsChallengeSession>(`3ds2:${threeDsTransId}`);
    if (!challenge) {
      throw new BffAppError("ERR_VALIDATION", 404, "3DS2 challenge session expired or not found.");
    }
    if (otpCode.trim() !== "123456") {
      throw new BffAppError(
        "ERR_VALIDATION",
        400,
        "Invalid 3DS2 OTP challenge response (sandbox OTP is 123456).",
      );
    }
    const verified: ThreeDsChallengeSession = {
      ...challenge,
      verified: true,
      cavv: `CAVV_${randomUUID().slice(0, 10).toUpperCase()}`,
      eci: "05",
    };
    await this.cache.set(`3ds2:${threeDsTransId}`, verified, 600);

    const tok = await this.cache.get<TokenizedCardRecord>(`paytok:${challenge.paymentToken}`);
    if (tok) {
      tok.threeDsVerified = true;
      await this.cache.set(`paytok:${challenge.paymentToken}`, tok, 900);
    }
    return verified;
  }

  async assertTokenAuthorized(paymentToken: string): Promise<TokenizedCardRecord> {
    const tok = await this.cache.get<TokenizedCardRecord>(`paytok:${paymentToken}`);
    if (!tok) {
      throw new BffAppError(
        "ERR_VALIDATION",
        400,
        "Hosted payment token expired. Please re-enter card.",
      );
    }
    if (tok.threeDsRequired && !tok.threeDsVerified) {
      throw new BffAppError(
        "ERR_AUTH_REQUIRED",
        402,
        "EMV 3DS2 ACS challenge must be verified before payment.",
      );
    }
    return tok;
  }
}
