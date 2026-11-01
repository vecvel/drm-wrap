// Safety net: tsc emits imported .json modules into dist automatically when
// resolveJsonModule is set, but we copy explicitly too so `npm run build`
// never silently ships without the signature database.
const fs = require("fs-extra");
const path = require("node:path");

const src = path.join(__dirname, "..", "src", "core", "detection", "signatures.json");
const dest = path.join(__dirname, "..", "dist", "core", "detection", "signatures.json");

fs.ensureDirSync(path.dirname(dest));
fs.copySync(src, dest);
console.log("[drm-wrap] copied signatures.json ->", path.relative(process.cwd(), dest));
