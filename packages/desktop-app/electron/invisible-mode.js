const { EventEmitter } = require("node:events");
const { globalShortcut } = require("electron");
const { applyContentProtection } = require("./protection/content-protection");

const DEFAULT_HOTKEY = "CommandOrControl+Shift+I";

class InvisibleModeManager extends EventEmitter {
  constructor(win, options = {}) {
    super();
    this.win = win;
    this.options = {
      hotkey: options.hotkey ?? DEFAULT_HOTKEY,
      autoEnabled: options.autoEnabled ?? false,
    };
    this.currentState = { active: false, auto: false };
  }

  registerHotkey() {
    try {
      globalShortcut.register(this.options.hotkey, () => this.toggle("hotkey"));
    } catch {}
  }

  unregisterHotkey() {
    try {
      globalShortcut.unregister(this.options.hotkey);
    } catch {}
  }

  enable(reason = "manual") {
    if (!this.win || this.win.isDestroyed()) return;
    applyContentProtection(this.win, true);
    this.currentState = {
      active: true,
      auto: reason === "auto-detection",
      reason,
    };
    this.emit("change", this.state);
  }

  disable() {
    if (!this.win || this.win.isDestroyed()) return;
    applyContentProtection(this.win, false);
    this.currentState = { active: false, auto: false };
    this.emit("change", this.state);
  }

  toggle(reason = "manual") {
    if (!this.currentState.active) {
      this.enable(reason);
    } else {
      this.disable();
    }
  }

  autoTrigger(active) {
    if (!this.options.autoEnabled) return;
    if (active) {
      if (!(this.currentState.active && this.currentState.reason !== "auto-detection")) {
        this.enable("auto-detection");
      }
    } else if (this.currentState.reason === "auto-detection") {
      this.disable();
    }
  }

  get state() {
    return { ...this.currentState };
  }

  destroy() {
    this.unregisterHotkey();
  }
}

module.exports = { InvisibleModeManager };
