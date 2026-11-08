# DRMWrap

A real, installable Electron GUI for `drm-wrap` — the non-technical alternative to the CLI. Install it
like any other desktop app, activate a license key, and use its wizard/dashboard to turn a website into
a DRM-protected desktop app without ever opening a terminal — **or installing Node.js**. DRMWrap ships
its own copy of Electron and electron-builder and hands them to every project it creates; the end user
never needs any tooling of their own.

DRMWrap is a thin GUI shell: every action (scaffolding a project, loading/saving config, license
verification, content protection) calls straight into `drm-wrap/core` — the exact same engine the CLI
uses. There is one implementation of the product logic; this package only adds screens around it.

## Screens

- **License** — paste an activation key (`drm-wrap license activate` equivalent).
- **Home** — create a new app, or open one you already created.
- **New App wizard** — app name, website URL, logo, target folder, protection feature toggles.
- **License details** — full license info (customer, tier, domain lock, issued/expires), re-enter a
  different key, or deactivate.
- **Project dashboard** — two tabs:
  - *Settings*: edit app name / base URL / feature toggles for an existing project.
  - *Build & Run*: vendor tooling into the project, preview the generated app, or build installers — with
    a live log console streamed from the underlying process, and a "Reveal" button for each produced
    installer file once a build succeeds.

## Running it locally

```bash
# from the repo root
npm install
npm run build --workspace=@vecvel/drm-wrap   # DRMWrap depends on @vecvel/drm-wrap/core — build it first
npm run dev:studio
```

## Architecture notes

- `electron/preload.js` exposes a minimal `window.__DRM_STUDIO__` bridge (contextIsolation on,
  nodeIntegration off, sandbox on) — the renderer never touches Node/Electron APIs directly.
- `electron/main.js` implements every IPC handler: license (activate/status/deactivate), native dialogs
  (choose folder/logo/existing project), project scaffolding (`drm-wrap/core`'s `scaffoldProject`),
  config load/save, and the self-contained build pipeline below.
- `public/app.js` is a tiny router (`window.DRMStudio`) — screens (`public/screens/*.js`) are plain
  classic scripts that register themselves onto `window.DRMStudio.screens`, no build step, no framework.
  It also ships a stub bridge so the UI can be opened directly in a browser (no Electron) for layout
  work — see the comment at the top of `app.js` for the exact screen contract.
- Packaged the same way as `packages/desktop-app` (`electron-builder.yml`, pinned `electronVersion` to
  dodge the npm-workspaces version-detection issue — see the root README's CI section).

### Fully self-contained builds (no system Node.js/npm)

DRMWrap's own `electron-builder.yml` bundles its **entire** resolved `node_modules` into the packaged
app (`files: node_modules/**/*`) — including `electron`, `electron-builder`, and `drm-wrap` themselves,
with their full dependency trees. "Install Dependencies" in the dashboard doesn't run `npm install`; it
copies DRMWrap's own already-resolved copies of these straight into the generated project
(`resolveVendorNodeModulesDir()` + a plain recursive `fs.copy` in `main.js`, `dereference: true` so
workspace symlinks become real, portable files). From there:

- **Preview** spawns the vendored `node_modules/electron`'s real binary directly (resolved the same way
  the `electron` npm package resolves itself — `require(".../node_modules/electron")` — no `npx`).
- **Build** runs the vendored `node_modules/electron-builder/cli.js` under DRMWrap's *own* Electron
  binary (`process.execPath`) with `ELECTRON_RUN_AS_NODE=1`, which makes any Electron binary behave as a
  plain Node.js process — a standard technique for shipping a bundled Node runtime inside an Electron
  app, used here so electron-builder (a Node CLI tool) runs without a system Node.js install at all.

**Known tradeoff:** this is a straight copy of the whole tree, not a minimal dependency closure, so it
vendors more than a generated project strictly needs (~900MB observed) in exchange for guaranteed
correctness with zero extra resolver logic to maintain. It also means DRMWrap's own installer is
correspondingly large, since it has to carry that same tree once to hand off. Shrinking this to a real
minimal closure (electron + electron-builder + their actual transitive deps only, excluding drm-wrap's
CLI-only deps like `@clack/prompts`/`commander`/`chokidar` that a generated project never uses) is a
worthwhile follow-up, not yet done.
