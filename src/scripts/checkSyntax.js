const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..", "..");
const sourceDirectories = [
  "src",
  "PlatformConnectivityTests",
  "tests"
];
const standaloneFiles = ["vite.config.mjs"];

function findJavaScriptFiles(relativeDirectory) {
  const absoluteDirectory = path.join(projectRoot, relativeDirectory);
  const files = [];

  for (const entry of fs.readdirSync(absoluteDirectory, {
    withFileTypes: true
  })) {
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findJavaScriptFiles(relativePath));
    } else if (entry.isFile() && path.extname(entry.name) === ".js") {
      files.push(relativePath);
    }
  }

  return files;
}

const files = [
  ...sourceDirectories.flatMap(findJavaScriptFiles),
  ...standaloneFiles
].sort();
const failedFiles = [];

for (const file of files) {
  const result = spawnSync(
    process.execPath,
    ["--check", path.join(projectRoot, file)],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );

  if (result.status !== 0) {
    failedFiles.push(file);
    process.stderr.write(result.stderr || result.stdout);
  }
}

if (failedFiles.length > 0) {
  console.error(
    `Syntax checking failed for ${failedFiles.length} file(s): ` +
      failedFiles.join(", ")
  );
  process.exitCode = 1;
} else {
  console.log(`Syntax checked ${files.length} server and test files`);
}
