const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

async function loadLifecycle() {
  const modulePath = path.resolve(
    __dirname,
    "..",
    "..",
    "public",
    "app",
    "files",
    "preview",
    "pdfPreviewLifecycle.mjs"
  );

  return import(pathToFileURL(modulePath));
}

test("disposes the PDF loading task without destroying its document proxy", async () => {
  const { disposePdfPreview } = await loadLifecycle();
  let loadingTaskDestroyed = false;
  let renderCancelled = false;
  const documentProxy = {
    destroy() {
      throw new Error("PDF.js v6 document proxies do not own destruction");
    }
  };

  await disposePdfPreview({
    documentProxy,
    loadingTask: {
      async destroy() {
        loadingTaskDestroyed = true;
      }
    },
    renderTask: {
      cancel() {
        renderCancelled = true;
      }
    }
  });

  assert.equal(renderCancelled, true);
  assert.equal(loadingTaskDestroyed, true);
});

test("does not surface cleanup errors while a preview is closing", async () => {
  const { disposePdfPreview } = await loadLifecycle();

  await assert.doesNotReject(
    disposePdfPreview({
      loadingTask: {
        async destroy() {
          throw new Error("Worker already stopped");
        }
      },
      renderTask: {
        cancel() {
          throw new Error("Render already completed");
        }
      }
    })
  );
});
