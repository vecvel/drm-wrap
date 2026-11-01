import { spawn } from "node:child_process";
import chalk from "chalk";
import type { Command } from "commander";

export function registerDevCommand(program: Command): void {
  program
    .command("dev")
    .description("Run the generated Electron app in development mode")
    .action(() => {
      console.log(chalk.cyan("Starting drm-wrap in development mode..."));
      console.log(
        chalk.cyan("Editing drm-wrap.config.json while dev is running hot-reloads the running app.")
      );

      const child = spawn("npx", ["--no-install", "electron", "."], {
        cwd: process.cwd(),
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "development" },
        shell: process.platform === "win32",
      });

      child.on("error", (error) => {
        console.error(chalk.red(error.message));
        process.exit(1);
      });
      child.on("exit", (code) => process.exit(code ?? 0));
    });
}
