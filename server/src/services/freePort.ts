import { execSync } from "child_process";

export function freePort(port: number): void {
  try {
    if (process.platform === "win32") {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const currentPid = String(process.pid);
      const killed = new Set<string>();
      for (const line of output.split("\n")) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== currentPid && pid !== "0" && !isNaN(Number(pid)) && !killed.has(pid)) {
            killed.add(pid);
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
              console.log(`[MalikSe] Terminated stale process (PID ${pid}) on port ${port}`);
            } catch {}
          }
        }
      }
    } else {
      execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {}
}
