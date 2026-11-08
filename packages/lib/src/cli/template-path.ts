import fs from "node:fs";
import path from "node:path";

export function readOwnPackageJson(): { name: string; version: string } {
  const pkgPath = path.join(__dirname, "..", "..", "package.json");
  return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
}
