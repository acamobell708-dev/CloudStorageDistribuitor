const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PermanentFileDeletionService
} = require("../../src/services/PermanentFileDeletionService");

function createService(overrides = {}) {
  let receivedReference;
  const provider = {
    displayName: "Azure Repos",
    key: "azure",
    permanentlyDeleteCloudFile: async (fileReference) => {
      receivedReference = fileReference;

      return overrides.result || {
        filename: "photo.png",
        id: fileReference.id,
        path: fileReference.path,
        removed: true,
        removedFromHistory: true
      };
    }
  };
  const service = new PermanentFileDeletionService(
    {
      get: () => provider
    }
  );

  return {
    getReceivedReference: () => receivedReference,
    service
  };
}

test("authorizes and confirms a permanent provider deletion", async () => {
  const { getReceivedReference, service } = createService();
  const result = await service.delete(
    "azure",
    {
      id: "a".repeat(40),
      path: "/images/photo.png"
    }
  );

  assert.equal(result.file.removedFromHistory, true);
  assert.equal(result.provider.key, "azure");
  assert.match(result.message, /reachable history/);
  assert.deepEqual(getReceivedReference(), {
    id: "a".repeat(40),
    path: "/images/photo.png"
  });
});

test("requires a complete file reference and provider confirmation", async () => {
  const unconfirmed = createService({
    result: {
      removed: true,
      removedFromHistory: false
    }
  }).service;
  const reference = {
    id: "a".repeat(40),
    path: "/images/photo.png"
  };

  await assert.rejects(
    unconfirmed.delete("azure", reference),
    /did not confirm/
  );
  await assert.rejects(
    unconfirmed.delete("azure", {
      id: reference.id
    }),
    /repository path/
  );
});
