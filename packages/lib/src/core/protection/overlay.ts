import type { BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../ipc-channels";
import type { BlankSignal, DataDrmLevel, DetectionEvent } from "../types";

export function sendBlankSignal(target: BrowserWindow, signal: BlankSignal): void {
  if (!target || target.isDestroyed()) return;
  const wc = target.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(IPC_CHANNELS.BLANK_ELEMENTS, signal);
  } catch {}
}

export function sendUnblankSignal(target: BrowserWindow, level: DataDrmLevel | "all"): void {
  if (!target || target.isDestroyed()) return;
  const wc = target.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(IPC_CHANNELS.UNBLANK_ELEMENTS, { level });
  } catch {}
}

export function blankSignalForDetection(event: DetectionEvent): BlankSignal {
  return { level: "all", reason: event.category };
}
