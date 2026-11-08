#!/usr/bin/env node
import { Command } from "commander";
import { readOwnPackageJson } from "./template-path";
import { registerInitCommand } from "./commands/init";
import { registerConfigCommand } from "./commands/config";
import { registerDevCommand } from "./commands/dev";
import { registerBuildCommand } from "./commands/build";
import { registerUpdateSignaturesCommand } from "./commands/update-signatures";
import { registerLicenseCommand } from "./commands/license";

const pkg = readOwnPackageJson();

const program = new Command();

program
  .name("drm-wrap")
  .description(
    "Convert any website into a secure, DRM-protected Electron desktop app."
  )
  .version(pkg.version);

registerInitCommand(program);
registerConfigCommand(program);
registerDevCommand(program);
registerBuildCommand(program);
registerUpdateSignaturesCommand(program);
registerLicenseCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
