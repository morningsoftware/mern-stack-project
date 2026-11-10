import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { loadEnvironment } from "../src/environment.js";
import { configureOAuth } from "../src/oauth.js";

function safeLog(value: string): string {
  let result = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (/SECRET|PASSWORD|TOKEN|PRIVATE_KEY|MONGODB_URI/i.test(key) && secret) {
      result = result.split(secret).join("[redacted]");
    }
  }
  return result;
}

function diagnostics(): void {
  try {
    const processes = JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8" }));
    const app = processes.find((item: any) => item.name === (process.env.PM2_APP_NAME || "mern-api"));
    if (!app) return console.error("PM2 app not found");
    const info = app.pm2_env;
    console.error(JSON.stringify({ name: app.name, status: info.status, restarts: info.restart_time, exitCode: info.exit_code }));
    if (info.pm_err_log_path) {
      console.error(safeLog(readFileSync(info.pm_err_log_path, "utf8").split("\n").slice(-35).join("\n")));
    }
  } catch {
    console.error("PM2 startup diagnostics unavailable");
  }
}

try {
  loadEnvironment();
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGODB_URI and JWT_SECRET must be configured");
  }
  const port = Number(process.env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
  const oauth = configureOAuth();
  console.log(`Startup configuration valid; OAuth providers: ${oauth.enabledIds.join(", ") || "none"}`);
  if (process.argv.includes("--wait")) {
    let ready = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
        const body = await response.json() as { ok?: boolean };
        if (response.ok && body.ok === true) { ready = true; break; }
      } catch { /* The process may still be starting. */ }
      await delay(2000);
    }
    if (!ready) {
      diagnostics();
      throw new Error("API did not become healthy on its configured loopback port");
    }
    console.log("API is healthy on its configured loopback port");
  }
} catch (error) {
  console.error(safeLog(error instanceof Error ? error.message : "Startup check failed"));
  process.exitCode = 1;
}
