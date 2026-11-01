const { IPC_CHANNELS } = require("../ipc-channels");

function sendBlankSignal(target, signal) {
  if (!target || target.isDestroyed()) return;
  const wc = target.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(IPC_CHANNELS.BLANK_ELEMENTS, signal);
  } catch {}
}

function sendUnblankSignal(target, level) {
  if (!target || target.isDestroyed()) return;
  const wc = target.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(IPC_CHANNELS.UNBLANK_ELEMENTS, { level });
  } catch {}
}

function blankSignalForDetection(event) {
  return { level: "all", reason: event.category };
}

module.exports = { sendBlankSignal, sendUnblankSignal, blankSignalForDetection };
