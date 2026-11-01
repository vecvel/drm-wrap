const { EventEmitter } = require("node:events");
const signaturesJson = require("./signatures.json");
const { getRunningProcesses, matchProcessesAgainstSignatures } = require("./process-scanner");

const MIN_POLL_INTERVAL_MS = 800;
const MAX_POLL_INTERVAL_MS = 1500;
const DEFAULT_POLL_INTERVAL_MS = 1200;

class DetectionEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pollIntervalMs = Math.min(
      MAX_POLL_INTERVAL_MS,
      Math.max(MIN_POLL_INTERVAL_MS, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    );
    this.signatureDatabase = options.signatureDatabase || signaturesJson;
    this.platform = options.platform || process.platform;
    this.intervalHandle = null;
    this.activeSignatureIds = new Set();
  }

  get isRunning() {
    return this.intervalHandle !== null;
  }

  start() {
    if (this.intervalHandle !== null) return;
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.activeSignatureIds = new Set();
  }

  async tick() {
    try {
      const processes = await getRunningProcesses();
      const signatures = this.signatureDatabase.signatures || [];
      const signaturesForPlatform = signatures.filter((s) =>
        !s.platforms || s.platforms.includes(this.platform)
      );
      const events = matchProcessesAgainstSignatures(processes, signaturesForPlatform, this.platform);
      const currentIds = new Set(events.map((e) => e.signatureId));

      for (const event of events) {
        if (!this.activeSignatureIds.has(event.signatureId)) {
          this.emit("event", event);
        }
      }

      for (const signatureId of this.activeSignatureIds) {
        if (currentIds.has(signatureId)) continue;
        const signature = signatures.find((s) => s.id === signatureId);
        if (!signature) continue;
        this.emit("event", {
          type: "cleared",
          category: signature.category,
          method: "process-scan",
          signatureId: signature.id,
          timestamp: Date.now(),
        });
      }

      this.activeSignatureIds = currentIds;
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }
}

module.exports = { DetectionEngine };
