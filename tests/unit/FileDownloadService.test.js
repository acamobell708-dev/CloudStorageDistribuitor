const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FileDownloadService
} = require("../../src/services/FileDownloadService");

test("delegates a validated cloud file reference to the provider", async () => {
  let receivedReference;
  const provider = {
    displayName: "Test Cloud",
    downloadCloudFile: async (fileReference) => {
      receivedReference = fileReference;

      return {
        body: Buffer.from("contents"),
        filename: "example.txt"
      };
    }
  };
  const service = new FileDownloadService({
    get: (providerKey) => {
      assert.equal(providerKey, "test");
      return provider;
    }
  });

  const result = await service.getDownload("test", {
    id: "file-1",
    path: "/documents/example.txt"
  });

  assert.equal(result.filename, "example.txt");
  assert.deepEqual(receivedReference, {
    id: "file-1",
    path: "/documents/example.txt"
  });
});

test("rejects a download without a cloud file ID", async () => {
  const service = new FileDownloadService({
    get: () => {
      throw new Error("The provider should not be selected");
    }
  });

  await assert.rejects(
    service.getDownload("test", {}),
    /cloud file ID is required/
  );
});
