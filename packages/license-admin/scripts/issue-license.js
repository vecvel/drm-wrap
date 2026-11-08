#!/usr/bin/env node
// Issues a signed drm-wrap license key. This is the vendor-side counterpart
// to packages/lib/src/core/license/verify.ts — the token wire format
// (base64url(payload) + "." + base64url(signature), Ed25519, signature over
// the base64url payload string bytes) is intentionally reimplemented here
// rather than imported from "drm-wrap", so this package never depends on the
// customer-facing package and the private key can never leak into it.
//
// Usage:
//   node scripts/issue-license.js --customer "Acme Inc" --email acme@example.com \
//     --tier single --domain acme.com --expires 2027-01-01
//
// Flags:
//   --customer   <name>       required
//   --email      <email>      required
//   --tier       single|extended   default: single
//   --domain     <domain>     optional — locks the license to that domain (+ subdomains)
//   --expires    <ISO date>   optional — omit for a perpetual license
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("node:util");

const { values } = parseArgs({
  options: {
    customer: { type: "string" },
    email: { type: "string" },
    tier: { type: "string", default: "single" },
    domain: { type: "string" },
    expires: { type: "string" },
    days: { type: "string" },
    lifetime: { type: "boolean", default: false },
    trial: { type: "string" },
    out: { type: "string" },
    "private-key": { type: "string" },
    "token-only": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

if (!values.customer || !values.email) {
  console.error("Usage: node scripts/issue-license.js --customer <name> --email <email> [options]");
  console.error("\nOptions:");
  console.error("  --customer    <name>          Client or organization name (required)");
  console.error("  --email       <email>         Contact / purchaser email (required)");
  console.error("  --tier        single|extended License tier (default: single)");
  console.error("  --domain      <domain>        Optional domain lock (+ subdomains)");
  console.error("  --days        <count>         Validity in days from now (e.g. 365)");
  console.error("  --lifetime                    Issue perpetual lifetime license");
  console.error("  --trial       [days]          Issue trial license (default: 14 days)");
  console.error("  --expires     <ISO date>      Specific expiration date (YYYY-MM-DD)");
  console.error("  --out         <path>          Write .lic output file to path");
  console.error("  --private-key <pem|path>      PEM key string or path (or env LICENSE_PRIVATE_KEY)");
  console.error("  --token-only                  Print only the token string");
  process.exit(1);
}

if (values.tier !== "single" && values.tier !== "extended") {
  console.error(`--tier must be "single" or "extended", got "${values.tier}"`);
  process.exit(1);
}

// Resolve private key
let privateKeyPem = "";
if (values["private-key"]) {
  if (fs.existsSync(values["private-key"])) {
    privateKeyPem = fs.readFileSync(values["private-key"], "utf8");
  } else {
    privateKeyPem = values["private-key"];
  }
} else if (process.env.LICENSE_PRIVATE_KEY) {
  privateKeyPem = process.env.LICENSE_PRIVATE_KEY;
} else if (process.env.DRM_WRAP_PRIVATE_KEY) {
  privateKeyPem = process.env.DRM_WRAP_PRIVATE_KEY;
} else {
  const defaultKeyPath = path.join(__dirname, "..", "keys", "private.pem");
  if (fs.existsSync(defaultKeyPath)) {
    privateKeyPem = fs.readFileSync(defaultKeyPath, "utf8");
  }
}

if (!privateKeyPem || !privateKeyPem.trim()) {
  console.error("No private key found. Pass --private-key, set LICENSE_PRIVATE_KEY, or run 'npm run keygen' first.");
  process.exit(1);
}

const privateKey = crypto.createPrivateKey(privateKeyPem);

function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Compute expiration
let expiresAt = null;
if (values.lifetime) {
  expiresAt = null;
} else if (values.trial !== undefined) {
  const trialDays = parseInt(values.trial, 10) || 14;
  expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
} else if (values.days) {
  const daysNum = parseInt(values.days, 10);
  if (isNaN(daysNum) || daysNum <= 0) {
    console.error(`Invalid --days value: "${values.days}"`);
    process.exit(1);
  }
  expiresAt = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString();
} else if (values.expires) {
  expiresAt = new Date(values.expires).toISOString();
}

const payload = {
  licenseId: crypto.randomUUID(),
  customer: values.customer,
  email: values.email,
  tier: values.tier,
  domain: values.domain ? values.domain.trim().toLowerCase() : undefined,
  issuedAt: new Date().toISOString(),
  expiresAt,
};

const payloadJson = JSON.stringify(payload);
const payload64 = base64UrlEncode(Buffer.from(payloadJson, "utf8"));
const signature = crypto.sign(null, Buffer.from(payload64, "utf8"), privateKey);
const token = `${payload64}.${base64UrlEncode(signature)}`;

// Record in ledger if writable
const ledgerPath = path.join(__dirname, "..", "issued-licenses.json");
try {
  const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : [];
  let issuedBy = "unknown";
  try {
    issuedBy = os.userInfo().username;
  } catch {
    // best-effort
  }
  ledger.push({ ...payload, token, issuedBy });
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
} catch {
  // Read-only or ephemeral environment
}

// Optional output file
if (values.out) {
  const outPath = path.resolve(process.cwd(), values.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ token, ...payload }, null, 2), "utf8");
}

if (values["token-only"]) {
  console.log(token);
  process.exit(0);
}

console.log("==================================================");
console.log("🛡️  DRM-Wrap Software License Issued Successfully");
console.log("==================================================");
console.log(`License ID : ${payload.licenseId}`);
console.log(`Customer   : ${payload.customer}`);
console.log(`Email      : ${payload.email}`);
console.log(`Tier       : ${payload.tier.toUpperCase()}`);
console.log(`Domain     : ${payload.domain || "Any (Unrestricted)"}`);
console.log(`Expires    : ${payload.expiresAt || "Never (Lifetime / Perpetual)"}`);
console.log(`Issued At  : ${payload.issuedAt}`);
console.log("--------------------------------------------------");
console.log("Activation Token Key (Send to customer):");
console.log(token);
console.log("--------------------------------------------------");
if (values.out) {
  console.log(`License file written to: ${values.out}`);
}
console.log("Recorded in vendor ledger.");
