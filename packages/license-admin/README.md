# drm-wrap-license-admin (internal, vendor-only)

Issues signed license keys that gate use of the `drm-wrap` CLI (`init` and `build`). This package is
**never published** and has **no dependency on `drm-wrap`** — it holds the private signing key, so it
must stay fully decoupled from the customer-facing package.

## How it works

- License keys are Ed25519-signed tokens: `base64url(JSON payload).base64url(signature)`.
- The **private** key lives at `keys/private.pem` (generated once, gitignored, never committed, never
  shipped). Losing it means you can no longer issue new licenses under the same public key; leaking it
  means anyone could forge licenses.
- The matching **public** key is embedded in `packages/lib/src/core/license/public-key.ts` — that's the
  only piece that ships to customers. It can verify a license, but can never create one.
- `packages/lib`'s CLI calls `requireLicense()` at the top of `init` and `build` (see
  `packages/lib/src/cli/require-license.ts`), which verifies the activated license's signature and
  expiry, and — if the license has a `domain` lock — checks it against the project's `baseUrl`.

## Issuing a license

```bash
cd packages/license-admin
node scripts/issue-license.js --customer "Acme Inc" --email acme@example.com --tier single
# optional: --domain acme.com   (locks the license to that domain + subdomains)
# optional: --expires 2027-01-01   (omit for a perpetual license)
```

This prints the license key to send the customer, and appends a record (including the full token, for
recovery) to `issued-licenses.json` — a local, gitignored ledger. There is no license *server*; keys are
verified entirely offline by the customer's copy of `drm-wrap`, so revoking a license already handed out
isn't possible without shipping a new public key (a key rotation, which invalidates every previously
issued license — see `scripts/keygen.js`'s warning).

## The customer's side

```bash
drm-wrap license activate <key>   # verifies + stores in ~/.drm-wrap/license.json
drm-wrap license status
drm-wrap license deactivate
```

`DRM_WRAP_LICENSE_KEY` as an environment variable overrides the stored file (useful in CI) — see
`packages/lib/src/core/license/store.ts`.

## Key rotation

Only do this if you're prepared to re-issue every license you've handed out — it invalidates all of
them, since the published package only embeds one public key at a time.

```bash
rm keys/private.pem keys/public.pem   # only if you're sure
node scripts/keygen.js
# paste the printed public key into packages/lib/src/core/license/public-key.ts
```
