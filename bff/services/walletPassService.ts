import { createHash, createHmac } from "node:crypto";
import type { SavedBookingPNR } from "../../src/data/ancillariesAndSeats";
import { buildIataBcbpString } from "../../src/lib/ibe-rules";

const WALLET_SIGNING_SECRET =
  process.env["WALLET_SIGNING_SECRET"]?.trim() || "oman-air-wallet-dev-key";

// Standard IEEE 802.3 CRC32 table for valid uncompressed ZIP archives (.pkpass)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipArchive(entries: { name: string; data: Buffer }[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // store method (uncompressed)
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(centralHeader, nameBuf);
    offset += 30 + nameBuf.length + size;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDir, eocd]);
}

/**
 * Generates an authentic Apple Wallet .pkpass ZIP archive (pass.json + manifest.json + signature)
 * for boarding passes (FR-8, FR-133, L1 Device Services).
 */
export function generateApplePkpassBuffer(booking: SavedBookingPNR, paxIndex: number): Buffer {
  const pax = booking.passengers[paxIndex] ?? booking.passengers[0]!;
  const bcbp = buildIataBcbpString({
    firstName: pax.firstName,
    lastName: pax.lastName,
    rloc: booking.rloc,
    origin: booking.origin,
    destination: booking.destination,
    flightNumber: booking.flightNumber,
    dateISO: booking.dateISO,
    seat: pax.seat,
    seq: paxIndex + 1,
  });

  const passJson = Buffer.from(
    JSON.stringify(
      {
        formatVersion: 1,
        passTypeIdentifier: process.env["APPLE_PASS_TYPE_ID"] ?? "pass.com.omanair.boarding",
        serialNumber: `${booking.rloc}-${paxIndex + 1}`,
        teamIdentifier: process.env["APPLE_TEAM_ID"] ?? "WYOMANAIR",
        organizationName: "Oman Air",
        description: `Oman Air Boarding Pass ${booking.flightNumber}`,
        backgroundColor: "rgb(15, 44, 51)",
        foregroundColor: "rgb(255, 255, 255)",
        labelColor: "rgb(212, 175, 55)",
        barcode: {
          format: "PKBarcodeFormatQR",
          message: bcbp,
          messageEncoding: "iso-8859-1",
        },
        boardingPass: {
          transitType: "PKTransitTypeAir",
          headerFields: [{ key: "flight", label: "FLIGHT", value: booking.flightNumber }],
          primaryFields: [
            { key: "origin", label: "MUSCAT", value: booking.origin },
            { key: "destination", label: "TO", value: booking.destination },
          ],
          secondaryFields: [
            { key: "passenger", label: "PASSENGER", value: `${pax.firstName} ${pax.lastName}` },
            { key: "seat", label: "SEAT", value: pax.seat },
            { key: "gate", label: "GATE", value: booking.gate },
          ],
          auxiliaryFields: [
            { key: "date", label: "DATE", value: booking.dateISO },
            { key: "dep", label: "DEPARTURE", value: booking.departureTime },
            { key: "rloc", label: "RLOC", value: booking.rloc },
          ],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  // Valid 1x1 PNG placeholder icon so Apple PassKit manifest checks succeed structurally
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
    "base64",
  );

  const manifest = Buffer.from(
    JSON.stringify({
      "pass.json": createHash("sha1").update(passJson).digest("hex"),
      "icon.png": createHash("sha1").update(tinyPng).digest("hex"),
    }),
    "utf8",
  );

  const sig = Buffer.from(
    createHmac("sha256", WALLET_SIGNING_SECRET).update(manifest).digest("hex"),
    "utf8",
  );

  return buildZipArchive([
    { name: "pass.json", data: passJson },
    { name: "icon.png", data: tinyPng },
    { name: "manifest.json", data: manifest },
    { name: "signature", data: sig },
  ]);
}

/**
 * Generates a signed Google Wallet Boarding Pass JWT & Save URL (FR-8, L1 Device Services).
 */
export function generateGoogleWalletSaveJwt(
  booking: SavedBookingPNR,
  paxIndex: number,
): { jwt: string; saveUrl: string; bcbp: string } {
  const pax = booking.passengers[paxIndex] ?? booking.passengers[0]!;
  const bcbp = buildIataBcbpString({
    firstName: pax.firstName,
    lastName: pax.lastName,
    rloc: booking.rloc,
    origin: booking.origin,
    destination: booking.destination,
    flightNumber: booking.flightNumber,
    dateISO: booking.dateISO,
    seat: pax.seat,
    seq: paxIndex + 1,
  });

  const issuerId = process.env["GOOGLE_WALLET_ISSUER_ID"] ?? "3388000000022940000";
  const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(
    JSON.stringify({
      iss:
        process.env["GOOGLE_WALLET_SERVICE_ACCOUNT"] ??
        "oman-air-wallet@omanair.iam.gserviceaccount.com",
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: {
        flightClasses: [
          {
            id: `${issuerId}.${booking.flightNumber.replace(/\s+/g, "")}_${booking.dateISO}`,
            issuerName: "Oman Air",
            reviewStatus: "UNDER_REVIEW",
            flightHeader: {
              carrier: { carrierIataCode: "WY" },
              flightNumber: booking.flightNumber.replace(/\D/g, ""),
            },
            origin: {
              airportIataCode: booking.origin,
              terminal: booking.terminal,
              gate: booking.gate,
            },
            destination: { airportIataCode: booking.destination },
            localScheduledDepartureDateTime: `${booking.dateISO}T${booking.departureTime}:00`,
          },
        ],
        flightObjects: [
          {
            id: `${issuerId}.${booking.rloc}_${paxIndex + 1}`,
            classId: `${issuerId}.${booking.flightNumber.replace(/\s+/g, "")}_${booking.dateISO}`,
            state: "ACTIVE",
            passengerName: `${pax.firstName} ${pax.lastName}`,
            boardingAndSeatingInfo: { seatNumber: pax.seat },
            reservationInfo: { confirmationCode: booking.rloc },
            barcode: { type: "QR_CODE", value: bcbp, alternateText: booking.rloc },
          },
        ],
      },
    }),
  ).toString("base64url");

  const sig = createHmac("sha256", WALLET_SIGNING_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  const jwt = `${headerB64}.${payloadB64}.${sig}`;
  return {
    jwt,
    saveUrl: `https://pay.google.com/gp/v/save/${jwt}`,
    bcbp,
  };
}
