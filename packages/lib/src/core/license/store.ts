import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { verifyLicenseToken } from "./verify";
import type { LicenseVerification } from "./types";

const ENV_VAR = "DRM_WRAP_LICENSE_KEY";

export function licenseStorePath(): string {
  return path.join(os.homedir(), ".drm-wrap", "license.json");
}

/** Env var takes precedence (CI-friendly), then the machine-wide activation file. */
export function readStoredLicenseToken(): string | null {
  const fromEnv = process.env[ENV_VAR];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  const storePath = licenseStorePath();
  if (!fs.existsSync(storePath)) return null;
  try {
    const data = fs.readJsonSync(storePath);
    return typeof data?.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

/** Re-verifies on every call (never trusts a cached "was valid" flag) so expiry is always current. */
export function getActiveLicense(): LicenseVerification {
  const token = readStoredLicenseToken();
  if (!token) {
    return { valid: false, reason: "No license activated. Run `drm-wrap license activate <key>`." };
  }
  return verifyLicenseToken(token);
}

export function activateLicense(token: string): LicenseVerification {
  const verification = verifyLicenseToken(token);
  if (!verification.valid) return verification;

  const storePath = licenseStorePath();
  fs.ensureDirSync(path.dirname(storePath));
  fs.writeJsonSync(storePath, { token, activatedAt: new Date().toISOString() }, { spaces: 2 });
  return verification;
}

export function deactivateLicense(): void {
  const storePath = licenseStorePath();
  if (fs.existsSync(storePath)) {
    fs.removeSync(storePath);
  }
}
