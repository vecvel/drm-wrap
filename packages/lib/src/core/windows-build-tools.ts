import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const WIN_CODE_SIGN = "winCodeSign-2.6.0";
const WIN_CODE_SIGN_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${WIN_CODE_SIGN}/${WIN_CODE_SIGN}.7z`;

function electronBuilderCacheDir(): string {
  if (process.env.ELECTRON_BUILDER_CACHE) return process.env.ELECTRON_BUILDER_CACHE;
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "electron-builder", "Cache");
}

/**
 * electron-builder 24 downloads winCodeSign on Windows (it carries rcedit, used
 * to stamp the icon and version into the .exe even for unsigned builds). The
 * archive contains macOS symlinks, and 7-Zip can't create symlinks for a
 * normal Windows user unless Developer Mode is on, so the build fails with
 * "Cannot create symbolic link". Extracting it ourselves without the darwin
 * folder and placing it where electron-builder looks first avoids that.
 *
 * Returns the cache directory it prepared, or null when nothing was needed.
 */
export async function prepareWindowsBuildTools(
  projectDir: string,
  log: (line: string) => void = () => {}
): Promise<string | null> {
  if (process.platform !== "win32") return null;

  const target = path.join(electronBuilderCacheDir(), "winCodeSign", WIN_CODE_SIGN);
  if (await fs.pathExists(path.join(target, "rcedit-x64.exe"))) return null;

  const sevenZip = path.join(projectDir, "node_modules", "7zip-bin", "win", process.arch === "ia32" ? "ia32" : "x64", "7za.exe");
  if (!(await fs.pathExists(sevenZip))) {
    throw new Error('7-Zip from electron-builder was not found. Click "Install Dependencies" first.');
  }

  log(`Preparing ${WIN_CODE_SIGN} for electron-builder...\n`);
  const work = path.join(os.tmpdir(), `drm-wrap-${WIN_CODE_SIGN}-${process.pid}`);
  await fs.remove(work);
  await fs.ensureDir(work);
  try {
    const archive = path.join(work, `${WIN_CODE_SIGN}.7z`);
    const res = await fetch(WIN_CODE_SIGN_URL);
    if (!res.ok) throw new Error(`Downloading ${WIN_CODE_SIGN} failed: HTTP ${res.status}`);
    await fs.writeFile(archive, Buffer.from(await res.arrayBuffer()));

    const extracted = path.join(work, "out");
    execFileSync(sevenZip, ["x", "-bd", "-y", `-o${extracted}`, "-xr!darwin", archive], { stdio: "ignore", windowsHide: true });

    await fs.ensureDir(path.dirname(target));
    await fs.remove(target);
    await fs.move(extracted, target);
    log(`Prepared ${target}\n`);
    return target;
  } finally {
    await fs.remove(work).catch(() => {});
  }
}
