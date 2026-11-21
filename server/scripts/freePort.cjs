const { execSync } = require("child_process");

function freePort(port) {
  const targetPort = Number(port) || 5000;
  try {
    if (process.platform === "win32") {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const currentPid = String(process.pid);
      const killed = new Set();
      for (const line of output.split("\n")) {
        if (line.includes(`:${targetPort}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== currentPid && pid !== "0" && !isNaN(Number(pid)) && !killed.has(pid)) {
            killed.add(pid);
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
              console.log(`[MalikSe] Cleared stale process (PID ${pid}) from port ${targetPort}`);
            } catch {}
          }
        }
      }
    } else {
      execSync(`lsof -ti :${targetPort} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {}
}

const port = process.argv[2] || process.env.PORT || 5000;
freePort(port);
