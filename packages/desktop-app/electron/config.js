const fs = require("node:fs");
const path = require("node:path");

const CONFIG_FILE_NAME = "drm-wrap.config.json";

function resolveConfigPath(cwd = process.cwd()) {
  return path.join(cwd, CONFIG_FILE_NAME);
}

function loadConfig(cwd = process.cwd()) {
  const configPath = resolveConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    throw new Error(`No ${CONFIG_FILE_NAME} found in ${cwd}.`);
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function watchConfig(onChange, cwd = process.cwd()) {
  const configPath = resolveConfigPath(cwd);
  if (!fs.existsSync(configPath)) return () => {};

  let debounceTimer = null;
  let watcher = null;
  try {
    watcher = fs.watch(configPath, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          onChange(loadConfig(cwd));
        } catch (err) {
          console.error(`[drm-wrap] error reloading ${CONFIG_FILE_NAME}:`, err.message);
        }
      }, 150);
    });
  } catch {}

  return () => {
    clearTimeout(debounceTimer);
    if (watcher) watcher.close();
  };
}

module.exports = { CONFIG_FILE_NAME, resolveConfigPath, loadConfig, watchConfig };
