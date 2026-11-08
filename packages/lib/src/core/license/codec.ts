/**
 * Token wire format: `${base64url(JSON payload)}.${base64url(Ed25519 signature)}`
 * — the signature covers the base64url payload string bytes directly (never
 * a re-serialized copy of the JSON), so signer and verifier can never
 * disagree over whitespace/key-order. Mirrors how JWTs are signed, without
 * pulling in a JWT library for a single-purpose, single-algorithm token.
 */
export function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function encodeLicenseToken(payloadJson: string, signature: Buffer): string {
  const payload64 = base64UrlEncode(Buffer.from(payloadJson, "utf8"));
  const signature64 = base64UrlEncode(signature);
  return `${payload64}.${signature64}`;
}

export interface DecodedLicenseToken {
  payload64: string;
  signature: Buffer;
  payloadJson: string;
}

export function decodeLicenseToken(token: string): DecodedLicenseToken | null {
  const parts = token.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const payloadJson = base64UrlDecode(parts[0]).toString("utf8");
    const signature = base64UrlDecode(parts[1]);
    return { payload64: parts[0], signature, payloadJson };
  } catch {
    return null;
  }
}
