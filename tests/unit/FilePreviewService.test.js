const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FilePreviewService
} = require("../../src/services/FilePreviewService");

function createService(download) {
  return new FilePreviewService({
    getDownload: async (provider, reference) => {
      assert.equal(provider, "box");
      download.receivedReference = reference;
      return download;
    }
  });
}

test("limits source previews and marks them as truncated", async () => {
  const download = {
    body: Buffer.alloc(300 * 1024, "a"),
    filename: "large.js",
    size: 300 * 1024
  };
  const preview = await createService(download).getPreview("box", {
    id: "file-1"
  });

  assert.equal(preview.kind, "source");
  assert.equal(preview.body.length, 256 * 1024);
  assert.equal(preview.contentType, "text/plain; charset=utf-8");
  assert.equal(preview.truncated, true);
});

test("preserves safe PDF streaming metadata and page limit", async () => {
  const download = {
    acceptRanges: "bytes",
    body: Buffer.from("%PDF"),
    contentRange: "bytes 0-3/1024",
    filename: "manual.pdf",
    responseSize: 4,
    size: 1024,
    status: 206
  };
  const preview = await createService(download).getPreview(
    "box",
    { id: "file-1" },
    { range: "bytes=0-3" }
  );

  assert.equal(preview.kind, "pdf");
  assert.equal(preview.contentType, "application/pdf");
  assert.equal(preview.pageLimit, 50);
  assert.equal(preview.status, 206);
  assert.equal(download.receivedReference.range, "bytes=0-3");
});

test("rejects Office documents and malformed byte ranges", async () => {
  const officeDownload = {
    body: Buffer.from("office"),
    filename: "report.docx",
    size: 6
  };
  const service = createService(officeDownload);

  await assert.rejects(
    service.getPreview("box", { id: "file-1" }),
    (error) =>
      error.code === "PREVIEW_NOT_AVAILABLE" &&
      error.statusCode === 415
  );
  await assert.rejects(
    service.getPreview(
      "box",
      { id: "file-1" },
      { range: "bytes=0-10,20-30" }
    ),
    (error) =>
      error.code === "INVALID_PREVIEW_RANGE" &&
      error.statusCode === 416
  );
});

