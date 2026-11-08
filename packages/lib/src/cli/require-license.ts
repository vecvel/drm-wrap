import chalk from "chalk";
import { getActiveLicense, matchesLicenseDomain } from "../core/license";
import type { LicensePayload } from "../core/license";

/**
 * Gate for commands that use the builder to produce a project (`init`,
 * `build`). Prints a clear activation hint and exits(1) when there's no
 * valid license, or when a domain-locked license doesn't match `baseUrl`.
 * Pass no `baseUrl` to skip the domain check (e.g. before a baseUrl is known
 * yet).
 */
export function requireLicense(baseUrl?: string): LicensePayload {
  const result = getActiveLicense();
  if (!result.valid) {
    console.error(chalk.red(`A valid drm-wrap license is required: ${result.reason}`));
    console.error(chalk.cyan("Activate one with: drm-wrap license activate <key>"));
    process.exit(1);
  }

  if (baseUrl && !matchesLicenseDomain(result.payload, baseUrl)) {
    console.error(
      chalk.red(
        `This license is locked to "${result.payload.domain}", which does not match baseUrl "${baseUrl}".`
      )
    );
    process.exit(1);
  }

  return result.payload;
}
