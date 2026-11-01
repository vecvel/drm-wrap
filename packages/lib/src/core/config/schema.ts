import { z } from "zod";
import fs from "fs-extra";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { DrmConfig } from "../types";

export const baseUrlSchema = z
  .string()
  .min(1, "baseUrl is required")
  .refine(
    (value) => {
      if (!/^https?:\/\//i.test(value)) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "baseUrl must be a valid http(s) URL (e.g. https://example.com) or a local file path (e.g. public/demo/index.html)" }
  );

export const featureFlagsSchema = z.object({
  fullProtection: z.boolean().default(true),
  selectiveProtection: z.boolean().default(true),
  detectScreenRecording: z.boolean().default(true),
  detectSnippingTools: z.boolean().default(true),
  invisibleMode: z.boolean().default(true),
  autoInvisibleMode: z.boolean().default(false),
  dynamicWatermark: z.boolean().default(true),
  watermarkOpacity: z.number().min(0).max(1).default(0.12),
});

export const windowConfigSchema = z.object({
  width: z.number().int().positive().default(1440),
  height: z.number().int().positive().default(900),
  minWidth: z.number().int().positive().default(1024),
  minHeight: z.number().int().positive().default(700),
  center: z.boolean().default(true),
});

export const buildConfigSchema = z.object({
  windows: z
    .object({
      target: z.array(z.enum(["nsis", "portable"])).default(["nsis", "portable"]),
    })
    .default({ target: ["nsis", "portable"] }),
  mac: z
    .object({
      target: z.array(z.enum(["dmg", "zip"])).default(["dmg", "zip"]),
    })
    .default({ target: ["dmg", "zip"] }),
});

export const drmConfigSchema = z.object({
  appName: z.string().min(1, "appName is required"),
  baseUrl: baseUrlSchema,
  version: z.string().default("1.0.0"),
  features: featureFlagsSchema.default(featureFlagsSchema.parse({})),
  window: windowConfigSchema.default(windowConfigSchema.parse({})),
  build: buildConfigSchema.default(buildConfigSchema.parse({})),
});

export type DrmConfigInput = z.input<typeof drmConfigSchema>;

export const CONFIG_FILE_NAME = "drm-wrap.config.json";

export function defaultConfig(overrides: Partial<DrmConfigInput> = {}): DrmConfig {
  return drmConfigSchema.parse({
    appName: "My Secure Portal",
    baseUrl: "https://example.com",
    ...overrides,
  }) as DrmConfig;
}

export function validateConfig(data: unknown): DrmConfig {
  return drmConfigSchema.parse(data) as DrmConfig;
}

export function safeValidateConfig(data: unknown) {
  return drmConfigSchema.safeParse(data);
}

/** Resolves `drm-wrap.config.json` starting at `cwd`, defaulting to process.cwd(). */
export function resolveConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_FILE_NAME);
}

export function loadConfig(cwd: string = process.cwd()): DrmConfig {
  const configPath = resolveConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No ${CONFIG_FILE_NAME} found in ${cwd}. Run "drm-wrap init" first.`
    );
  }
  const raw = fs.readJsonSync(configPath);
  return validateConfig(raw);
}

export function saveConfig(config: DrmConfig, cwd: string = process.cwd()): void {
  const configPath = resolveConfigPath(cwd);
  fs.writeJsonSync(configPath, config, { spaces: 2 });
}

/**
 * Watches `drm-wrap.config.json` for changes and invokes `onChange` with the
 * freshly validated config. Invalid edits are logged to stderr and ignored
 * (the previous valid config keeps applying) so a mid-save partial write
 * never crashes the running app. Returns a function that stops watching.
 */
export function watchConfig(
  onChange: (config: DrmConfig) => void,
  cwd: string = process.cwd()
): () => void {
  const configPath = resolveConfigPath(cwd);
  const watcher: FSWatcher = chokidar.watch(configPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  watcher.on("change", () => {
    try {
      onChange(loadConfig(cwd));
    } catch (error) {
      console.error(
        `[drm-wrap] ignored invalid ${CONFIG_FILE_NAME} update:`,
        error instanceof Error ? error.message : error
      );
    }
  });

  return () => {
    void watcher.close();
  };
}
