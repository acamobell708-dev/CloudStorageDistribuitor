const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FileNamingService
} = require("../../src/services/storage/FileNamingService");

test("keeps a safe original name while calculating an internal SHA-256", () => {
  const service = new FileNamingService();
  const result = service.createStoredName(
    Buffer.from("same file"),
    "../Quarter 1 report.xlsx"
  );

  assert.equal(result.hash.length, 64);
  assert.equal(result.filename, "Quarter 1 report.xlsx");
});

test("strips path traversal and unsafe filename characters", () => {
  const service = new FileNamingService();

  assert.deepEqual(service.sanitizeName("../../my : file?.pdf"), {
    extension: ".pdf",
    stem: "my _ file_"
  });
});

test("creates readable collision names and hides legacy hash prefixes", () => {
  const service = new FileNamingService();
  const legacyHash = "a".repeat(64);

  assert.equal(
    service.createAvailableName("giphy.gif", [
      "giphy.gif",
      "giphy (2).gif"
    ]),
    "giphy (3).gif"
  );
  assert.equal(
    service.getDisplayName(`${legacyHash}-giphy.gif`),
    "giphy.gif"
  );
});
