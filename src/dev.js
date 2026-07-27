const { spawn } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const viteEntryPoint = path.join(
  projectRoot,
  "node_modules",
  "vite",
  "bin",
  "vite.js"
);
const children = [
  spawn(process.execPath, ["--watch", "src/server.js"], {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true
  }),
  spawn(
    process.execPath,
    [viteEntryPoint, "--config", "vite.config.mjs"],
    {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true
    }
  )
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) {
    return;
  }

  stopping = true;

  for (const child of children) {
    child.kill();
  }

  process.exitCode = exitCode;
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });

  child.on("exit", (code) => {
    if (!stopping && code !== 0) {
      stop(code || 1);
    }
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
