import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface ScannableQrCodeProps {
  value: string;
  label: string;
  sizeClass?: string;
}

/**
 * Generates an ISO-compliant, camera-scannable SVG QR Code for IATA M1 BCBP boarding passes (FR-133)
 * and Cross-Channel Handoff tokens (FR-49).
 */
export function ScannableQrCode({ value, label, sizeClass = "h-24 w-24" }: ScannableQrCodeProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0f2c33", light: "#ffffff" },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {
        if (active) setSvgMarkup("");
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (!svgMarkup) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded border border-border bg-card text-[10px] font-mono text-muted-foreground`}
        aria-label={label}
      >
        QR
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={`${sizeClass} shrink-0 overflow-hidden rounded-lg border border-border bg-white p-1 [&>svg]:h-full [&>svg]:w-full`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
