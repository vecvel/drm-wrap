// Runs with contextIsolation: true, nodeIntegration: false, sandbox: true.
// Only this file has Node/Electron access on the renderer side; it exposes
// a minimal, read-mostly bridge under `window.__DRM_WRAP__` and nothing else
// (SDD 4.3 / 7.3: preload exposes the smallest possible safe API surface).
const { contextBridge, ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("./ipc-channels");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("__DRM_WRAP__", {
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  toggleInvisible: () => ipcRenderer.send(IPC_CHANNELS.TOGGLE_INVISIBLE),
  setProtection: (enabled) => ipcRenderer.send(IPC_CHANNELS.SET_PROTECTION, !!enabled),

  onDetectionEvent: (callback) => subscribe(IPC_CHANNELS.DETECTION_EVENT, callback),
  onBlank: (callback) => subscribe(IPC_CHANNELS.BLANK_ELEMENTS, callback),
  onUnblank: (callback) => subscribe(IPC_CHANNELS.UNBLANK_ELEMENTS, callback),
  onWatermarkUpdate: (callback) => subscribe(IPC_CHANNELS.UPDATE_WATERMARK, callback),
  onInvisibleState: (callback) => subscribe(IPC_CHANNELS.INVISIBLE_STATE, callback),
  onConfigUpdated: (callback) => subscribe(IPC_CHANNELS.CONFIG_UPDATED, callback),
});
