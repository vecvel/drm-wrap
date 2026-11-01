# @vecvel/drm-wrap

Convert any website into a secure, DRM-protected Electron desktop app — anti-screenshot / anti-screen-recording protection, a dynamic watermark, and an invisible mode that hides the app during meeting screen shares. No Electron knowledge required. Full spec: [`DRMwrap.md`](../../DRMwrap.md).

## License activation

`init` and `build` require an activated license (see [`DRMwrap.md`](../../DRMwrap.md) — this is our own
commercial gate, not part of the original spec). If you don't have a key yet, `drm-wrap` will tell you
so and exit; otherwise:

```bash
drm-wrap license activate <key>   # one-time, stored at ~/.drm-wrap/license.json
drm-wrap license status
drm-wrap license deactivate
```

A key can optionally be domain-locked (it'll only work for a project whose `baseUrl` is on that domain).
`DRM_WRAP_LICENSE_KEY` as an env var works too, without activating — handy for CI.

## Install & usage

```bash
# Scaffold a new project (interactive: app name, base URL, logo, features)
npx @vecvel/drm-wrap init

# Adjust feature toggles / window / build settings later
npx drm-wrap config

# Run the generated app in development, with hot reload on config changes
npx drm-wrap dev

# Build production installers (Windows .exe, macOS .dmg)
npx drm-wrap build

# Refresh the bundled detection signature database
npx drm-wrap update-signatures
```

`init` generates a full Electron project next to your website config (main process, preload bridge, injected DRM renderer layer, `electron-builder.yml`) per the layout in [DRMwrap.md §13](../../DRMwrap.md#13-project-structure-after-init). `build` produces `dist/<App Name> Setup x.x.x.exe` and `dist/<App Name> x.x.x.dmg`.

## `drm-wrap.config.json`

Every generated project is driven by a single config file, validated with Zod (see [DRMwrap.md §8](../../DRMwrap.md#8-configuration-schema)):

```json
{
  "appName": "My Secure Portal",
  "baseUrl": "https://example.com",
  "version": "1.0.0",
  "features": {
    "fullProtection": true,
    "selectiveProtection": true,
    "detectScreenRecording": true,
    "detectSnippingTools": true,
    "invisibleMode": true,
    "autoInvisibleMode": false,
    "dynamicWatermark": true,
    "watermarkOpacity": 0.12
  },
  "window": {
    "width": 1440,
    "height": 900,
    "minWidth": 1024,
    "minHeight": 700,
    "center": true
  },
  "build": {
    "windows": {
      "target": ["nsis", "portable"]
    },
    "mac": {
      "target": ["dmg", "zip"]
    }
  }
}
```

Edit it directly, or run `drm-wrap config` for interactive prompts. `drm-wrap dev` watches this file and hot-reloads the running app when it changes.

## The `data-drm` HTML attribute contract

Website developers can optionally mark up their pages to control protection granularity — no other code changes are required (see [DRMwrap.md §6](../../DRMwrap.md#6-html-integration-contract-for-website-developers)):

```html
<!-- Protect the entire page -->
<body data-drm="full">

<!-- Protect a specific section -->
<div data-drm="section">
  Sensitive content
</div>

<!-- Maximum protection + forced watermark -->
<section data-drm="high">
  Highly confidential content
</section>

<!-- Using class (alternative) -->
<div class="drm-protect">
  ...
</div>
```

Supported values:

| Attribute / class | Effect |
|---|---|
| `data-drm="full"` | Entire page is under protection |
| `data-drm="section"` | Only this element is protected |
| `data-drm="high"` | Highest protection level, plus a forced watermark |
| `class="drm-protect"` | Treated as section-level protection |

If no `data-drm` attributes are present anywhere on the page and Full App Protection is enabled (the default), the whole window is protected regardless.

## Programmatic exports (`@vecvel/drm-wrap/core`)

The package also exposes its detection/protection engine, shared types, IPC channel constants, and config loader as `require("@vecvel/drm-wrap/core")` (or `require("@vecvel/drm-wrap")`, an alias for the same entry point). This is what the generated Electron app's **main process** imports to run the detection engine, apply content protection, manage invisible mode, and load/watch `drm-wrap.config.json` — it is not typically something end users import directly, since the CLI already wires it up for you inside every project `init` generates.
