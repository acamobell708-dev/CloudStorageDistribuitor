const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../../src/app");

function createTestApplication(overrides = {}) {
  const provider = {
    displayName: "Box",
    getStatus: () => ({
      configured: true,
      displayName: "Box",
      key: "box",
      maximumUploadSizeBytes: 1024
    }),
    key: "box",
    uploadFile: async (file) => ({
      duplicate: false,
      filename: `stored-${file.originalname}`,
      id: "box-file-1",
      originalName: file.originalname,
      provider: "box",
      pushed: true,
      size: file.size
    })
  };
  const providerFactory = {
    get: (key) => {
      assert.equal(key, "box");
      return provider;
    },
    list: () => [provider.getStatus()]
  };
  const environment = {
    maximumUploadSizeBytes: overrides.maximumUploadSizeBytes || 1024,
    projectRoot: path.join(__dirname, "missing-build")
  };

  return createApp({ environment, providerFactory });
}

async function withServer(app, callback) {
  const server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(0, "127.0.0.1", () =>
      resolve(listeningServer)
    );
    listeningServer.once("error", reject);
  });
  const address = server.address();

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test("reports API health and configured storage providers", async () => {
  await withServer(createTestApplication(), async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((response) =>
      response.json()
    );
    const providers = await fetch(
      `${baseUrl}/api/storage/providers`
    ).then((response) => response.json());

    assert.equal(health.status, "ok");
    assert.equal(providers.providers[0].key, "box");
    assert.equal(providers.providers[0].configured, true);
  });
});

test("accepts a browser multipart upload and returns the Box result", async () => {
  await withServer(createTestApplication(), async (baseUrl) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob(["hello"], { type: "text/plain" }),
      "hello.txt"
    );

    const response = await fetch(`${baseUrl}/api/storage/box/files`, {
      body: form,
      method: "POST"
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.file.id, "box-file-1");
    assert.equal(body.file.originalName, "hello.txt");
    assert.equal(body.message, "hello.txt was sent to Box");
  });
});

test("rejects a browser upload above the server limit", async () => {
  await withServer(
    createTestApplication({ maximumUploadSizeBytes: 3 }),
    async (baseUrl) => {
      const form = new FormData();
      form.append("file", new Blob(["four"]), "too-large.txt");

      const response = await fetch(`${baseUrl}/api/storage/box/files`, {
        body: form,
        method: "POST"
      });
      const body = await response.json();

      assert.equal(response.status, 413);
      assert.equal(body.error.code, "FILE_TOO_LARGE");
    }
  );
});
