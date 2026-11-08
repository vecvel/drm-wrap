import psList from "ps-list";
import type { DetectionEvent, Signature } from "../types";

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd?: string;
  ppid?: number;
}

export async function getRunningProcesses(): Promise<ProcessInfo[]> {
  try {
    const processes = await psList();
    return processes.map((process) => ({
      pid: process.pid,
      name: process.name,
      cmd: process.cmd,
      ppid: process.ppid,
    }));
  } catch {
    return [];
  }
}

export function matchProcessesAgainstSignatures(
  processes: ProcessInfo[],
  signatures: Signature[],
  platform: NodeJS.Platform
): DetectionEvent[] {
  const events: DetectionEvent[] = [];

  for (const signature of signatures) {
    if (!(signature.platforms as readonly string[]).includes(platform)) {
      continue;
    }

    for (const process of processes) {
      const haystack = `${process.name} ${process.cmd ?? ""}`.toLowerCase();
      const matchedName = signature.processNames.find((processName) =>
        haystack.includes(processName.toLowerCase())
      );
      if (matchedName) {
        events.push({
          type: "detected",
          category: signature.category,
          method: "process-scan",
          signatureId: signature.id,
          processName: process.name,
          timestamp: Date.now(),
        });
        break;
      }
    }
  }

  return events;
}
