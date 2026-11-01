function applyContentProtection(win, enabled) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setContentProtection(Boolean(enabled));
  } catch {}
}

function isContentProtectionSupported() {
  return process.platform === "win32" || process.platform === "darwin";
}

module.exports = { applyContentProtection, isContentProtectionSupported };
