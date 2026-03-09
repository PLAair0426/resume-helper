import { spawn } from "node:child_process";
import process from "node:process";

const mode = process.argv[2] === "start" ? "start" : "dev";
const isWindows = process.platform === "win32";

const commands = {
  backend:
    mode === "start"
      ? "python -m uvicorn backend.main:app --app-dir .. --host 0.0.0.0 --port 8000"
      : "python -m uvicorn backend.main:app --app-dir .. --reload --reload-dir . --port 8000",
  frontend:
    mode === "start"
      ? "npm --prefix ../frontend run start"
      : "npm --prefix ../frontend run dev",
};

const children = [];
let shuttingDown = false;
let exitCode = 0;

function spawnService(name, command) {
  const child = spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error.message);
    exitCode = 1;
    shutdown();
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      if (typeof code === "number" && code !== 0) {
        exitCode = code;
      }
      return;
    }

    if (typeof code === "number" && code !== 0) {
      exitCode = code;
    } else if (signal) {
      exitCode = 1;
    }

    shutdown();
  });

  children.push(child);
}

function killChild(child) {
  if (!child.pid) return;

  if (isWindows) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    killChild(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 200);
}

process.on("SIGINT", () => {
  exitCode = 0;
  shutdown();
});

process.on("SIGTERM", () => {
  exitCode = 0;
  shutdown();
});

spawnService("backend", commands.backend);
spawnService("frontend", commands.frontend);
