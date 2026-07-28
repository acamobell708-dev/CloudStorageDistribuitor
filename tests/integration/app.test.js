const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../../src/app");

function createTestApplication(overrides = {}) {
  const createProvider = (key, displayName) => ({
    acceptedFileTypes:
      key === "azure"
        ? ["image/*", "audio/*", "video/*"]
        : ["*/*"],
    description: `${displayName} test provider`,
    displayName,
    getMaximumUploadSizeBytes: async () =>
      overrides.maximumUploadSizeBytes || 1024,
    getStatus: async () => ({
      acceptedFileTypes:
        key === "azure"
          ? ["image/*", "audio/*", "video/*"]
          : ["*/*"],
      configured: true,
      description: `${displayName} test provider`,
      displayName,
      key,
      listingConfigured: true,
      maximumUploadSizeBytes:
        overrides.maximumUploadSizeBytes || 1024
    }),
    isConfigured: () => true,
    isListingConfigured: () => true,
    key,
    listCloudFiles: async () => [
      {
        id: `${key}-file-1`,
        modifiedAt: "2026-07-28T12:00:00Z",
        name: `${key}-file.txt`,
        path: `/${key}-file.txt`,
        provider: key,
        size: 12,
        version: "version-1"
      }
    ],
    maximumUploadSizeBytes:
      overrides.maximumUploadSizeBytes || 1024,
    uploadFile: async (file) => ({
      duplicate: false,
      filename: `stored-${file.originalname}`,
      id: key === "box" ? "box-file-1" : undefined,
      originalName: file.originalname,
      path: key === "azure" ? "images/stored-file.png" : undefined,
      provider: key,
      pushed: true,
      size: file.size
    })
  });
  const providers = new Map([
    ["box", createProvider("box", "Box")],
    ["azure", createProvider("azure", "Azure Repos")]
  ]);
  const providerFactory = {
    get: (key) => providers.get(key),
    list: async () =>
      Promise.all([...providers.values()].map((provider) =>
        provider.getStatus()
      ))
  };
  const environment = {
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
    assert.equal(providers.providers[1].key, "azure");
  });
});

test("routes a media upload to the selected Azure provider", async () => {
  await withServer(createTestApplication(), async (baseUrl) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob(["image"], { type: "image/png" }),
      "photo.png"
    );

    const response = await fetch(`${baseUrl}/api/storage/azure/files`, {
      body: form,
      method: "POST"
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.file.provider, "azure");
    assert.equal(body.file.path, "images/stored-file.png");
    assert.equal(body.message, "photo.png was sent to Azure Repos");
  });
});

test("lists current cloud files through the selected provider", async () => {
  await withServer(createTestApplication(), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/storage/azure/files`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "cloud");
    assert.equal(body.provider.key, "azure");
    assert.equal(body.files.length, 1);
    assert.equal(body.files[0].name, "azure-file.txt");
    assert.match(body.refreshedAt, /^\d{4}-\d{2}-\d{2}T/);
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
