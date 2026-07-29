const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {
  createStorageProviderFactory
} = require("../../src/services/storage/StorageProviderFactory");

test("creates the web Azure provider without local repository access", () => {
  const cliRepositoryPath = path.resolve("cli-only-azure-data");
  const factory = createStorageProviderFactory({
    azure: {
      branch: "main",
      maximumUploadSizeBytes: 100 * 1024 * 1024,
      pat: "test-pat",
      remote:
        "https://organization@dev.azure.com/organization/project/_git/media",
      shouldPush: true
    },
    azureCli: {
      dataRepoRoot: cliRepositoryPath
    },
    box: {},
    projectRoot: path.resolve("application")
  });
  const provider = factory.get("azure");

  assert.equal(provider.browserUploadStorage, "memory");
  assert.equal(provider.localDataRepositoryEnabled, false);
  assert.equal(provider.dataRepoRoot, undefined);
  assert.notEqual(provider.dataRepoRoot, cliRepositoryPath);
  assert.deepEqual(provider.supportedFileActions, [
    "download",
    "delete"
  ]);
});

test("enables Azure actions when managed identity is selected", () => {
  const factory = createStorageProviderFactory({
    azure: {
      authorizationMode: "managed-identity",
      branch: "main",
      maximumUploadSizeBytes: 100 * 1024 * 1024,
      purgeAuthorizationMode: "managed-identity",
      remote:
        "https://organization@dev.azure.com/organization/project/_git/media",
      shouldPush: true
    },
    box: {}
  });
  const provider = factory.get("azure");

  assert.equal(provider.isConfigured(), true);
  assert.equal(provider.isListingConfigured(), true);
  assert.deepEqual(provider.supportedFileActions, [
    "download",
    "delete",
    "permanent-delete"
  ]);
});
