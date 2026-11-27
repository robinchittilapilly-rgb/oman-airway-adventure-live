import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CacheStore } from "../stores/cacheStore";
import type { BffSessionRecord, SessionAndCartStore } from "../stores/sessionStore";
import { BffAppError } from "../middleware/errorTranslator";

interface PendingPkceTransaction {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  sessionId: string;
  requestedRole?: "member" | "admin";
  createdAt: string;
}

function base64UrlSha256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * OAuth2 Authorization Code + PKCE (S256) flow service (FR-23, L1 Edge/SSO).
 * Supports external OIDC Identity Providers when OIDC_ISSUER_URL + OIDC_CLIENT_ID are configured,
 * and standard PKCE code-challenge verification for sandbox/demo SSO testing.
 */
export class OidcPkceService {
  constructor(
    private readonly cache: CacheStore,
    private readonly store: SessionAndCartStore,
  ) {}

  async startAuthorization(params: {
    sessionId: string;
    redirectUri: string;
    requestedRole?: "member" | "admin" | undefined;
  }): Promise<{
    state: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    authorizationUrl: string;
    mode: "external-oidc" | "local-pkce-sandbox";
    /** Returned in sandbox mode so the UI/tests can complete the PKCE S256 verifier exchange cleanly. */
    sandboxCodeVerifier?: string | undefined;
    sandboxAuthCode?: string | undefined;
  }> {
    const state = randomBytes(16).toString("hex");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = base64UrlSha256(codeVerifier);

    const tx: PendingPkceTransaction = {
      state,
      codeVerifier,
      codeChallenge,
      redirectUri: params.redirectUri,
      sessionId: params.sessionId,
      requestedRole: params.requestedRole ?? "member",
      createdAt: new Date().toISOString(),
    };
    await this.cache.set(`oidc:tx:${state}`, tx, 300);

    const issuer = process.env["OIDC_ISSUER_URL"]?.trim();
    const clientId = process.env["OIDC_CLIENT_ID"]?.trim();

    if (issuer && clientId) {
      const url = new URL(`${issuer.replace(/\/+$/, "")}/authorize`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", params.redirectUri);
      url.searchParams.set("scope", "openid profile email sindbad");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return {
        state,
        codeChallenge,
        codeChallengeMethod: "S256",
        authorizationUrl: url.toString(),
        mode: "external-oidc",
      };
    }

    const sandboxAuthCode = `oidc_code_${randomUUID().slice(0, 12)}`;
    await this.cache.set(
      `oidc:code:${sandboxAuthCode}`,
      { state, issuedAt: new Date().toISOString() },
      300,
    );

    return {
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
      authorizationUrl: `${params.redirectUri}${params.redirectUri.includes("?") ? "&" : "?"}code=${sandboxAuthCode}&state=${state}`,
      mode: "local-pkce-sandbox",
      sandboxCodeVerifier: codeVerifier,
      sandboxAuthCode,
    };
  }

  async completeCallback(params: {
    session: BffSessionRecord;
    state: string;
    code: string;
    codeVerifier: string;
    memberName?: string | undefined;
    tier?: "Blue" | "Silver" | "Gold" | undefined;
    role?: "member" | "admin" | undefined;
  }): Promise<BffSessionRecord> {
    const tx = await this.cache.get<PendingPkceTransaction>(`oidc:tx:${params.state}`);
    if (!tx) {
      throw new BffAppError("ERR_AUTH_REQUIRED", 401, "OIDC PKCE state expired or invalid.");
    }
    await this.cache.del(`oidc:tx:${params.state}`);

    const computedChallenge = base64UrlSha256(params.codeVerifier);
    if (computedChallenge !== tx.codeChallenge) {
      throw new BffAppError(
        "ERR_AUTH_REQUIRED",
        401,
        "PKCE code_verifier mismatch (S256 verification failed).",
      );
    }

    const tokenEndpoint = process.env["OIDC_TOKEN_URL"]?.trim();
    const clientId = process.env["OIDC_CLIENT_ID"]?.trim();
    if (tokenEndpoint && clientId) {
      const tokenRes = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: params.code,
          redirect_uri: tx.redirectUri,
          client_id: clientId,
          code_verifier: params.codeVerifier,
        }),
      });
      if (!tokenRes.ok) {
        throw new BffAppError(
          "ERR_AUTH_REQUIRED",
          401,
          "External OIDC authorization_code exchange failed.",
        );
      }
    } else {
      const storedCode = await this.cache.get<{ state: string }>(`oidc:code:${params.code}`);
      if (!storedCode || storedCode.state !== params.state) {
        throw new BffAppError("ERR_AUTH_REQUIRED", 401, "Invalid or reused authorization code.");
      }
      await this.cache.del(`oidc:code:${params.code}`);
    }

    const isAdmin = (params.role ?? tx.requestedRole) === "admin";
    const cleanName = params.memberName?.trim() || "Tariq Al-Balushi";
    const isTariq = cleanName.toLowerCase().includes("tariq");

    params.session.user.signedIn = true;
    params.session.user.role = isAdmin ? "admin" : "member";
    params.session.user.authProvider = "oidc";
    params.session.user.memberName = cleanName;
    params.session.user.memberId = isTariq
      ? "mem-tariq-01"
      : `mem-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    params.session.user.sindbadNo = isTariq ? "SB-8841209" : "SB-9910455";
    params.session.user.tier = params.tier ?? (isTariq ? "Gold" : "Silver");
    params.session.user.miles = isTariq
      ? Math.max(params.session.user.miles, 68450)
      : Math.max(params.session.user.miles, 24500);
    params.session.user.tierPoints = isTariq
      ? Math.max(params.session.user.tierPoints, 420)
      : Math.max(params.session.user.tierPoints, 190);
    params.session.user.travelBankOMR = isTariq
      ? Math.max(params.session.user.travelBankOMR, 65)
      : params.session.user.travelBankOMR;

    await this.store.saveSession(params.session);
    return params.session;
  }
}
