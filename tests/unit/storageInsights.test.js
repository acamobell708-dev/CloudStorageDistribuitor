const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const insightsModuleUrl = pathToFileURL(
  path.join(
    __dirname,
    "..",
    "..",
    "public",
    "app",
    "dashboard",
    "storageInsights.mjs"
  )
).href;

async function loadInsightsModule() {
  return import(insightsModuleUrl);
}

test("classifies media by MIME type and filename extension", async () => {
  const { getMediaType } = await loadInsightsModule();

  assert.equal(
    getMediaType({ contentType: "image/png", name: "unknown.bin" }),
    "image"
  );
  assert.equal(getMediaType({ name: "report.pdf" }), "document");
  assert.equal(getMediaType({ name: "component.jsx" }), "source");
  assert.equal(getMediaType({ name: "recording.webm" }), "video");
  assert.equal(getMediaType({ name: "backup.zip" }), "archive");
  assert.equal(getMediaType({ name: "no-extension" }), "other");
});

test("summarizes provider totals and media composition", async () => {
  const { createStorageInsights } = await loadInsightsModule();
  const insights = createStorageInsights([
    {
      files: [
        { name: "cover.jpg", path: "/cover.jpg", size: 300 },
        { name: "notes.txt", path: "/notes.txt", size: 100 }
      ],
      key: "box",
      status: "loaded"
    },
    {
      files: [
        {
          contentType: "audio/mpeg",
          name: "theme.mp3",
          path: "/media/theme.mp3",
          size: 600
        },
        {
          name: "unknown.bin",
          path: "/media/unknown.bin"
        }
      ],
      key: "azure",
      status: "loaded"
    }
  ]);
  const box = insights.providerSegments.find(
    (segment) => segment.key === "box"
  );
  const azure = insights.providerSegments.find(
    (segment) => segment.key === "azure"
  );
  const audio = insights.mediaSegments.find(
    (segment) => segment.key === "audio"
  );

  assert.equal(insights.totalBytes, 1000);
  assert.equal(insights.totalFiles, 4);
  assert.equal(insights.unmeasuredCount, 1);
  assert.equal(box.value, 400);
  assert.equal(azure.value, 600);
  assert.equal(audio.value, 600);
  assert.equal(audio.items[0].providerLabel, "Azure");
});

test("keeps unavailable providers visible without inventing usage", async () => {
  const { createStorageInsights } = await loadInsightsModule();
  const insights = createStorageInsights([
    {
      detail: "Box credentials are missing",
      files: [],
      key: "box",
      status: "not-configured"
    }
  ]);
  const box = insights.providerSegments.find(
    (segment) => segment.key === "box"
  );
  const azure = insights.providerSegments.find(
    (segment) => segment.key === "azure"
  );

  assert.equal(box.value, 0);
  assert.equal(box.detail, "Box credentials are missing");
  assert.equal(azure.value, 0);
  assert.equal(azure.status, "unavailable");
});
