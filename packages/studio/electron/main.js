const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const fsExtra = require("fs-extra");
const { spawn, execFileSync } = require("node:child_process");
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const {
  getActiveLicense,
  activateLicense,
  deactivateLicense,
  matchesLicenseDomain,
  scaffoldProject,
  loadConfig,
  validateConfig,
  saveConfig,
  personalizeGeneratedProject,
  applyLogoToProject,
} = require("@vecvel/drm-wrap/core");

let mainWindow = null;
let runningProcess = null;
let runningTask = null;

function checkLicenseOrThrow(baseUrl) {
  const result = getActiveLicense();
  if (!result.valid) {
    throw new Error(result.reason);
  }
  if (baseUrl && !matchesLicenseDomain(result.payload, baseUrl)) {
    throw new Error(
      `This license is locked to "${result.payload.domain}", which does not match "${baseUrl}".`
    );
  }
  return result.payload;
}

function listReleaseArtifacts(targetDir) {
  const releaseDir = path.join(targetDir, "release");
  const extensions = new Set([".exe", ".dmg", ".zip"]);
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".app")) {
          results.push(fullPath);
        } else {
          walk(fullPath);
        }
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  walk(releaseDir);
  return results;
}

function postProcessMacReleaseArtifacts(targetDir) {
  if (process.platform !== "darwin") return;
  const releaseDir = path.join(targetDir, "release");
  if (!fs.existsSync(releaseDir)) return;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".app")) {
          try {
            // Strip quarantine flag and apply valid ad-hoc signature so macOS Gatekeeper / XProtect allows local launch
            execFileSync("xattr", ["-cr", fullPath], { stdio: "ignore" });
            execFileSync("codesign", ["--force", "--deep", "--sign", "-", fullPath], { stdio: "ignore" });
            sendLog("build", "stdout", `✓ Ad-hoc signed & unquarantined for local macOS launch: ${entry.name}\n`);
          } catch (err) {
            sendLog("build", "stderr", `Notice: Ad-hoc signing ${entry.name}: ${err.message}\n`);
          }
        } else {
          walk(fullPath);
        }
      } else if (entry.name.endsWith(".dmg") || entry.name.endsWith(".zip")) {
        try {
          execFileSync("xattr", ["-cr", fullPath], { stdio: "ignore" });
        } catch {}
      }
    }
  }

  walk(releaseDir);
}

function unquarantinePath(targetPath) {
  if (process.platform !== "darwin") return false;
  if (!fs.existsSync(targetPath)) return false;
  try {
    execFileSync("xattr", ["-cr", targetPath], { stdio: "ignore" });
    if (targetPath.endsWith(".app")) {
      execFileSync("codesign", ["--force", "--deep", "--sign", "-", targetPath], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function sendLog(task, stream, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("studio:log", { task, stream, line: data.toString() });
  }
}

function sendProcessDone(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("studio:process-done", payload);
  }
}

function resolveVendoredElectronPath(targetDir) {
  const electronPkgDir = path.join(targetDir, "node_modules", "electron");
  const pathFile = path.join(electronPkgDir, "path.txt");
  if (!fs.existsSync(pathFile)) {
    throw new Error('Electron is not installed in this project yet. Click "Install Dependencies" first.');
  }
  const relExe = fs.readFileSync(pathFile, "utf-8").trim();
  const exePath = path.join(electronPkgDir, "dist", relExe);
  if (!fs.existsSync(exePath)) {
    throw new Error(`Electron binary not found at ${exePath}. Try clicking "Install Dependencies" again.`);
  }
  return exePath;
}

function resolveVendoredElectronBuilderCli(targetDir) {
  const localCli = path.join(targetDir, "node_modules", "electron-builder", "cli.js");
  if (fs.existsSync(localCli)) {
    return localCli;
  }
  try {
    return require.resolve("electron-builder/cli.js");
  } catch {
    throw new Error('electron-builder CLI not found. Please click "Install Dependencies" first.');
  }
}

function checkVendoredDependenciesReady(targetDir) {
  const mainJs = path.join(targetDir, "electron", "main.js");
  if (!fs.existsSync(mainJs)) {
    throw new Error('Invalid project: electron/main.js was not found in this project.');
  }
}

function getExtendedEnv() {
  const currentPath = process.env.PATH || "";
  const sep = process.platform === "win32" ? ";" : ":";
  const extraPaths =
    process.platform === "darwin"
      ? [
          "/usr/local/bin",
          "/opt/homebrew/bin",
          "/opt/homebrew/sbin",
          path.join(os.homedir(), ".nvm/versions/node/v20/bin"),
          path.join(os.homedir(), ".nvm/versions/node/v22/bin"),
        ]
      : process.platform === "win32"
      ? [
          "C:\\Program Files\\nodejs",
          path.join(os.homedir(), "AppData\\Roaming\\npm"),
        ]
      : ["/usr/local/bin", "/usr/bin", "/bin"];

  return {
    ...process.env,
    PATH: `${extraPaths.join(sep)}${sep}${currentPath}`,
    FORCE_COLOR: "1",
    ELECTRON_RUN_AS_NODE: "",
  };
}

function runNpmInstall(targetDir) {
  if (runningProcess || runningTask) {
    throw new Error(`A "${runningTask}" task is already running.`);
  }
  runningTask = "install";

  // Use shell: true so npm is resolved from the augmented PATH on all platforms
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["install", "--no-audit", "--no-fund", "--prefer-offline"], {
    cwd: targetDir,
    shell: true,
    env: getExtendedEnv(),
  });
  runningProcess = child;

  child.stdout?.on("data", (data) => sendLog("install", "stdout", data));
  child.stderr?.on("data", (data) => sendLog("install", "stderr", data));

  const finishInstall = (code, error) => {
    runningProcess = null;
    runningTask = null;

    if (code === 0) {
      // On macOS: ad-hoc codesign the downloaded Electron binary so
      // Preview App works without Gatekeeper quarantine issues.
      if (process.platform === "darwin") {
        try {
          const { execFileSync } = require("node:child_process");
          const destNodeModules = path.join(targetDir, "node_modules");
          const pathFile = path.join(destNodeModules, "electron", "path.txt");
          if (fs.existsSync(pathFile)) {
            const relExe = fs.readFileSync(pathFile, "utf-8").trim();
            const exePath = path.join(destNodeModules, "electron", "dist", relExe);
            const electronApp = path.join(destNodeModules, "electron", "dist", "Electron.app");
            sendLog("install", "stdout", "Configuring macOS permissions for Electron...\n");
            if (fs.existsSync(electronApp)) {
              execFileSync("xattr", ["-cr", electronApp], { stdio: "ignore" });
              execFileSync("codesign", ["--force", "--deep", "--sign", "-", electronApp], { stdio: "ignore" });
            } else if (fs.existsSync(exePath)) {
              fs.chmodSync(exePath, 0o755);
              execFileSync("codesign", ["--force", "--sign", "-", exePath], { stdio: "ignore" });
            }
          }
        } catch (e) {
          sendLog("install", "stdout", `Note: ad-hoc signing skipped: ${e.message}\n`);
        }
      }
      sendLog("install", "stdout", "Done — dependencies installed successfully.\n");
      sendProcessDone({ task: "install", success: true, code: 0 });
    } else {
      const msg = error ? error.message : `npm install exited with code ${code}.`;
      sendLog("install", "stderr", `${msg}\n`);
      sendProcessDone({ task: "install", success: false, code, error: msg });
    }
  };

  child.on("close", (code) => finishInstall(code, null));
  child.on("error", (err) => finishInstall(null, err));

  return { started: true, task: "install" };
}

function runTask(task, cwd, command, args, extraEnv = {}) {
  if (runningProcess) {
    throw new Error(`A "${runningTask}" task is already running.`);
  }

  runningTask = task;
  const child = spawn(command, args, {
    cwd,
    shell: process.platform === "win32",
    env: { ...getExtendedEnv(), ...extraEnv },
  });
  runningProcess = child;

  child.stdout?.on("data", (data) => sendLog(task, "stdout", data));
  child.stderr?.on("data", (data) => sendLog(task, "stderr", data));

  const finish = (payload) => {
    runningProcess = null;
    runningTask = null;
    if (task === "build" && payload.success) {
      postProcessMacReleaseArtifacts(cwd);
    }
    const artifacts = task === "build" && payload.success ? listReleaseArtifacts(cwd) : undefined;
    sendProcessDone({ task, ...payload, artifacts });
  };

  child.on("close", (code) => finish({ success: code === 0, code }));
  child.on("error", (error) => finish({ success: false, code: null, error: error.message }));

  return { started: true, task };
}

function registerIpcHandlers() {
  ipcMain.handle("studio:license:status", () => getActiveLicense());
  ipcMain.handle("studio:license:activate", (_event, key) => activateLicense(key));
  ipcMain.handle("studio:license:deactivate", () => {
    deactivateLicense();
    return { valid: false, reason: "Deactivated." };
  });

  ipcMain.handle("studio:dialog:chooseDirectory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("studio:dialog:chooseLogo", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("studio:dialog:chooseExistingProject", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("studio:project:scaffold", async (_event, options) => {
    checkLicenseOrThrow(options.baseUrl);
    return scaffoldProject(options);
  });

  ipcMain.handle("studio:project:loadConfig", (_event, targetDir) => loadConfig(targetDir));

  ipcMain.handle("studio:project:saveConfig", async (_event, targetDir, partialConfig) => {
    const existing = loadConfig(targetDir);
    const merged = validateConfig({
      ...existing,
      ...partialConfig,
      features: { ...existing.features, ...(partialConfig.features ?? {}) },
    });
    saveConfig(merged, targetDir);
    await personalizeGeneratedProject(targetDir, merged.appName);
    return merged;
  });

  ipcMain.handle("studio:project:setLogo", async (_event, targetDir, logoPath) => {
    let chosen = logoPath;
    if (!chosen) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
      });
      if (result.canceled || !result.filePaths[0]) {
        return null;
      }
      chosen = result.filePaths[0];
    }
    await applyLogoToProject(targetDir, chosen);
    return { success: true, logoPath: path.join(targetDir, "public", "logo.png") };
  });

  ipcMain.handle("studio:project:loadLogoDataUrl", async (_event, targetDir) => {
    const logoFile = path.join(targetDir, "public", "logo.png");
    if (!fs.existsSync(logoFile)) return null;
    const buf = await fs.promises.readFile(logoFile);
    return `data:image/png;base64,${buf.toString("base64")}`;
  });

  ipcMain.handle("studio:project:openInFileManager", (_event, targetPath) => {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      shell.openPath(targetPath);
    } else {
      shell.showItemInFolder(targetPath);
    }
  });

  ipcMain.handle("studio:project:install", (_event, targetDir) => runNpmInstall(targetDir));

  ipcMain.handle("studio:project:dev", (_event, targetDir) => {
    checkVendoredDependenciesReady(targetDir);
    let electronBinary = process.execPath;
    try {
      const local = resolveVendoredElectronPath(targetDir);
      if (fs.existsSync(local)) electronBinary = local;
    } catch {}
    return runTask("dev", targetDir, electronBinary, [targetDir], { NODE_ENV: "development" });
  });

  ipcMain.handle("studio:project:stopDev", () => {
    if (runningTask === "dev" && runningProcess) {
      runningProcess.kill();
      return { stopped: true };
    }
    return { stopped: false };
  });

  ipcMain.handle("studio:project:build", (_event, targetDir) => {
    const config = loadConfig(targetDir);
    checkLicenseOrThrow(config.baseUrl);
    const cliPath = resolveVendoredElectronBuilderCli(targetDir);
    // electron-builder is a Node CLI; run it under DRMWrap's own bundled
    // Electron binary in "plain Node" mode instead of requiring a system
    // Node.js install (see ELECTRON_RUN_AS_NODE in Electron's docs).
    // process.defaultApp = true tells yargs not to treat the script path as an argument.
    // ELECTRON_NO_ASAR = 1 disables Electron's asar fs interception so packaging works.
    return runTask(
      "build",
      targetDir,
      process.execPath,
      [
        "-e",
        "process.defaultApp = true; require(process.argv[1]);",
        cliPath,
        "--config",
        "electron-builder.yml",
        "-c.mac.hardenedRuntime=false",
        "-c.mac.identity=null",
      ],
      {
        ELECTRON_RUN_AS_NODE: "1",
        ELECTRON_NO_ASAR: "1",
        CSC_IDENTITY_AUTO_DISCOVERY: "false",
      }
    );
  });

  ipcMain.handle("studio:project:unquarantine", async (_event, targetPath) => {
    let chosen = targetPath;
    if (!chosen) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [{ name: "Applications & Installers", extensions: ["app", "dmg", "zip"] }],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      chosen = result.filePaths[0];
    }
    const success = unquarantinePath(chosen);
    return { success, path: chosen };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    title: "DRMWrap",
    icon: path.join(__dirname, "..", "public", "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "public", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("context-menu", (_event, params) => {
    const items = [];
    if (params.selectionText && params.selectionText.trim().length > 0) {
      items.push({ role: "copy" });
    }
    if (params.isEditable) {
      items.push({ role: "paste" });
      items.push({ role: "cut" });
    }
    items.push({ role: "selectAll" });
    if (items.length > 0) {
      Menu.buildFromTemplate(items).popup();
    }
  });
}

function setupApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
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
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  setupApplicationMenu();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (runningProcess) {
    runningProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
