/**
 * Deterministic A/B traffic splitting helper (FR-47).
 */
export function assignExperimentVariant(sessionId: string): "control" | "bundle_highlight_v2" {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) % 100;
  }
  return hash < 50 ? "control" : "bundle_highlight_v2";
}
