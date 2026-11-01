#!/usr/bin/env node
// Generates the vendor's Ed25519 license-signing keypair.
//
// Run this ONCE, at project inception (already done for this repo — see
// keys/private.pem, gitignored). Re-running it generates a NEW keypair,
// which invalidates every license key issued under the old one (the
// published drm-wrap package only embeds one public key at a time, in
// packages/lib/src/core/license/public-key.ts). Only re-run this if you
// intend a full key rotation and are prepared to re-issue every license.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const keysDir = path.join(__dirname, "..", "keys");
fs.mkdirSync(keysDir, { recursive: true });

const privatePath = path.join(keysDir, "private.pem");
if (fs.existsSync(privatePath)) {
  console.error(`Refusing to overwrite existing key: ${privatePath}`);
  console.error("Delete it manually first if you really intend to rotate keys.");
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(keysDir, "public.pem"), publicKey);

console.log("Generated a new Ed25519 keypair.");
console.log(`Private key: ${privatePath} (keep this secret, gitignored)`);
console.log("\nPaste this into packages/lib/src/core/license/public-key.ts:\n");
console.log(publicKey);
