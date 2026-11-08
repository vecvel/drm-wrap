// Everything that makes the wrapped site behave like a desktop app rather than
// a browser tab: native menu, remembered window size, external links in the
// system browser, an offline page, and a single running instance.
const fs = require("node:fs");
const path = require("node:path");
const { app, Menu, shell, screen } = require("electron");

const STATE_FILE = () => path.join(app.getPath("userData"), "window-state.json");

function readWindowState(defaults) {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE(), "utf8"));
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      saved.x >= a.x - 50 && saved.y >= a.y - 50 &&
      saved.x + 100 <= a.x + a.width && saved.y + 100 <= a.y + a.height
    );
    if (visible && saved.width > 0 && saved.height > 0) return saved;
  } catch {}
  return { width: defaults.width, height: defaults.height, isMaximized: false };
}

function trackWindowState(win) {
  let timer = null;
  const save = () => {
    if (win.isDestroyed()) return;
    const bounds = win.getNormalBounds();
    try {
      fs.mkdirSync(path.dirname(STATE_FILE()), { recursive: true });
      fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...bounds, isMaximized: win.isMaximized() }));
    } catch {}
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  win.on("resize", later);
  win.on("move", later);
  win.on("close", () => {
    clearTimeout(timer);
    save();
  });
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isWebUrl(url) {
  return /^https?:\/\//i.test(url);
}

// target="_blank" links and window.open: same-site pages stay in the app,
// everything else opens in the user's browser.
function handleLinks(win, baseUrl) {
  const appOrigin = isWebUrl(baseUrl) ? originOf(baseUrl) : null;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (appOrigin && originOf(url) === appOrigin) {
      win.loadURL(url);
    } else if (isWebUrl(url) || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function handleLoadFailures(win, baseUrl) {
  const offlinePage = path.join(__dirname, "renderer", "offline.html");
  win.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    // -3 is an aborted load (a redirect or a newer navigation), not an error.
    if (!isMainFrame || code === -3 || url.startsWith("file:")) return;
    win.loadFile(offlinePage, { query: { url: url || baseUrl, reason: description } });
  });
}

// Mouse back/forward buttons on Windows, swipe on macOS.
function handleNavigationGestures(win) {
  const go = (dir) => {
    const nav = win.webContents.navigationHistory ?? win.webContents;
    if (dir === "back" && nav.canGoBack()) nav.goBack();
    if (dir === "forward" && nav.canGoForward()) nav.goForward();
  };
  win.on("app-command", (_e, cmd) => {
    if (cmd === "browser-backward") go("back");
    if (cmd === "browser-forward") go("forward");
  });
  win.on("swipe", (_e, direction) => {
    if (direction === "right") go("back");
    if (direction === "left") go("forward");
  });
  return go;
}

// Cut/copy/paste in text fields only, so protected content still can't be
// copied from the page.
function handleContextMenu(win) {
  win.webContents.on("context-menu", (_event, params) => {
    if (!params.isEditable) return;
    Menu.buildFromTemplate([
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ]).popup({ window: win });
  });
}

function buildMenu(appName, go) {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [{
          label: appName,
          submenu: [
            { role: "about", label: `About ${appName}` },
            { type: "separator" },
            { role: "hide", label: `Hide ${appName}` },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit", label: `Quit ${appName}` },
          ],
        }]
      : [{ label: "File", submenu: [{ role: "quit", label: "Exit" }] }]),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Back", accelerator: isMac ? "Cmd+[" : "Alt+Left", click: () => go("back") },
        { label: "Forward", accelerator: isMac ? "Cmd+]" : "Alt+Right", click: () => go("forward") },
        { role: "reload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Call before app is ready. Returns false when another instance already owns the app. */
function claimSingleInstance(getWindow) {
  if (!app.requestSingleInstanceLock()) return false;
  app.on("second-instance", () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  return true;
}

function setupDesktopShell(win, config) {
  // Keep the app's name in the title bar instead of each page's <title>.
  win.on("page-title-updated", (event) => event.preventDefault());
  win.setTitle(config.appName);

  handleLinks(win, config.baseUrl);
  handleLoadFailures(win, config.baseUrl);
  handleContextMenu(win);
  const go = handleNavigationGestures(win);
  buildMenu(config.appName, go);
  trackWindowState(win);
}

module.exports = { readWindowState, setupDesktopShell, claimSingleInstance };
