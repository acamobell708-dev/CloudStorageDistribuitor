const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const policyModuleUrl = pathToFileURL(
  path.join(
    __dirname,
    "..",
    "..",
    "src",
    "shared",
    "filePreviewPolicy.mjs"
  )
).href;

async function loadPolicy() {
  return import(policyModuleUrl);
}

test("offers only bounded browser-safe preview categories", async () => {
  const { getFilePreviewCapability } = await loadPolicy();

  assert.equal(
    getFilePreviewCapability({
      name: "cover.png",
      size: 1024
    }).kind,
    "image"
  );
  assert.equal(
    getFilePreviewCapability({
      name: "manual.pdf",
      size: 1024
    }).kind,
    "pdf"
  );
  assert.equal(
    getFilePreviewCapability({
      name: "server.js",
      size: 1024
    }).kind,
    "source"
  );
  assert.equal(
    getFilePreviewCapability({
      name: "report.docx",
      size: 1024
    }).available,
    false
  );
  assert.equal(
    getFilePreviewCapability({
      name: "backup.zip",
      size: 1024
    }).available,
    false
  );
});

test("rejects oversized rich media but keeps source previewable", async () => {
  const { filePreviewLimits, getFilePreviewCapability } =
    await loadPolicy();

  assert.equal(
    getFilePreviewCapability({
      name: "large.png",
      size: filePreviewLimits.imageBytes + 1
    }).available,
    false
  );
  assert.equal(
    getFilePreviewCapability({
      name: "large.js",
      size: filePreviewLimits.textBytes + 1
    }).truncated,
    true
  );
});

test("uses the browser media capability check for audio and video", async () => {
  const {
    browserCanRenderPreview,
    getFilePreviewCapability
  } = await loadPolicy();
  const supportedDocument = {
    createElement: () => ({
      canPlayType: (contentType) =>
        contentType === "video/mp4" ? "probably" : ""
    })
  };

  assert.equal(
    browserCanRenderPreview(
      getFilePreviewCapability({
        name: "clip.mp4",
        size: 1024
      }),
      supportedDocument
    ),
    true
  );
  assert.equal(
    browserCanRenderPreview(
      getFilePreviewCapability({
        name: "track.wma",
        size: 1024
      }),
      supportedDocument
    ),
    false
  );
});

