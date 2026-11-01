/**
 * App shell: screen registry + router + shared bridge/notify helpers.
 * Loaded first — screen modules (screens/*.js) assign themselves onto
 * `window.DRMStudio.screens` and run after this file, before
 * DOMContentLoaded fires `boot()`.
 *
 * Screen contract: `window.DRMStudio.screens.<name> = function (container, ctx) { ... }`
 * where ctx = { goTo(name, params), bridge, state, params, notify(message, type) }.
 * A screen may optionally `return` a cleanup function (e.g. to call the
 * unsubscribe functions returned by bridge.onLog/onProcessDone) — it is
 * called right before the router tears down that screen to navigate away.
 * `bridge` mirrors window.__DRM_STUDIO__ (see electron/preload.js) — when that
 * is absent (e.g. this page opened in a plain browser for layout preview) a
 * stub bridge is used instead so screens still render and can be clicked
 * through, just without doing anything real.
 */
(function () {
  function stubPayload() {
    return {
      licenseId: "preview",
      customer: "Preview User",
      email: "preview@example.com",
      tier: "extended",
      domain: undefined,
      issuedAt: new Date().toISOString(),
      expiresAt: null,
    };
  }

  function stubConfig(overrides) {
    return Object.assign(
      {
        appName: "My Secure Portal",
        baseUrl: "https://example.com",
        version: "1.0.0",
        features: {
          fullProtection: true,
          selectiveProtection: true,
          detectScreenRecording: true,
          detectSnippingTools: true,
          invisibleMode: true,
          autoInvisibleMode: false,
          dynamicWatermark: true,
          watermarkOpacity: 0.12,
        },
        window: { width: 1440, height: 900, minWidth: 1024, minHeight: 700, center: true },
        build: { windows: { target: ["nsis", "portable"] }, mac: { target: ["dmg", "zip"] } },
      },
      overrides || {}
    );
  }

  function createStubBridge() {
    console.warn("DRMWrap: no native bridge detected — using a stub for layout preview only.");
    let licensed = false;
    return {
      license: {
        status: async () =>
          licensed
            ? { valid: true, payload: stubPayload() }
            : { valid: false, reason: "No license activated (preview mode)." },
        activate: async (key) => {
          licensed = !!(key && key.trim().length > 0);
          return licensed
            ? { valid: true, payload: stubPayload() }
            : { valid: false, reason: "Enter any non-empty key to preview." };
        },
        deactivate: async () => {
          licensed = false;
          return { valid: false, reason: "Deactivated." };
        },
      },
      dialogs: {
        chooseDirectory: async () => "/Users/demo/my-app",
        chooseLogo: async () => null,
        chooseExistingProject: async () => "/Users/demo/my-app",
      },
      project: {
        scaffold: async (options) => ({
          targetDir: options.targetDir,
          config: stubConfig(options),
          logoCopied: false,
        }),
        loadConfig: async () => stubConfig({}),
        saveConfig: async (_targetDir, partial) => stubConfig(partial),
        openInFileManager: async () => {},
        setLogo: async () => ({ success: true }),
        loadLogoDataUrl: async () => null,
        install: async () => ({ started: true, task: "install" }),
        dev: async () => ({ started: true, task: "dev" }),
        stopDev: async () => ({ stopped: true }),
        build: async () => ({ started: true, task: "build" }),
      },
      onLog: () => () => {},
      onProcessDone: () => () => {},
    };
  }

  const bridge = window.__DRM_STUDIO__ || createStubBridge();

  const root = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  let toastTimer = null;

  function notify(message, type) {
    const isError = type === "error";
    const badge = document.createElement("span");
    badge.className = "toast-badge";
    badge.textContent = isError ? "✕" : "✓";

    const text = document.createElement("span");
    text.textContent = message;

    toastEl.innerHTML = "";
    toastEl.appendChild(badge);
    toastEl.appendChild(text);
    toastEl.className = "toast " + (type || "success");

    requestAnimationFrame(() => toastEl.classList.remove("hidden"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3500);
  }

  const state = { license: null, project: null };
  const screens = {};
  let currentCleanup = null;

  function goTo(name, params) {
    if (typeof currentCleanup === "function") {
      try {
        currentCleanup();
      } catch (error) {
        console.error("Screen cleanup failed:", error);
      }
    }
    currentCleanup = null;

    document.body.dataset.screen = name;
    const titlebarEl = document.getElementById("titlebar");
    if (titlebarEl) {
      const showHeader = name === "home" || name === "license";
      titlebarEl.style.display = showHeader ? "flex" : "none";
      titlebarEl.classList.toggle("hidden", !showHeader);
    }

    root.innerHTML = "";
    const render = screens[name];
    if (!render) {
      root.innerHTML = '<div class="empty-state">Unknown screen "' + name + '"</div>';
      return;
    }
    currentCleanup = render(root, { goTo, bridge, state, params: params || {}, notify }) || null;
  }

  async function boot() {
    try {
      state.license = await bridge.license.status();
    } catch (error) {
      state.license = { valid: false, reason: error.message };
    }
    goTo(state.license.valid ? "home" : "license");
  }

  window.DRMStudio = { screens, goTo, notify, state, bridge, boot };
})();
