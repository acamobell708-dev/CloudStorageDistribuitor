const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FileDeletionService
} = require("../../src/services/FileDeletionService");
const {
  StorageProvider
} = require("../../src/services/storage/StorageProvider");

test("deletes a cloud file through the selected provider", async () => {
  let receivedReference;
  const provider = {
    deleteCloudFile: async (fileReference) => {
      receivedReference = fileReference;
      return {
        filename: "report.txt",
        id: fileReference.id,
        removed: true
      };
    },
    displayName: "Test Cloud",
    key: "test"
  };
  const service = new FileDeletionService({
    get: (providerKey) => {
      assert.equal(providerKey, "test");
      return provider;
    }
  });

  const result = await service.delete("test", {
    id: "file-1",
    path: "/report.txt"
  });

  assert.deepEqual(receivedReference, {
    id: "file-1",
    path: "/report.txt"
  });
  assert.equal(result.file.removed, true);
  assert.equal(result.message, "report.txt was deleted from Test Cloud");
  assert.match(result.deletedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("rejects missing IDs and unconfirmed cloud deletions", async () => {
  const service = new FileDeletionService({
    get: () => ({
      deleteCloudFile: async () => ({ removed: false }),
      displayName: "Test Cloud",
      key: "test"
    })
  });

  await assert.rejects(
    service.delete("test", {}),
    /cloud file ID is required/
  );
  await assert.rejects(
    service.delete("test", { id: "file-1" }),
    /did not confirm the file deletion/
  );
});

test("returns a provider action error when deletion is unsupported", async () => {
  class ReadOnlyProvider extends StorageProvider {
    constructor() {
      super({
        description: "Read-only test provider",
        displayName: "Read Only",
        key: "readonly",
        maximumUploadSizeBytes: 1024
      });
    }
  }

  const service = new FileDeletionService({
    get: () => new ReadOnlyProvider()
  });

  await assert.rejects(
    service.delete("readonly", { id: "file-1" }),
    (error) =>
      error.code === "UNSUPPORTED_FILE_ACTION" &&
      error.statusCode === 405
  );
});
