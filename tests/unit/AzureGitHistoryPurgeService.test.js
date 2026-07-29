const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AzureGitHistoryPurgeService
} = require("../../src/services/storage/azure/AzureGitHistoryPurgeService");

test("accepts only normalized managed Azure storage paths", () => {
  const service = new AzureGitHistoryPurgeService();

  assert.equal(
    service.normalizeManagedPath("/images/photo.png"),
    "images/photo.png"
  );
  assert.equal(
    service.normalizeManagedPath("media/video/clip.mp4"),
    "media/video/clip.mp4"
  );
  assert.throws(
    () => service.normalizeManagedPath("/../secret.txt"),
    /managed Azure storage paths/
  );
  assert.throws(
    () => service.normalizeManagedPath("/README.md"),
    /managed Azure storage paths/
  );
  assert.throws(
    () => service.normalizeManagedPath("images\\photo.png"),
    /not safe/
  );
});

test("refuses history rewrites when another branch or tag can retain data", () => {
  const service = new AzureGitHistoryPurgeService({
    branch: "main"
  });
  const main = {
    name: "refs/heads/main",
    objectId: "a".repeat(40)
  };

  assert.deepEqual(service.requireSingleManagedBranch([main]), main);
  assert.throws(
    () =>
      service.requireSingleManagedBranch([
        main,
        {
          name: "refs/tags/archive",
          objectId: "b".repeat(40)
        }
      ]),
    (error) =>
      error.code === "UNSAFE_REPOSITORY_REFERENCES" &&
      error.statusCode === 409
  );
});

test("adds managed identity authorization only to remote Git operations", async () => {
  const calls = [];
  let tokenRequests = 0;
  const service = new AzureGitHistoryPurgeService({
    authorizationProvider: {
      async getAuthorizationHeader() {
        tokenRequests += 1;
        return "Bearer short-lived-token";
      },
      getMissingConfigurationName() {
        return "Azure managed identity";
      },
      isConfigured() {
        return true;
      }
    },
    execFileAsync: async (...argumentsList) => {
      calls.push(argumentsList);
      return { stdout: "" };
    },
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  await service.runGit("repository", ["status"]);
  await service.runGit("repository", ["fetch", "origin"], {
    authenticate: true
  });

  assert.equal(tokenRequests, 1);
  assert.equal(
    calls[0][1].includes(
      "--config-env=http.extraheader=AZURE_PURGE_AUTH_HEADER"
    ),
    false
  );
  assert.equal(
    calls[0][2].env.AZURE_PURGE_AUTH_HEADER,
    undefined
  );
  assert.equal(
    calls[1][1].includes(
      "--config-env=http.extraheader=AZURE_PURGE_AUTH_HEADER"
    ),
    true
  );
  assert.equal(
    calls[1][2].env.AZURE_PURGE_AUTH_HEADER,
    "Authorization: Bearer short-lived-token"
  );
});
