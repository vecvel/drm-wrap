import { EventEmitter } from "node:events";
import { globalShortcut } from "electron";
import type { BrowserWindow } from "electron";
import { applyContentProtection } from "./protection/content-protection";
import type { InvisibleModeState } from "./types";

export interface InvisibleModeOptions {
  hotkey?: string;
  autoEnabled?: boolean;
}

const DEFAULT_HOTKEY = "CommandOrControl+Shift+I";

export class InvisibleModeManager extends EventEmitter {
  private readonly win: BrowserWindow;
  private readonly options: Required<InvisibleModeOptions>;
  private currentState: InvisibleModeState;

  constructor(win: BrowserWindow, options: InvisibleModeOptions = {}) {
    super();
    this.win = win;
    this.options = {
      hotkey: options.hotkey ?? DEFAULT_HOTKEY,
      autoEnabled: options.autoEnabled ?? false,
    };
    this.currentState = { active: false, auto: false };
  }

  registerHotkey(): void {
    globalShortcut.register(this.options.hotkey, () => this.toggle("hotkey"));
  }

  unregisterHotkey(): void {
    globalShortcut.unregister(this.options.hotkey);
  }

  enable(reason: InvisibleModeState["reason"] = "manual"): void {
    if (!this.win || this.win.isDestroyed()) return;
    applyContentProtection(this.win, true);
    this.currentState = {
      active: true,
      auto: reason === "auto-detection",
      reason,
    };
    this.emit("change", this.state);
  }

  disable(): void {
    if (!this.win || this.win.isDestroyed()) return;
    applyContentProtection(this.win, false);
    this.currentState = { active: false, auto: false };
    this.emit("change", this.state);
  }

  toggle(reason: InvisibleModeState["reason"] = "manual"): void {
    if (!this.currentState.active) {
      this.enable(reason);
    } else {
      this.disable();
    }
  }

  autoTrigger(active: boolean): void {
    if (!this.options.autoEnabled) {
      return;
    }
    if (active) {
      if (!(this.currentState.active && this.currentState.reason !== "auto-detection")) {
        this.enable("auto-detection");
      }
    } else if (this.currentState.reason === "auto-detection") {
      this.disable();
    }
  }

  get state(): InvisibleModeState {
    return { ...this.currentState };
  }

  destroy(): void {
    this.unregisterHotkey();
  }
}

export declare interface InvisibleModeManager {
  on(event: "change", listener: (state: InvisibleModeState) => void): this;
}
