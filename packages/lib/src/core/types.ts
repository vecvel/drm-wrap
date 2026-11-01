/**
 * Shared type contracts used across the CLI, the core detection/protection
 * engine, and the generated Electron desktop app (main, preload, renderer).
 * This file is the single source of truth for the shapes below — every
 * module in this monorepo must conform to it.
 */

export interface FeatureFlags {
  fullProtection: boolean;
  selectiveProtection: boolean;
  detectScreenRecording: boolean;
  detectSnippingTools: boolean;
  invisibleMode: boolean;
  autoInvisibleMode: boolean;
  dynamicWatermark: boolean;
  watermarkOpacity: number;
}

export interface WindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  center: boolean;
}

export interface WindowsBuildConfig {
  target: Array<"nsis" | "portable">;
}

export interface MacBuildConfig {
  target: Array<"dmg" | "zip">;
}

export interface BuildConfig {
  windows: WindowsBuildConfig;
  mac: MacBuildConfig;
}

export interface DrmConfig {
  appName: string;
  baseUrl: string;
  version: string;
  features: FeatureFlags;
  window: WindowConfig;
  build: BuildConfig;
}

/** Recognized values for the `data-drm` HTML attribute contract (Section 6). */
export type DataDrmLevel = "full" | "section" | "high";

export type SignatureCategory =
  | "screen-recorder"
  | "screenshot-tool"
  | "meeting-app"
  | "game-bar"
  | "unknown-capture";

export type SignaturePlatform = "win32" | "darwin";

/** One entry in the detection signature database (signatures.json). */
export interface Signature {
  id: string;
  name: string;
  category: SignatureCategory;
  platforms: SignaturePlatform[];
  /** Case-insensitive, substring-matched process executable names. */
  processNames: string[];
  /** Case-insensitive, substring-matched window title patterns. */
  windowTitlePatterns?: string[];
  /** When true, detecting this signature should also trigger Auto Invisible Mode. */
  triggersInvisibleMode?: boolean;
}

export interface SignatureDatabase {
  version: string;
  updatedAt: string;
  signatures: Signature[];
}

export type DetectionMethod =
  | "process-scan"
  | "window-title"
  | "hotkey"
  | "heuristic";

export interface DetectionEvent {
  type: "detected" | "cleared";
  category: SignatureCategory;
  method: DetectionMethod;
  signatureId?: string;
  processName?: string;
  windowTitle?: string;
  timestamp: number;
}

export interface WatermarkPayload {
  enabled: boolean;
  text: string;
  opacity: number;
}

export interface InvisibleModeState {
  active: boolean;
  auto: boolean;
  reason?: "manual" | "hotkey" | "tray" | "auto-detection";
}

/** IPC message shape for renderer-side element blanking (data-drm watcher). */
export interface BlankSignal {
  level: DataDrmLevel | "all";
  reason: DetectionEvent["category"] | "invisible-mode" | "manual";
}
