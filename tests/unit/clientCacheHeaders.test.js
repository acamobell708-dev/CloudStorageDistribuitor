const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const {
  CLIENT_ASSET_CACHE_CONTROL,
  CLIENT_HTML_CACHE_CONTROL,
  setClientCacheHeaders
} = require("../../src/app");

function getCacheControl(filePath) {
  let cacheControl;

  setClientCacheHeaders(
    {
      setHeader(name, value) {
        if (name.toLowerCase() === "cache-control") {
          cacheControl = value;
        }
      }
    },
    filePath
  );

  return cacheControl;
}

test("requires deployed HTML to revalidate before reuse", () => {
  assert.equal(
    getCacheControl(path.join("dist", "dashboard.html")),
    CLIENT_HTML_CACHE_CONTROL
  );
  assert.equal(
    getCacheControl(path.join("dist", "login.html")),
    CLIENT_HTML_CACHE_CONTROL
  );
});

test("caches Vite hashed assets as immutable", () => {
  assert.equal(
    getCacheControl(
      path.join("dist", "assets", "dashboard-CL64nj22.js")
    ),
    CLIENT_ASSET_CACHE_CONTROL
  );
  assert.equal(
    getCacheControl(path.join("dist", "assets", "styles.css")),
    CLIENT_ASSET_CACHE_CONTROL
  );
});
