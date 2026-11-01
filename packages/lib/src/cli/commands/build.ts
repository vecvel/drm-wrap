import { spawn } from "node:child_process";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../../core/config/schema";
import { requireLicense } from "../require-license";

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Package the app for Windows and macOS via electron-builder")
    .action(() => {
      let config;
      try {
        config = loadConfig(process.cwd());
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
        return;
      }

      requireLicense(config.baseUrl);

      console.log(chalk.cyan(`Building "${config.appName}"...`));
      console.log(chalk.cyan(`  Windows targets: ${config.build.windows.target.join(", ")}`));
      console.log(chalk.cyan(`  macOS targets: ${config.build.mac.target.join(", ")}`));

      const child = spawn(
        "npx",
        ["--no-install", "electron-builder", "--config", "electron-builder.yml"],
        {
          cwd: process.cwd(),
          stdio: "inherit",
          shell: process.platform === "win32",
        }
      );

      child.on("error", (error) => {
        console.error(chalk.red(error.message));
        process.exit(1);
      });
      child.on("exit", (code) => process.exit(code ?? 0));
    });
}
