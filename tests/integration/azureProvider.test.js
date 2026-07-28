const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  AzureDevOpsStorageProvider
} = require("../../src/services/storage/azure/AzureDevOpsStorageProvider");

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
