/**
 * License token contract, shared between the vendor-only signer
 * (packages/license-admin, keeps the private key) and this package's
 * offline verifier (embeds only the public key — see public-key.ts).
 * Both sides must agree on this shape; it is intentionally duplicated
 * (not imported) in packages/license-admin to keep that package fully
 * decoupled from "drm-wrap" itself.
 */
export type LicenseTier = "single" | "extended";

export interface LicensePayload {
  licenseId: string;
  customer: string;
  email: string;
  tier: LicenseTier;
  /** When set, this license only validates for projects whose baseUrl hostname matches. */
  domain?: string;
  issuedAt: string;
  /** ISO date string, or null for a perpetual license. */
  expiresAt: string | null;
}

export interface LicenseVerificationOk {
  valid: true;
  payload: LicensePayload;
}

export interface LicenseVerificationFail {
  valid: false;
  reason: string;
}

export type LicenseVerification = LicenseVerificationOk | LicenseVerificationFail;
