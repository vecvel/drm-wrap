import chalk from "chalk";
import type { Command } from "commander";
import { intro, outro, text, confirm, multiselect, isCancel, cancel } from "@clack/prompts";
import { loadConfig, validateConfig, saveConfig } from "../../core/config/schema";
import { personalizeGeneratedProject } from "../../core/scaffold";

const FEATURE_OPTIONS = [
  { value: "fullProtection", label: "Full App Protection", hint: "protect the whole window" },
  { value: "selectiveProtection", label: "Selective Protection", hint: "protect only data-drm elements" },
  { value: "detectScreenRecording", label: "Detect Screen Recording" },
  { value: "detectSnippingTools", label: "Detect Snipping Tools" },
  { value: "invisibleMode", label: "Invisible Mode", hint: "hide the app during screen shares" },
  { value: "dynamicWatermark", label: "Dynamic Watermark" },
  { value: "autoInvisibleMode", label: "Auto Invisible Mode", hint: "auto-enable on meeting detection" },
] as const;

function bail(): never {
  cancel("Cancelled.");
  process.exit(0);
}

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Edit the current project's drm-wrap.config.json")
    .action(async () => {
      let existing;
      try {
        existing = loadConfig(process.cwd());
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
        return;
      }

      intro(chalk.cyan("drm-wrap config"));

      const appName = await text({
        message: "App name",
        initialValue: existing.appName,
      });
      if (isCancel(appName)) bail();

      const baseUrl = await text({
        message: "Base URL of the website to wrap",
        initialValue: existing.baseUrl,
        validate: (value) => {
          try {
            new URL(value || existing.baseUrl);
            return undefined;
          } catch {
            return "Enter a valid URL, e.g. https://example.com";
          }
        },
      });
      if (isCancel(baseUrl)) bail();

      const initialSelected = FEATURE_OPTIONS.map((option) => option.value).filter(
        (value) => existing.features[value]
      ) as string[];

      const features = await multiselect({
        message: "Select protection features to enable",
        options: FEATURE_OPTIONS as unknown as { value: string; label: string; hint?: string }[],
        initialValues: initialSelected,
        required: false,
      });
      if (isCancel(features)) bail();

      const shouldSave = await confirm({
        message: "Save these changes to drm-wrap.config.json?",
        initialValue: true,
      });
      if (isCancel(shouldSave)) bail();

      if (!shouldSave) {
        outro(chalk.red("No changes saved."));
        return;
      }

      const selected = new Set(features as string[]);
      const config = validateConfig({
        ...existing,
        appName: (appName as string).trim() || existing.appName,
        baseUrl: (baseUrl as string).trim() || existing.baseUrl,
        features: {
          ...existing.features,
          fullProtection: selected.has("fullProtection"),
          selectiveProtection: selected.has("selectiveProtection"),
          detectScreenRecording: selected.has("detectScreenRecording"),
          detectSnippingTools: selected.has("detectSnippingTools"),
          invisibleMode: selected.has("invisibleMode"),
          autoInvisibleMode: selected.has("autoInvisibleMode"),
          dynamicWatermark: selected.has("dynamicWatermark"),
        },
      });

      saveConfig(config, process.cwd());
      await personalizeGeneratedProject(process.cwd(), config.appName);
      outro(chalk.green("Saved drm-wrap.config.json"));
    });
}
