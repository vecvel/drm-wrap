const childProcess = require("node:child_process");
const path = require("node:path");

async function getRunningProcesses() {
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      childProcess.execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const lines = stdout.trim().split(/\r?\n/);
        const list = [];
        for (const line of lines) {
          const parts = line.split('","').map((s) => s.replace(/^"|"$/g, ""));
          if (parts.length >= 2) {
            list.push({
              name: parts[0],
              pid: Number.parseInt(parts[1], 10) || 0,
              cmd: parts[0],
            });
          }
        }
        resolve(list);
      });
    });
  }

  return new Promise((resolve) => {
    childProcess.execFile("ps", ["-ax", "-o", "pid=,ppid=,comm="], (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const lines = stdout.trim().split("\n");
      const list = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          list.push({
            pid: Number.parseInt(parts[0], 10) || 0,
            ppid: Number.parseInt(parts[1], 10) || 0,
            name: path.basename(parts.slice(2).join(" ")),
            cmd: parts.slice(2).join(" "),
          });
        }
      }
      resolve(list);
    });
  });
}

function matchProcessesAgainstSignatures(processes, signatures, platform) {
  const events = [];

  for (const signature of signatures) {
    if (signature.platforms && !signature.platforms.includes(platform)) {
      continue;
    }

    for (const proc of processes) {
      const haystack = `${proc.name} ${proc.cmd || ""}`.toLowerCase();
      const matchedName = signature.processNames.find((name) =>
        haystack.includes(name.toLowerCase())
      );
      if (matchedName) {
        events.push({
          type: "detected",
          category: signature.category,
          method: "process-scan",
          signatureId: signature.id,
          processName: proc.name,
          timestamp: Date.now(),
        });
        break;
      }
    }
  }

  return events;
}

module.exports = { getRunningProcesses, matchProcessesAgainstSignatures };
