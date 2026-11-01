// Bundles the desktop-app template into this package so `drm-wrap init` can
// scaffold a new project even after this package is published standalone
// (not run from inside the monorepo). See src/cli/commands/init.ts, which
// prefers ./templates/desktop-app and falls back to the sibling workspace
// package for monorepo-local development.
const fs = require("fs-extra");
const path = require("node:path");

const src = path.join(__dirname, "..", "..", "desktop-app");
const dest = path.join(__dirname, "..", "templates", "desktop-app");

if (!fs.existsSync(src)) {
  console.warn("[drm-wrap] packages/desktop-app not found, skipping template copy");
  process.exit(0);
}

fs.removeSync(dest);
fs.copySync(src, dest, {
  filter: (fromPath) => {
    const rel = path.relative(src, fromPath);
    return !/(^|\/)(node_modules|dist|release)(\/|$)/.test(rel);
  },
});
console.log("[drm-wrap] copied desktop-app template ->", path.relative(process.cwd(), dest));
