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
