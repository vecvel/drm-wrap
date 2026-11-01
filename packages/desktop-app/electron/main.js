const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const { IPC_CHANNELS } = require("./ipc-channels");
const { loadConfig, watchConfig } = require("./config");
const { applyContentProtection } = require("./protection/content-protection");
const { sendBlankSignal, sendUnblankSignal } = require("./protection/overlay");
const { startWatermarkRefresh } = require("./protection/watermark");
const { DetectionEngine } = require("./detection/engine");
const { InvisibleModeManager } = require("./invisible-mode");
const signatureDatabase = require("./detection/signatures.json");

const APP_ROOT = app.getAppPath();
const LOG_PATH = path.join(app.getPath("userData"), "drm-wrap.log");
const DRM_LAYER_SOURCE = fs.readFileSync(
  path.join(__dirname, "renderer", "drm-layer.js"),
  "utf8"
);

function logEvent(line) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // best-effort local logging only, never crash the app over it
  }
}

function signatureForId(signatureId) {
  return signatureDatabase.signatures.find((s) => s.id === signatureId);
}

function registerHotkeyDetection(onEvent) {
  const accelerators =
    process.platform === "darwin"
      ? ["Cmd+Shift+3", "Cmd+Shift+4", "Cmd+Shift+5"]
      : ["PrintScreen", "Super+Shift+S"];

  const registered = [];
  for (const accelerator of accelerators) {
    try {
      const ok = globalShortcut.register(accelerator, () => {
        onEvent({
          type: "detected",
          category: "screenshot-tool",
          method: "hotkey",
          timestamp: Date.now(),
        });
        setTimeout(() => {
          onEvent({
            type: "cleared",
            category: "screenshot-tool",
            method: "hotkey",
            timestamp: Date.now(),
          });
        }, 1500);
      });
      if (ok) registered.push(accelerator);
    } catch {
      // best-effort: some accelerators are OS-reserved and refuse registration
    }
  }

  return () => {
    for (const accelerator of registered) {
      globalShortcut.unregister(accelerator);
    }
  };
}

function createWindow(config) {
  const win = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    center: config.window.center,
    title: config.appName,
    icon: path.join(APP_ROOT, "public", "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const isRemote = /^https?:\/\//i.test(config.baseUrl);
  if (isRemote) {
    win.loadURL(config.baseUrl);
  } else {
    win.loadFile(path.join(APP_ROOT, config.baseUrl));
  }

  win.webContents.on("did-finish-load", () => {
    win.webContents.executeJavaScript(DRM_LAYER_SOURCE).catch(() => {});
  });

  return win;
}

function createTray(win, invisibleModeManager) {
  const trayIcon = nativeImage
    .createFromPath(path.join(APP_ROOT, "public", "logo.png"))
    .resize({ width: 16, height: 16 });
  const tray = new Tray(trayIcon);
  tray.setToolTip("DRM-Wrap");

  const rebuildMenu = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: invisibleModeManager.state.active
            ? "Disable Invisible Mode"
            : "Enable Invisible Mode",
          click: () => invisibleModeManager.toggle("tray"),
        },
        { type: "separator" },
        {
          label: "Show App",
          click: () => {
            win.show();
            win.focus();
          },
        },
        { label: "Quit", click: () => app.quit() },
      ])
    );
  };

  invisibleModeManager.on("change", rebuildMenu);
  rebuildMenu();
  return tray;
}

class DrmWrapRuntime {
  constructor(win) {
    this.win = win;
    this.activeKeys = new Set();
    this.stopWatermark = null;
    this.detectionEngine = null;
    this.invisibleModeManager = null;
    this.tray = null;
    this.hotkeyCleanup = null;
    this.config = null;
  }

  handleDetectionEvent(event) {
    const key = event.signatureId ?? `${event.method}:${event.category}`;
    const wasEmpty = this.activeKeys.size === 0;

    if (event.type === "detected") {
      this.activeKeys.add(key);
      applyContentProtection(this.win, true);
      if (this.config.features.selectiveProtection && wasEmpty) {
        sendBlankSignal(this.win, { level: "all", reason: event.category });
      }
    } else {
      this.activeKeys.delete(key);
      if (this.activeKeys.size === 0) {
        applyContentProtection(this.win, this.config.features.fullProtection);
        if (this.config.features.selectiveProtection) {
          sendUnblankSignal(this.win, "all");
        }
      }
    }

    if (event.signatureId) {
      const signature = signatureForId(event.signatureId);
      if (signature?.triggersInvisibleMode && this.invisibleModeManager) {
        this.invisibleModeManager.autoTrigger(event.type === "detected");
      }
    }

    logEvent(`${event.type} ${event.category} via ${event.method} (${event.signatureId ?? "n/a"})`);
    if (!this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
      try {
        this.win.webContents.send(IPC_CHANNELS.DETECTION_EVENT, event);
      } catch {}
    }
  }

  teardown() {
    try {
      this.detectionEngine?.stop();
      this.detectionEngine?.removeAllListeners();
    } catch {}
    if (typeof this.stopWatermark === "function") {
      try {
        this.stopWatermark();
      } catch {}
      this.stopWatermark = null;
    }
    if (typeof this.hotkeyCleanup === "function") {
      try {
        this.hotkeyCleanup();
      } catch {}
      this.hotkeyCleanup = null;
    }
    try {
      this.invisibleModeManager?.destroy();
      this.invisibleModeManager?.removeAllListeners();
    } catch {}
    try {
      this.tray?.destroy();
    } catch {}
    this.tray = null;
    this.activeKeys.clear();
  }

  apply(config) {
    this.teardown();
    this.config = config;

    applyContentProtection(this.win, config.features.fullProtection);

    if (config.features.dynamicWatermark) {
      const identity = os.userInfo().username || "DRM-Wrap User";
      this.stopWatermark = startWatermarkRefresh(this.win, config, identity);
    }

    if (config.features.detectScreenRecording || config.features.detectSnippingTools) {
      this.detectionEngine = new DetectionEngine();
      this.detectionEngine.on("event", (event) => this.handleDetectionEvent(event));
      this.detectionEngine.on("error", (error) => logEvent(`detection-engine error: ${error.message}`));
      this.detectionEngine.start();
    }

    if (config.features.detectSnippingTools) {
      this.hotkeyCleanup = registerHotkeyDetection((event) => this.handleDetectionEvent(event));
    }

    if (config.features.invisibleMode) {
      this.invisibleModeManager = new InvisibleModeManager(this.win, {
        autoEnabled: config.features.autoInvisibleMode,
      });
      this.invisibleModeManager.registerHotkey();
      this.invisibleModeManager.on("change", (state) => {
        if (!this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
          try {
            this.win.webContents.send(IPC_CHANNELS.INVISIBLE_STATE, state);
          } catch {}
        }
        logEvent(`invisible-mode ${state.active ? "on" : "off"} (${state.reason ?? "n/a"})`);
      });
      this.tray = createTray(this.win, this.invisibleModeManager);
    }

    if (!this.win.isDestroyed() && this.win.webContents && !this.win.webContents.isDestroyed()) {
      try {
        this.win.webContents.send(IPC_CHANNELS.CONFIG_UPDATED, config);
      } catch {}
    }
  }
}

process.on("uncaughtException", (error) => {
  if (error && (error.message?.includes("Object has been destroyed") || error.message?.includes("webContents"))) {
    return;
  }
  console.error("Uncaught Exception:", error);
});

app.whenReady().then(() => {
  const config = loadConfig(APP_ROOT);
  const win = createWindow(config);

  if (process.platform === "darwin" && app.dock) {
    const logoPath = path.join(APP_ROOT, "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        app.dock.setIcon(logoPath);
      } catch {}
    }
  }

  const runtime = new DrmWrapRuntime(win);
  runtime.apply(config);

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => runtime.config);
  ipcMain.on(IPC_CHANNELS.TOGGLE_INVISIBLE, () => runtime.invisibleModeManager?.toggle("manual"));
  ipcMain.on(IPC_CHANNELS.SET_PROTECTION, (_event, enabled) => {
    applyContentProtection(win, !!enabled);
  });

  const stopWatchingConfig = watchConfig((updatedConfig) => {
    if (!win.isDestroyed()) {
      runtime.apply(updatedConfig);
    }
  }, APP_ROOT);

  const cleanupOnClose = () => {
    try {
      stopWatchingConfig();
    } catch {}
    runtime.teardown();
  };

  win.on("close", cleanupOnClose);
  win.on("closed", cleanupOnClose);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow(runtime.config);
      runtime.win = newWin;
      runtime.apply(runtime.config);
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
