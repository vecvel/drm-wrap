import type { BrowserWindow } from "electron";

export function applyContentProtection(win: BrowserWindow, enabled: boolean): void {
  if (!win || win.isDestroyed()) return;
  try {
    win.setContentProtection(enabled);
  } catch {
    // older Electron/platform combos may not support setContentProtection or window closed
  }
}

export function isContentProtectionSupported(): boolean {
  return process.platform === "win32" || process.platform === "darwin";
}
