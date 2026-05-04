const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const processes = [];
let shuttingDown = false;

function startWorkspace(name) {
  const child = spawn(npmCommand, ["--workspace", name, "run", "dev"], {
    cwd: rootDir,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      shutdown(code ?? 1);
    }
  });

  processes.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

startWorkspace("apps/api");
startWorkspace("apps/web");
startWorkspace("apps/worker");
