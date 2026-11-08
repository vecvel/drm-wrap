import crypto from "node:crypto";
import { LICENSE_PUBLIC_KEY_PEM } from "./public-key";
import { decodeLicenseToken } from "./codec";
import type { LicensePayload, LicenseVerification } from "./types";

const publicKey = crypto.createPublicKey(LICENSE_PUBLIC_KEY_PEM);

function isLicensePayload(value: unknown): value is LicensePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.licenseId === "string" &&
    typeof v.customer === "string" &&
    typeof v.email === "string" &&
    (v.tier === "single" || v.tier === "extended") &&
    typeof v.issuedAt === "string" &&
    (v.expiresAt === null || typeof v.expiresAt === "string") &&
    (v.domain === undefined || typeof v.domain === "string")
  );
}

/** Verifies a license token's signature, shape, and expiry (not domain — see matchesLicenseDomain). */
export function verifyLicenseToken(token: string): LicenseVerification {
  const decoded = decodeLicenseToken(token);
  if (!decoded) {
    return { valid: false, reason: "Malformed license key." };
  }

  const signatureValid = crypto.verify(
    null,
    Buffer.from(decoded.payload64, "utf8"),
    publicKey,
    decoded.signature
  );
  if (!signatureValid) {
    return { valid: false, reason: "Invalid license signature." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded.payloadJson);
  } catch {
    return { valid: false, reason: "Malformed license payload." };
  }

  if (!isLicensePayload(parsed)) {
    return { valid: false, reason: "Malformed license payload." };
  }

  if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: `License expired on ${parsed.expiresAt}.` };
  }

  return { valid: true, payload: parsed };
}

function extractHostname(baseUrl: string): string | null {
  if (!/^https?:\/\//i.test(baseUrl)) return null;
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A domain-locked license (payload.domain set) only validates for a baseUrl
 * on that domain or a subdomain of it. An unlocked license (no domain field)
 * always matches. A local-file baseUrl never matches a domain-locked license
 * (there is no real domain to check it against).
 */
export function matchesLicenseDomain(payload: LicensePayload, baseUrl: string): boolean {
  if (!payload.domain) return true;
  const hostname = extractHostname(baseUrl);
  if (!hostname) return false;
  const licenseDomain = payload.domain.toLowerCase();
  return hostname === licenseDomain || hostname.endsWith(`.${licenseDomain}`);
}
