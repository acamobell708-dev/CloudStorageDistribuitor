const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const {
  AzureDevOpsStorageProvider
} = require("../../src/services/storage/azure/AzureDevOpsStorageProvider");

function createProvider(overrides = {}) {
  return new AzureDevOpsStorageProvider({
    branch: "main",
    dataRepoRoot: path.resolve("test-azure-data"),
    maximumUploadSizeBytes: 100 * 1024 * 1024,
    pat: "test-token",
    remote: "https://example.test/repository",
    shouldPush: true,
    ...overrides
  });
}

test("accepts common document, image, audio, and video locations", () => {
  const provider = createProvider();

  assert.equal(
    provider.getStorageLocation("report.pdf", "application/pdf")
      .relativeDirectory,
    "documents"
  );
  assert.equal(
    provider.getStorageLocation("notes.txt", "text/plain")
      .relativeDirectory,
    "documents"
  );
  assert.equal(
    provider.getMediaLocation("photo.webp", "image/webp")
      .relativeDirectory,
    "images"
  );
  assert.equal(
    provider.getMediaLocation("song.flac", "audio/flac")
      .relativeDirectory,
    "media/audio"
  );
  assert.equal(
    provider.getMediaLocation("clip.mp4", "video/mp4")
      .relativeDirectory,
    "media/video"
  );
});

test("accepts common source-code files", () => {
  const provider = createProvider();
  const supportedFiles = [
    ["index.html", "text/html"],
    ["styles.css", "text/css"],
    ["app.js", "application/javascript"],
    ["Main.java", "text/x-java-source"],
    ["server.py", "text/x-python"]
  ];

  for (const [filename, contentType] of supportedFiles) {
    assert.equal(
      provider.getStorageLocation(filename, contentType)
        .relativeDirectory,
      "source"
    );
  }
});

test("rejects unsupported and mismatched file extensions", () => {
  const provider = createProvider();

  assert.throws(
    () =>
      provider.getStorageLocation(
        "application.exe",
        "application/octet-stream"
      ),
    /not a supported document, source code, image, audio, or video/
  );
  assert.throws(
    () => provider.getStorageLocation("video.mp4", "image/png"),
    /does not match/
  );
});

test("returns a versioned Azure result through the common upload contract", async () => {
  const provider = createProvider();

  provider.ensureDataRepository = async () => undefined;
  provider.storeMediaFile = async (file) => ({
    duplicate: false,
    filename: "hash-clip.mp4",
    hash: "hash",
    path: "media/video/hash-clip.mp4"
  });
  provider.pushStoredMedia = async () => "abcdef1234567890";

  const result = await provider.uploadFile(
    Buffer.from("video"),
    "clip.mp4",
    "video/mp4"
  );

  assert.equal(result.provider, "azure");
  assert.equal(result.path, "media/video/hash-clip.mp4");
  assert.equal(result.commit, "abcdef1234567890");
  assert.equal(result.pushed, true);
});

test("normalizes files returned by the remote Azure listing client", async () => {
  const apiClient = {
    createFileWebUrl: (filePath) =>
      `https://azure.test/repository?path=${encodeURIComponent(filePath)}`,
    isConfigured: () => true,
    listRepositoryItems: async () => [
      {
        gitObjectType: "tree",
        isFolder: true,
        objectId: "folder",
        path: "/images"
      },
      {
        commitId: "commit-123",
        contentMetadata: {
          contentType: "image/png"
        },
        gitObjectType: "blob",
        isFolder: false,
        latestProcessedChange: {
          committer: {
            date: "2026-07-28T12:00:00Z"
          }
        },
        objectId: "blob-123",
        path: "/images/photo.png",
        size: 2048
      }
    ]
  };
  const provider = createProvider({ apiClient });

  const files = await provider.listCloudFiles();

  assert.equal(files.length, 1);
  assert.equal(files[0].name, "photo.png");
  assert.equal(files[0].path, "/images/photo.png");
  assert.equal(files[0].provider, "azure");
  assert.equal(files[0].size, 2048);
  assert.equal(files[0].version, "commit-123");
});

test("detects an Azure duplicate from the current remote Git blob", async () => {
  const body = Buffer.from("remote image");
  const objectId = createHash("sha1")
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest("hex");
  const apiClient = {
    createFileWebUrl: () => "https://azure.test/file",
    isConfigured: () => true,
    listRepositoryItems: async () => [
      {
        commitId: "remote-commit",
        gitObjectType: "blob",
        isFolder: false,
        objectId,
        path: "/images/photo.png"
      }
    ]
  };
  const provider = createProvider({ apiClient });

  provider.ensureDataRepository = async () => undefined;

  const result = await provider.uploadFile(
    body,
    "photo.png",
    "image/png"
  );

  assert.equal(result.duplicate, true);
  assert.equal(result.filename, "photo.png");
  assert.equal(result.path, "images/photo.png");
  assert.equal(result.commit, "remote-commit");
});

test("refuses to use the application repository as Azure data storage", () => {
  const applicationRoot = path.resolve("application-root");

  assert.throws(
    () =>
      createProvider({
        codeRepoRoot: applicationRoot,
        dataRepoRoot: applicationRoot
      }),
    /must not be the application repository/
  );
});
