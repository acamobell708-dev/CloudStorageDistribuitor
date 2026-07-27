const assert = require("node:assert/strict");
const test = require("node:test");
const {
  BoxStorageProvider
} = require("../src/services/storage/box/BoxStorageProvider");

function createApiClient(responses) {
  const calls = [];
  const authClient = {
    isConfigured: () => true,
    requireConfiguration: () => undefined
  };

  return {
    apiUrl: "https://box.test/api",
    authClient,
    calls,
    requestJson: async (url, options) => {
      calls.push({ options, url });
      return responses.shift();
    },
    uploadUrl: "https://box.test/upload"
  };
}

test("uploads arbitrary file types with Box multipart fields in order", async () => {
  const apiClient = createApiClient([
    { entries: [] },
    {
      entries: [
        {
          id: "987",
          name: "stored-file.zip",
          sha1: "box-sha1",
          size: 12
        }
      ]
    }
  ]);
  const provider = new BoxStorageProvider({
    apiClient,
    folderId: "123",
    maximumUploadSizeBytes: 1024
  });

  const result = await provider.uploadFile({
    body: Buffer.from("archive-data"),
    contentType: "application/zip",
    filename: "source archive.zip"
  });

  assert.equal(result.id, "987");
  assert.equal(result.originalName, "source archive.zip");
  assert.equal(result.duplicate, false);
  assert.deepEqual(
    [...apiClient.calls[1].options.body.keys()],
    ["attributes", "file"]
  );

  const attributes = JSON.parse(
    apiClient.calls[1].options.body.get("attributes")
  );
  assert.equal(attributes.parent.id, "123");
  assert.match(attributes.name, /^[a-f0-9]{64}-source_archive\.zip$/);
});

test("returns an existing Box file when the SHA-256 hash matches", async () => {
  const repeatedBody = Buffer.from("duplicate");
  const crypto = require("node:crypto");
  const hash = crypto.createHash("sha256").update(repeatedBody).digest("hex");
  const apiClient = createApiClient([
    {
      entries: [
        {
          id: "existing",
          name: `${hash}-previous.txt`,
          sha1: "same",
          size: repeatedBody.length,
          type: "file"
        }
      ]
    }
  ]);
  const provider = new BoxStorageProvider({
    apiClient,
    folderId: "123",
    maximumUploadSizeBytes: 1024
  });

  const result = await provider.uploadFile({
    body: repeatedBody,
    contentType: "text/plain",
    filename: "duplicate.txt"
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.id, "existing");
  assert.equal(apiClient.calls.length, 1);
});

test("rejects a file above the configured direct-upload limit", async () => {
  const provider = new BoxStorageProvider({
    apiClient: createApiClient([]),
    folderId: "123",
    maximumUploadSizeBytes: 3
  });

  await assert.rejects(
    provider.uploadFile({
      body: Buffer.from("four"),
      filename: "large.txt"
    }),
    (error) => error.code === "FILE_TOO_LARGE" && error.statusCode === 413
  );
});
