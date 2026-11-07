/**
 * Evidence provenance hashing. Matches the RAG module's canonical format:
 * SHA-256(excerpt.trim() + "|" + locator.trim()), hex encoded.
 */

/** SHA-256 hex digest of a UTF-8 string via Web Crypto (browser and Node). */
export async function sha256Hex(data: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto is not available in this environment.");
  }
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function canonicalEvidencePayload(excerpt: string, locator: string): string {
  return `${excerpt.trim()}|${locator.trim()}`;
}

/** Verifies an excerpt + locator against the hash stored with the evidence. */
export async function verifyEvidenceHash(
  excerpt: string,
  locator: string,
  claimedHash: string
): Promise<{ match: boolean; computedHash: string }> {
  const computedHash = await sha256Hex(canonicalEvidencePayload(excerpt, locator));
  return { match: computedHash === claimedHash.toLowerCase(), computedHash };
}

/** Order-independent root hash over a set of evidence hashes. */
export async function computeEvidenceSetHash(hashes: string[]): Promise<string> {
  const sorted = [...hashes].sort();
  return sha256Hex(sorted.join("::"));
}
