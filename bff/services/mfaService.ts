import { createHmac } from "node:crypto";

const DEFAULT_DEV_TOTP_KEY = "OMANAIRADMINMFADEVKEY2026";

function base32ToBuffer(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * RFC 6238 Time-based One-Time Password (TOTP) helper for RBAC + MFA Admin plane (FR-35, L1 NFR).
 */
export function generateTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
): string {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const key = base32ToBuffer(secretBase32);
  const hmac = createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

export function getAdminTotpSecret(): string {
  return process.env["ADMIN_TOTP_SECRET"]?.trim() || DEFAULT_DEV_TOTP_KEY;
}

export function verifyAdminTotp(code: string, timestampMs = Date.now()): boolean {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = getAdminTotpSecret();
  for (const drift of [-30_000, 0, 30_000]) {
    if (generateTotpCode(secret, timestampMs + drift) === clean) {
      return true;
    }
  }
  return false;
}
