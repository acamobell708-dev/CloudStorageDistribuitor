const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const test = require("node:test");
const {
  AzureDevOpsStorageProvider
} = require("../../src/services/storage/azure/AzureDevOpsStorageProvider");
const {
  AzureGitHistoryPurgeService
} = require("../../src/services/storage/azure/AzureGitHistoryPurgeService");

const execFileAsync = promisify(execFile);

async function runGit(cwd, argumentsList) {
  const { stdout } = await execFileAsync("git", argumentsList, {
    cwd,
    windowsHide: true
  });

  return stdout.trim();
}

test("retains isolated AzureDataRepo storage for explicit CLI operations", async () => {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cloud-storage-azure-test-")
  );
  const applicationRoot = path.join(temporaryRoot, "application");
  const dataRepoRoot = path.join(temporaryRoot, "azure-data");
  const imageUploadPath = path.join(temporaryRoot, "random-image-upload");
  const documentUploadPath = path.join(
    temporaryRoot,
    "random-document-upload"
  );
  const sourceUploadPath = path.join(temporaryRoot, "random-source-upload");
  const collisionUploadPath = path.join(
    temporaryRoot,
    "random-collision-upload"
  );
  const imageBody = Buffer.from("isolated image");
  const collisionBody = Buffer.from("different isolated image");
  const documentBody = Buffer.from("sample pdf contents");
  const sourceBody = Buffer.from("console.log('stored separately');");

  await fs.mkdir(applicationRoot);
  await fs.writeFile(imageUploadPath, imageBody);
  await fs.writeFile(documentUploadPath, documentBody);
  await fs.writeFile(sourceUploadPath, sourceBody);
  await fs.writeFile(collisionUploadPath, collisionBody);

  try {
    const provider = new AzureDevOpsStorageProvider({
      branch: "main",
      codeRepoRoot: applicationRoot,
      dataRepoRoot,
      shouldPush: false
    });
    const firstUpload = await provider.saveAndOptionallyPushFile({
      filename: "random-image-upload",
      mimetype: "image/png",
      originalname: "photo.png",
      path: imageUploadPath,
      size: imageBody.length
    });
    const duplicateUpload = await provider.saveAndOptionallyPushFile({
      filename: "another-random-name",
      mimetype: "image/png",
      originalname: "photo.png",
      path: imageUploadPath,
      size: imageBody.length
    });
    const documentUpload = await provider.saveAndOptionallyPushFile({
      filename: "random-document-upload",
      mimetype: "application/pdf",
      originalname: "report.pdf",
      path: documentUploadPath,
      size: documentBody.length
    });
    const sourceUpload = await provider.saveAndOptionallyPushFile({
      filename: "random-source-upload",
      mimetype: "application/javascript",
      originalname: "app.js",
      path: sourceUploadPath,
      size: sourceBody.length
    });
    const collisionUpload = await provider.saveAndOptionallyPushFile({
      filename: "random-collision-upload",
      mimetype: "image/png",
      originalname: "photo.png",
      path: collisionUploadPath,
      size: collisionBody.length
    });

    assert.equal(firstUpload.path, "images/photo.png");
    assert.equal(firstUpload.filename, "photo.png");
    assert.equal(firstUpload.pushed, false);
    assert.equal(duplicateUpload.duplicate, true);
    assert.equal(collisionUpload.path, "images/photo (2).png");
    assert.equal(documentUpload.path.startsWith("documents/"), true);
    assert.equal(documentUpload.originalName, "report.pdf");
    assert.equal(sourceUpload.path.startsWith("source/"), true);
    assert.equal(sourceUpload.originalName, "app.js");
    await fs.access(path.join(dataRepoRoot, ".git"));
    await fs.access(path.join(dataRepoRoot, firstUpload.path));
    await fs.access(path.join(dataRepoRoot, documentUpload.path));
    await fs.access(path.join(dataRepoRoot, sourceUpload.path));
    assert.deepEqual(await fs.readdir(applicationRoot), []);
  } finally {
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  }
});

test("rewrites and verifies a selected file out of reachable Git history", async () => {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cloud-storage-purge-test-")
  );
  const workingDirectory = path.join(temporaryRoot, "working");
  const remoteDirectory = path.join(temporaryRoot, "remote.git");
  const verificationDirectory = path.join(
    temporaryRoot,
    "final-verification.git"
  );

  try {
    await fs.mkdir(workingDirectory);
    await runGit(workingDirectory, [
      "init",
      "--initial-branch=main"
    ]);
    await runGit(workingDirectory, [
      "config",
      "user.name",
      "Purge Test"
    ]);
    await runGit(workingDirectory, [
      "config",
      "user.email",
      "purge-test@example.test"
    ]);
    await fs.mkdir(path.join(workingDirectory, "images"));
    await fs.mkdir(path.join(workingDirectory, "documents"));
    await fs.writeFile(
      path.join(workingDirectory, "images", "photo.png"),
      "private image"
    );
    await fs.writeFile(
      path.join(workingDirectory, "documents", "notes.txt"),
      "first version"
    );
    await runGit(workingDirectory, ["add", "."]);
    await runGit(workingDirectory, [
      "commit",
      "-m",
      "Add stored files"
    ]);
    const objectId = await runGit(workingDirectory, [
      "rev-parse",
      "HEAD:images/photo.png"
    ]);

    await fs.writeFile(
      path.join(workingDirectory, "documents", "notes.txt"),
      "second version"
    );
    await runGit(workingDirectory, ["add", "documents/notes.txt"]);
    await runGit(workingDirectory, [
      "commit",
      "-m",
      "Update notes"
    ]);

    await runGit(temporaryRoot, [
      "init",
      "--bare",
      "--initial-branch=main",
      remoteDirectory
    ]);
    await runGit(workingDirectory, [
      "remote",
      "add",
      "origin",
      remoteDirectory
    ]);
    await runGit(workingDirectory, [
      "push",
      "--set-upstream",
      "origin",
      "main"
    ]);

    const service = new AzureGitHistoryPurgeService({
      branch: "main",
      remote: remoteDirectory,
      temporaryRoot
    });
    const result = await service.purge({
      id: objectId,
      path: "/images/photo.png"
    });

    assert.equal(result.verified, true);
    assert.notEqual(result.previousCommit, result.rewrittenCommit);

    await runGit(temporaryRoot, [
      "clone",
      "--mirror",
      remoteDirectory,
      verificationDirectory
    ]);
    assert.equal(
      await runGit(verificationDirectory, [
        "log",
        "--all",
        "--format=%H",
        "--",
        "images/photo.png"
      ]),
      ""
    );
    assert.equal(
      (
        await runGit(verificationDirectory, [
          "rev-list",
          "--objects",
          "--all"
        ])
      ).includes(objectId),
      false
    );
    assert.equal(
      await runGit(verificationDirectory, [
        "show",
        "main:documents/notes.txt"
      ]),
      "second version"
    );
    await assert.rejects(
      runGit(verificationDirectory, [
        "show",
        "main:images/photo.png"
      ])
    );
  } finally {
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  }
});
