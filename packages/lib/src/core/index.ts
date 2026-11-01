export * from "./types";
export * from "./ipc-channels";
export * from "./config/schema";
export * from "./detection/engine";
export * from "./detection/process-scanner";
export * from "./protection/content-protection";
export * from "./protection/overlay";
export * from "./protection/watermark";
export * from "./invisible-mode";
export * from "./license";
export * from "./scaffold";

import signatureDatabaseJson from "./detection/signatures.json";
import type { SignatureDatabase } from "./types";

export const signatureDatabase = signatureDatabaseJson as SignatureDatabase;
