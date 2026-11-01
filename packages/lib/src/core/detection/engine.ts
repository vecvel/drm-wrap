import { EventEmitter } from "node:events";
import signaturesJson from "./signatures.json";
import { getRunningProcesses, matchProcessesAgainstSignatures } from "./process-scanner";
import type { DetectionEvent, Signature, SignatureDatabase } from "../types";

const MIN_POLL_INTERVAL_MS = 800;
const MAX_POLL_INTERVAL_MS = 1500;
const DEFAULT_POLL_INTERVAL_MS = 1200;

export interface DetectionEngineOptions {
  pollIntervalMs?: number;
  signatureDatabase?: SignatureDatabase;
  platform?: NodeJS.Platform;
}

function resolvePollIntervalMs(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, value));
}

export class DetectionEngine extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly signatureDatabase: SignatureDatabase;
  private readonly platform: NodeJS.Platform;
  private intervalHandle: NodeJS.Timeout | null = null;
  private activeSignatureIds: Set<string> = new Set();

  constructor(options: DetectionEngineOptions = {}) {
    super();
    this.pollIntervalMs = resolvePollIntervalMs(options.pollIntervalMs);
    this.signatureDatabase = options.signatureDatabase ?? (signaturesJson as SignatureDatabase);
    this.platform = options.platform ?? process.platform;
  }

  get isRunning(): boolean {
    return this.intervalHandle !== null;
  }

  start(): void {
    if (this.intervalHandle !== null) {
      return;
    }
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.activeSignatureIds = new Set();
  }

  private async tick(): Promise<void> {
    try {
      const processes = await getRunningProcesses();
      const signaturesForPlatform: Signature[] = this.signatureDatabase.signatures.filter(
        (signature) => (signature.platforms as readonly string[]).includes(this.platform)
      );
      const events = matchProcessesAgainstSignatures(processes, signaturesForPlatform, this.platform);
      // Every event from matchProcessesAgainstSignatures carries a signatureId (guaranteed by its own contract).
      const currentIds = new Set(events.map((event) => event.signatureId as string));

      for (const event of events) {
        const signatureId = event.signatureId as string;
        if (!this.activeSignatureIds.has(signatureId)) {
          this.emit("event", event);
        }
      }

      for (const signatureId of this.activeSignatureIds) {
        if (currentIds.has(signatureId)) {
          continue;
        }
        const signature = this.signatureDatabase.signatures.find((s) => s.id === signatureId);
        if (!signature) {
          continue;
        }
        const clearedEvent: DetectionEvent = {
          type: "cleared",
          category: signature.category,
          method: "process-scan",
          signatureId: signature.id,
          timestamp: Date.now(),
        };
        this.emit("event", clearedEvent);
      }

      this.activeSignatureIds = currentIds;
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export declare interface DetectionEngine {
  on(event: "event", listener: (e: DetectionEvent) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}
