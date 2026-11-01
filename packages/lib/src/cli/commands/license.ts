import chalk from "chalk";
import type { Command } from "commander";
import {
  activateLicense,
  deactivateLicense,
  getActiveLicense,
  licenseStorePath,
} from "../../core/license";

function printLicenseSummary(payload: {
  licenseId: string;
  customer: string;
  email: string;
  tier: string;
  domain?: string;
  expiresAt: string | null;
}): void {
  console.log(`  License ID : ${payload.licenseId}`);
  console.log(`  Licensed to: ${payload.customer} <${payload.email}>`);
  console.log(`  Tier       : ${payload.tier}`);
  console.log(`  Domain lock: ${payload.domain ?? "none (any domain)"}`);
  console.log(`  Expires    : ${payload.expiresAt ?? "never"}`);
}

export function registerLicenseCommand(program: Command): void {
  const license = program.command("license").description("Manage your drm-wrap license");

  license
    .command("activate <key>")
    .description("Activate a license key on this machine")
    .action((key: string) => {
      const result = activateLicense(key);
      if (!result.valid) {
        console.error(chalk.red(`License activation failed: ${result.reason}`));
        process.exit(1);
        return;
      }
      console.log(chalk.green(`License activated and saved to ${licenseStorePath()}`));
      printLicenseSummary(result.payload);
    });

  license
    .command("status")
    .description("Show the currently activated license")
    .action(() => {
      const result = getActiveLicense();
      if (!result.valid) {
        console.log(chalk.red(`No valid license: ${result.reason}`));
        process.exit(1);
        return;
      }
      console.log(chalk.green("Active license:"));
      printLicenseSummary(result.payload);
    });

  license
    .command("deactivate")
    .description("Remove the activated license from this machine")
    .action(() => {
      deactivateLicense();
      console.log(chalk.green("License removed from this machine."));
    });
}
