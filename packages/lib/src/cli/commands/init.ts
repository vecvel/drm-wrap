import chalk from "chalk";
import type { Command } from "commander";
import {
  intro,
  outro,
  text,
  confirm,
  multiselect,
  isCancel,
  cancel,
  spinner,
} from "@clack/prompts";
import fs from "fs-extra";
import path from "node:path";
import { requireLicense } from "../require-license";
import { scaffoldProject } from "../../core/scaffold";

const FEATURE_OPTIONS = [
  { value: "fullProtection", label: "Full App Protection", hint: "protect the whole window" },
  { value: "selectiveProtection", label: "Selective Protection", hint: "protect only data-drm elements" },
  { value: "detectScreenRecording", label: "Detect Screen Recording" },
  { value: "detectSnippingTools", label: "Detect Snipping Tools" },
  { value: "invisibleMode", label: "Invisible Mode", hint: "hide the app during screen shares" },
  { value: "dynamicWatermark", label: "Dynamic Watermark" },
  { value: "autoInvisibleMode", label: "Auto Invisible Mode", hint: "auto-enable on meeting detection" },
] as const;

const DEFAULT_SELECTED_FEATURES = [
  "fullProtection",
  "selectiveProtection",
  "detectScreenRecording",
  "detectSnippingTools",
  "invisibleMode",
  "dynamicWatermark",
];

function bail(): never {
  cancel("Cancelled.");
  process.exit(0);
}

export function registerInitCommand(program: Command): void {
  program
    .command("init [targetDir]")
    .description("Scaffold a new DRM-Wrap desktop app project")
    .action(async (targetDirArg: string | undefined) => {
      const targetDir = targetDirArg ?? ".";
      const resolvedTargetDir = path.resolve(targetDir);

      intro(chalk.cyan("drm-wrap init"));

      if (await fs.pathExists(resolvedTargetDir)) {
        const entries = await fs.readdir(resolvedTargetDir);
        if (entries.length > 0) {
          const proceed = await confirm({
            message: `"${resolvedTargetDir}" is not empty. Continue and merge the template into it?`,
            initialValue: false,
          });
          if (isCancel(proceed)) bail();
          if (!proceed) bail();
        }
      }

      const appName = await text({
        message: "App name",
        initialValue: "My Secure Portal",
        placeholder: "My Secure Portal",
      });
      if (isCancel(appName)) bail();

      const baseUrl = await text({
        message: "Base URL of the website to wrap",
        initialValue: "https://example.com",
        placeholder: "https://example.com",
        validate: (value) => {
          try {
            new URL(value || "https://example.com");
            return undefined;
          } catch {
            return "Enter a valid URL, e.g. https://example.com";
          }
        },
      });
      if (isCancel(baseUrl)) bail();

      requireLicense((baseUrl as string).trim());

      const logoPath = await text({
        message: "Path to a logo image (optional)",
        placeholder: "leave blank to use the default logo",
      });
      if (isCancel(logoPath)) bail();

      const features = await multiselect({
        message: "Select protection features to enable",
        options: FEATURE_OPTIONS as unknown as { value: string; label: string; hint?: string }[],
        initialValues: DEFAULT_SELECTED_FEATURES,
        required: false,
      });
      if (isCancel(features)) bail();

      const s = spinner();
      s.start(`Scaffolding project into ${resolvedTargetDir}`);
      const selected = new Set(features as string[]);
      const result = await scaffoldProject({
        targetDir: resolvedTargetDir,
        appName: appName as string,
        baseUrl: baseUrl as string,
        logoPath: logoPath as string,
        features: {
          fullProtection: selected.has("fullProtection"),
          selectiveProtection: selected.has("selectiveProtection"),
          detectScreenRecording: selected.has("detectScreenRecording"),
          detectSnippingTools: selected.has("detectSnippingTools"),
          invisibleMode: selected.has("invisibleMode"),
          autoInvisibleMode: selected.has("autoInvisibleMode"),
          dynamicWatermark: selected.has("dynamicWatermark"),
          watermarkOpacity: 0.12,
        },
      });
      s.stop("Project ready");

      if (result.logoError) {
        console.log(chalk.red(result.logoError));
      }

      outro(chalk.green(`"${result.config.appName}" is ready.`));
      console.log(chalk.cyan("\nNext steps:"));
      console.log(`  cd ${targetDir}`);
      console.log("  npm install");
      console.log("  npx drm-wrap dev");
    });
}
