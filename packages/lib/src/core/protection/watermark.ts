import type { BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../ipc-channels";
import type { DrmConfig, WatermarkPayload } from "../types";

export function buildWatermarkText(identity: string, when: Date = new Date()): string {
  return `${identity} • ${when.toISOString()}`;
}

export function getWatermarkPayload(config: DrmConfig, identity: string): WatermarkPayload {
  return {
    enabled: config.features.dynamicWatermark,
    text: buildWatermarkText(identity),
    opacity: config.features.watermarkOpacity,
  };
}

export function sendWatermarkUpdate(target: BrowserWindow, payload: WatermarkPayload): void {
  if (!target || target.isDestroyed()) {
    return;
  }
  const wc = target.webContents;
  if (!wc || wc.isDestroyed()) {
    return;
  }
  try {
    wc.send(IPC_CHANNELS.UPDATE_WATERMARK, payload);
  } catch {
    // Window or webContents destroyed concurrently
  }
}

export function startWatermarkRefresh(
  target: BrowserWindow,
  config: DrmConfig,
  identity: string,
  intervalMs = 15000
): () => void {
  if (!target || target.isDestroyed()) {
    return () => {};
  }

  sendWatermarkUpdate(target, getWatermarkPayload(config, identity));

  let cleanedUp = false;
  let interval: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };

  interval = setInterval(() => {
    if (cleanedUp || !target || target.isDestroyed()) {
      cleanup();
      return;
    }
    const wc = target.webContents;
    if (!wc || wc.isDestroyed()) {
      cleanup();
      return;
    }
    sendWatermarkUpdate(target, getWatermarkPayload(config, identity));
  }, intervalMs);

  if (!target.isDestroyed()) {
    target.once("close", cleanup);
    target.once("closed", cleanup);
  }

  return cleanup;
}
