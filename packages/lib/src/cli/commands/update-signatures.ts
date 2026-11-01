import path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";
import type { Command } from "commander";

export function registerUpdateSignaturesCommand(program: Command): void {
  program
    .command("update-signatures")
    .description("Update the bundled detection signature database in the current project")
    .action(async () => {
      const cwd = process.cwd();
      const destDir = path.join(cwd, "electron", "detection");
      const destPath = path.join(destDir, "signatures.json");

      if (!(await fs.pathExists(destDir))) {
        console.error(
          chalk.red(
            `No electron/detection directory found in ${cwd}. Run this command inside a drm-wrap project (i.e. one created with "drm-wrap init").`
          )
        );
        process.exit(1);
        return;
      }

      const sourcePath = path.join(__dirname, "..", "..", "core", "detection", "signatures.json");
      await fs.copy(sourcePath, destPath);

      const updated = await fs.readJson(destPath);
      console.log(chalk.green("Detection signatures updated."));
      console.log(chalk.cyan(`  version: ${updated.version}`));
      console.log(chalk.cyan(`  updatedAt: ${updated.updatedAt}`));
    });
}
