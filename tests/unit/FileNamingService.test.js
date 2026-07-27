const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FileNamingService
} = require("../../src/services/storage/FileNamingService");

test("creates stable SHA-256 names while preserving a safe extension", () => {
  const service = new FileNamingService();
  const result = service.createStoredName(
    Buffer.from("same file"),
    "../Quarter 1 report.xlsx"
  );

  assert.equal(result.hash.length, 64);
  assert.equal(result.filename, `${result.hash}-Quarter_1_report.xlsx`);
});

test("strips path traversal and unsafe filename characters", () => {
  const service = new FileNamingService();

  assert.deepEqual(service.sanitizeName("../../my : file?.pdf"), {
    extension: ".pdf",
    stem: "my___file_"
  });
});
