/**
 * Public half of the vendor's Ed25519 license-signing keypair. Safe to ship
 * inside the published package — it can only verify tokens, never create
 * them. The matching private key lives only in packages/license-admin
 * (gitignored, never published, never imported by this package).
 */
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAXmXJSCjIdFJZFhyxnjYERSz8Ybz6eBA57TrdbHZTFlc=
-----END PUBLIC KEY-----
`;
