const { IPC_CHANNELS } = require("../ipc-channels");

function buildWatermarkText(identity, when = new Date()) {
  return `${identity} • ${when.toISOString()}`;
}

function getWatermarkPayload(config, identity) {
  return {
    enabled: Boolean(config.features && config.features.dynamicWatermark),
    text: buildWatermarkText(identity),
    opacity: config.features ? config.features.watermarkOpacity ?? 0.12 : 0.12,
  };
}

function sendWatermarkUpdate(target, payload) {
  if (!target || target.isDestroyed()) return;
  const wc = target.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(IPC_CHANNELS.UPDATE_WATERMARK, payload);
  } catch {}
}

function startWatermarkRefresh(target, config, identity, intervalMs = 15000) {
  if (!target || target.isDestroyed()) return () => {};

  sendWatermarkUpdate(target, getWatermarkPayload(config, identity));

  let cleanedUp = false;
  let interval = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };

  interval = setInterval(() => {
    if (cleanedUp || !target || target.isDestroyed()) {
      cleanup();
      return;
    }
    const wc = target.webContents;
    if (!wc || wc.isDestroyed()) {
      cleanup();
      return;
    }
    sendWatermarkUpdate(target, getWatermarkPayload(config, identity));
  }, intervalMs);

  if (!target.isDestroyed()) {
    target.once("close", cleanup);
    target.once("closed", cleanup);
  }

  return cleanup;
}

module.exports = {
  buildWatermarkText,
  getWatermarkPayload,
  sendWatermarkUpdate,
  startWatermarkRefresh,
};
