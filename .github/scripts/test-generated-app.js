// Generates a desktop app from the template the same way DRMWrap Studio does,
// installs it, builds installers with electron-builder started the same way
// Studio starts it, then launches the built app to check it stays up.
//
// Run from the repo root after `npm ci && npm run build`.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { scaffoldProject, prepareWindowsBuildTools } = require("@vecvel/drm-wrap/core");

const isWin = process.platform === "win32";
const APP_NAME = "CI Test App";
// Spaces on purpose: paths with spaces are what broke the Windows build.
const projectDir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "drm wrap test", "CI Test App");

function run(label, command, args, options) {
  console.log(`\n::group::${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      console.log("::endgroup::");
      code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

function find(dir, test) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (test(entry, full)) out.push(full);
    else if (entry.isDirectory()) out.push(...find(full, test));
  }
  return out;
}

async function smokeTest(executable) {
  console.log(`\nLaunching ${executable}`);
  const child = spawn(executable, [], { stdio: "inherit" });
  let exitCode = null;
  child.on("exit", (code) => (exitCode = code));
  await new Promise((r) => setTimeout(r, 15000));
  if (exitCode !== null) throw new Error(`App exited after launch with code ${exitCode}`);
  child.kill();
  console.log("App was still running after 15s.");
}

(async () => {
  fs.rmSync(projectDir, { recursive: true, force: true });

  const { config } = await scaffoldProject({
    targetDir: projectDir,
    appName: APP_NAME,
    baseUrl: "https://example.com",
    features: {},
  });
  console.log(`Generated ${config.appName} in ${projectDir}`);

  // Studio: runNpmInstall
  await run("npm install", isWin ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund", "--prefer-offline"], {
    cwd: projectDir,
    shell: true,
  });

  await prepareWindowsBuildTools(projectDir, (line) => process.stdout.write(line));

  // Studio: studio:project:build, with this repo's Electron standing in for Studio's own binary.
  const electronBinary = require("electron");
  const cliPath = path.join(projectDir, "node_modules", "electron-builder", "cli.js");
  await run(
    "electron-builder",
    electronBinary,
    [
      "-e",
      "process.defaultApp = true; require(process.argv[1]);",
      cliPath,
      "--config",
      "electron-builder.yml",
      "-c.mac.hardenedRuntime=false",
      "-c.mac.identity=null",
    ],
    {
      cwd: projectDir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ELECTRON_NO_ASAR: "1", CSC_IDENTITY_AUTO_DISCOVERY: "false" },
    }
  );

  const releaseDir = path.join(projectDir, "release");
  const installers = find(releaseDir, (e) => e.isFile() && /\.(exe|dmg|zip)$/i.test(e.name));
  console.log("\nInstallers:\n" + installers.map((f) => "  " + path.relative(releaseDir, f)).join("\n"));
  const expected = isWin ? [/Setup .*\.exe$/, /\.zip$/] : [/\.dmg$/, /\.zip$/];
  for (const pattern of expected) {
    if (!installers.some((f) => pattern.test(f))) throw new Error(`No installer matching ${pattern}`);
  }

  const executable = isWin
    ? path.join(releaseDir, "win-unpacked", `${APP_NAME}.exe`)
    : find(releaseDir, (e) => e.isDirectory() && e.name === `${APP_NAME}.app`).map((app) => path.join(app, "Contents", "MacOS", APP_NAME))[0];
  if (!executable || !fs.existsSync(executable)) throw new Error("Built app executable not found");
  await smokeTest(executable);
})().catch((error) => {
  console.error(`\n${error.stack || error.message}`);
  process.exit(1);
});
