const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const codeRepoRoot = path.resolve(__dirname, "..");

try {
  process.loadEnvFile(path.join(codeRepoRoot, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

const remote = process.env.AZURE_GIT_REMOTE;
const branch = process.env.AZURE_GIT_BRANCH || "main";
const shouldPush = process.env.AZURE_GIT_PUSH === "true";
const pat = process.env.AZURE_DEVOPS_PAT;
const ipv4Only = process.env.GIT_IPV4_ONLY === "true";
const sslBackend = process.env.GIT_SSL_BACKEND;
const imageRepoRoot = path.resolve(
  codeRepoRoot,
  process.env.AZURE_IMAGE_REPO_DIR || ".azure-image-repo"
);
const imageDirectory = path.join(imageRepoRoot, "images");
const gitAuthorName =
  process.env.AZURE_GIT_AUTHOR_NAME || "Cloud Storage Image Service";
const gitAuthorEmail =
  process.env.AZURE_GIT_AUTHOR_EMAIL || "image-service@localhost";

const allowedImageTypes = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

async function runGit(argumentsList) {
  const configurationArguments = ["-c", "credential.helper="];
  const environment = {
    ...process.env,
    GCM_INTERACTIVE: "Never",
    GIT_TERMINAL_PROMPT: "0"
  };

  // Prevent VS Code's Git integration from displaying an interactive prompt.
  delete environment.GIT_ASKPASS;
  delete environment.SSH_ASKPASS;
  delete environment.VSCODE_GIT_ASKPASS_NODE;
  delete environment.VSCODE_GIT_ASKPASS_EXTRA_ARGS;
  delete environment.VSCODE_GIT_IPC_HANDLE;

  if (pat) {
    const encodedPat = Buffer.from(`:${pat}`).toString("base64");
    environment.AZURE_GIT_AUTH_HEADER =
      `Authorization: Basic ${encodedPat}`;
    configurationArguments.push(
      "--config-env=http.extraheader=AZURE_GIT_AUTH_HEADER"
    );
  }

  if (sslBackend) {
    configurationArguments.push("-c", `http.sslBackend=${sslBackend}`);
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      [...configurationArguments, ...argumentsList],
      {
        cwd: imageRepoRoot,
        env: environment,
        windowsHide: true
      }
    );

    return stdout.trim();
  } catch (error) {
    throw new Error(error.stderr?.trim() || error.message);
  }
}

function toGitPath(absolutePath) {
  return path.relative(imageRepoRoot, absolutePath).split(path.sep).join("/");
}

function cleanName(originalName) {
  const name = path.basename(originalName || "image");

  return (
    path
      .basename(name, path.extname(name))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "image"
  );
}

async function findExistingImage(hash) {
  try {
    const filenames = await fs.readdir(imageDirectory);
    return filenames.find((filename) => filename.startsWith(`${hash}-`));
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function hasCommitHistory() {
  try {
    await runGit(["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

async function fetchExistingAzureHistory() {
  if (!shouldPush || !remote || !pat) {
    return;
  }

  const fetchArguments = ["fetch"];

  if (ipv4Only) {
    fetchArguments.push("--ipv4");
  }

  fetchArguments.push("--depth=1", remote, branch);

  try {
    await runGit(fetchArguments);
    await runGit(["checkout", "-B", branch, "FETCH_HEAD"]);
  } catch (error) {
    const remoteIsEmpty =
      /couldn't find remote ref|remote ref does not exist|not found/i.test(
        error.message
      );

    if (!remoteIsEmpty) {
      throw error;
    }
  }
}

let imageRepositoryReady;

async function ensureImageRepository() {
  if (!imageRepositoryReady) {
    imageRepositoryReady = (async () => {
      await fs.mkdir(imageRepoRoot, { recursive: true });

      try {
        await fs.access(path.join(imageRepoRoot, ".git"));
      } catch {
        await runGit(["init", "--initial-branch", branch]);
      }

      await runGit(["config", "user.name", gitAuthorName]);
      await runGit(["config", "user.email", gitAuthorEmail]);

      if (!(await hasCommitHistory())) {
        await fetchExistingAzureHistory();
      }

      await fs.mkdir(imageDirectory, { recursive: true });
    })();
  }

  return imageRepositoryReady;
}

async function isTrackedInHead(relativePath) {
  if (!(await hasCommitHistory())) {
    return false;
  }

  const trackedPath = await runGit([
    "ls-tree",
    "--name-only",
    "HEAD",
    "--",
    relativePath
  ]);

  return trackedPath === relativePath;
}

function requirePushConfiguration() {
  if (!remote) {
    throw new Error(
      "AZURE_GIT_REMOTE must be set before Azure pushing is enabled"
    );
  }

  if (!pat) {
    throw new Error(
      "AZURE_DEVOPS_PAT must be set before Azure pushing is enabled"
    );
  }
}

async function pushCurrentHead() {
  requirePushConfiguration();

  const pushArguments = ["push"];

  if (ipv4Only) {
    pushArguments.push("--ipv4");
  }

  pushArguments.push(remote, `HEAD:${branch}`);
  await runGit(pushArguments);
}

async function pushStoredImage(relativePath, filename) {
  requirePushConfiguration();

  if (!(await isTrackedInHead(relativePath))) {
    await runGit(["add", "--", relativePath]);
    await runGit([
      "commit",
      "--only",
      "-m",
      `Add uploaded image ${filename}`,
      "--",
      relativePath
    ]);
  }

  const commit = await runGit(["rev-parse", "HEAD"]);
  await pushCurrentHead();
  return commit;
}

async function removeLastCommitImages() {
  if (!shouldPush) {
    throw new Error(
      "AZURE_GIT_PUSH must be true before committed images can be removed"
    );
  }

  requirePushConfiguration();
  await ensureImageRepository();

  if (!(await hasCommitHistory())) {
    throw new Error("The Azure image repository has no commits");
  }

  const sourceCommit = await runGit(["rev-parse", "HEAD"]);
  const output = await runGit([
    "diff-tree",
    "--root",
    "--no-commit-id",
    "--name-only",
    "--diff-filter=A",
    "-r",
    "HEAD",
    "--",
    "images/"
  ]);

  const imagePaths = output
    .split(/\r?\n/)
    .filter((item) => item.startsWith("images/"));

  if (imagePaths.length === 0) {
    throw new Error("The last commit did not add any images");
  }

  await runGit(["rm", "--", ...imagePaths]);
  await runGit([
    "commit",
    "--only",
    "-m",
    `Remove images added by ${sourceCommit.slice(0, 7)}`,
    "--",
    ...imagePaths
  ]);

  const commit = await runGit(["rev-parse", "HEAD"]);
  await pushCurrentHead();

  return {
    commit,
    removed: imagePaths,
    sourceCommit
  };
}

async function saveAndOptionallyPushImage(image, originalName, contentType) {
  const normalizedContentType = contentType?.split(";")[0].toLowerCase();
  const extension = allowedImageTypes[normalizedContentType];

  if (!extension) {
    throw new Error(`Unsupported image type: ${contentType || "missing"}`);
  }

  if (!Buffer.isBuffer(image) || image.length === 0) {
    throw new Error("No image data was supplied");
  }

  await ensureImageRepository();

  const hash = createHash("sha256").update(image).digest("hex");
  const existingFilename = await findExistingImage(hash);

  if (existingFilename) {
    const existingPath = `images/${existingFilename}`;

    if (shouldPush) {
      const commit = await pushStoredImage(existingPath, existingFilename);

      return {
        commit,
        duplicate: true,
        filename: existingFilename,
        path: existingPath,
        pushed: true
      };
    }

    return {
      duplicate: true,
      filename: existingFilename,
      path: existingPath,
      pushed: false
    };
  }

  await fs.mkdir(imageDirectory, { recursive: true });

  const filename = `${hash}-${cleanName(originalName)}${extension}`;
  const absolutePath = path.join(imageDirectory, filename);
  const relativePath = toGitPath(absolutePath);

  await fs.writeFile(absolutePath, image, { flag: "wx" });

  if (!shouldPush) {
    return {
      duplicate: false,
      filename,
      path: relativePath,
      pushed: false
    };
  }

  const commit = await pushStoredImage(relativePath, filename);

  return {
    commit,
    duplicate: false,
    filename,
    path: relativePath,
    pushed: true
  };
}

let operationQueue = Promise.resolve();

function uploadImage(...argumentsList) {
  const job = operationQueue.then(() =>
    saveAndOptionallyPushImage(...argumentsList)
  );

  operationQueue = job.catch(() => undefined);
  return job;
}

function removeImagesFromLastCommit() {
  const job = operationQueue.then(removeLastCommitImages);
  operationQueue = job.catch(() => undefined);
  return job;
}

module.exports = {
  removeImagesFromLastCommit,
  uploadImage
};
