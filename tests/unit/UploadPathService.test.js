const assert = require("node:assert/strict");
const test = require("node:test");
const {
  UploadPathService
} = require("../../src/services/storage/UploadPathService");

test("applies safe browser folder paths to uploaded files", () => {
  const service = new UploadPathService();
  const files = [{ originalname: "one.txt" }, { originalname: "two.txt" }];
  const manifest = service.applyManifest(
    files,
    JSON.stringify({
      mode: "folder",
      paths: ["Project/one.txt", "Project/Nested/two.txt"]
    })
  );

  assert.equal(manifest.mode, "folder");
  assert.deepEqual(
    files.map((file) => file.relativePath),
    ["Project/one.txt", "Project/Nested/two.txt"]
  );
  assert.equal(
    service.getDirectory(files[1].relativePath),
    "Project/Nested"
  );
});

test("rejects folder traversal and mismatched path manifests", () => {
  const service = new UploadPathService();

  assert.throws(
    () =>
      service.applyManifest(
        [{}],
        JSON.stringify({
          mode: "folder",
          paths: ["../private.txt"]
        })
      ),
    /not safe/
  );
  assert.throws(
    () =>
      service.applyManifest(
        [{}, {}],
        JSON.stringify({
          mode: "folder",
          paths: ["Folder/one.txt"]
        })
      ),
    /Every folder upload item/
  );
});
