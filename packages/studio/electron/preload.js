// Runs with contextIsolation: true, nodeIntegration: false, sandbox: true.
// Exposes the only API the Studio UI has: no direct fs/child_process/node
// access, everything goes through main.js via these specific IPC calls.
const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("__DRM_STUDIO__", {
  license: {
    status: () => ipcRenderer.invoke("studio:license:status"),
    activate: (key) => ipcRenderer.invoke("studio:license:activate", key),
    deactivate: () => ipcRenderer.invoke("studio:license:deactivate"),
  },

  dialogs: {
    chooseDirectory: () => ipcRenderer.invoke("studio:dialog:chooseDirectory"),
    chooseLogo: () => ipcRenderer.invoke("studio:dialog:chooseLogo"),
    chooseExistingProject: () => ipcRenderer.invoke("studio:dialog:chooseExistingProject"),
  },

  project: {
    scaffold: (options) => ipcRenderer.invoke("studio:project:scaffold", options),
    loadConfig: (targetDir) => ipcRenderer.invoke("studio:project:loadConfig", targetDir),
    saveConfig: (targetDir, partialConfig) =>
      ipcRenderer.invoke("studio:project:saveConfig", targetDir, partialConfig),
    openInFileManager: (targetPath) => ipcRenderer.invoke("studio:project:openInFileManager", targetPath),
    setLogo: (targetDir, logoPath) => ipcRenderer.invoke("studio:project:setLogo", targetDir, logoPath),
    loadLogoDataUrl: (targetDir) => ipcRenderer.invoke("studio:project:loadLogoDataUrl", targetDir),
    install: (targetDir) => ipcRenderer.invoke("studio:project:install", targetDir),
    dev: (targetDir) => ipcRenderer.invoke("studio:project:dev", targetDir),
    stopDev: () => ipcRenderer.invoke("studio:project:stopDev"),
    build: (targetDir) => ipcRenderer.invoke("studio:project:build", targetDir),
    unquarantine: (targetPath) => ipcRenderer.invoke("studio:project:unquarantine", targetPath),
  },

  onLog: (callback) => subscribe("studio:log", callback),
  onProcessDone: (callback) => subscribe("studio:process-done", callback),
});
