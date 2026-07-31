const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const fileListingModuleUrl = pathToFileURL(
  path.join(
    __dirname,
    "..",
    "..",
    "public",
    "app",
    "files",
    "fileListing.mjs"
  )
).href;

async function loadFileListingModule() {
  return import(fileListingModuleUrl);
}

const files = [
  {
    modifiedAt: "2026-07-20T10:00:00Z",
    name: "Projects",
    path: "/Projects",
    type: "folder"
  },
  {
    modifiedAt: "2026-07-30T11:00:00Z",
    name: "Archive",
    path: "/Archive",
    type: "folder"
  },
  {
    modifiedAt: "2026-07-29T10:00:00Z",
    name: "cover.jpg",
    path: "/media/cover.jpg",
    size: 600
  },
  {
    modifiedAt: "2026-07-28T10:00:00Z",
    name: "launch.mp4",
    path: "/media/launch.mp4",
    size: 900
  },
  {
    modifiedAt: "2026-07-30T10:00:00Z",
    name: "server.js",
    path: "/source/server.js",
    size: 100
  }
];

test("filters files with the shared media classifier", async () => {
  const { createFileListing, getFileCategory } =
    await loadFileListingModule();
  const categoryByName = new Map(
    files.map((file) => [file.name, getFileCategory(file)])
  );

  assert.equal(categoryByName.get("Projects"), "folder");
  assert.equal(categoryByName.get("Archive"), "folder");
  assert.equal(categoryByName.get("cover.jpg"), "image");
  assert.equal(categoryByName.get("launch.mp4"), "video");
  assert.equal(categoryByName.get("server.js"), "source");
  assert.deepEqual(
    createFileListing(files, { filter: "source" }).map(
      (file) => file.name
    ),
    ["server.js"]
  );
});

test("searches names and paths without a provider request", async () => {
  const { createFileListing } = await loadFileListingModule();

  assert.deepEqual(
    createFileListing(files, { query: "media" }).map(
      (file) => file.name
    ),
    ["cover.jpg", "launch.mp4"]
  );
});

test("sorts files and folders using their available metadata", async () => {
  const { createFileListing } = await loadFileListingModule();

  assert.deepEqual(
    createFileListing(files, { sort: "name-desc" }).map(
      (file) => file.name
    ),
    ["server.js", "Projects", "launch.mp4", "cover.jpg", "Archive"]
  );
  assert.deepEqual(
    createFileListing(files, { sort: "size-desc" }).map(
      (file) => file.name
    ),
    ["launch.mp4", "cover.jpg", "server.js", "Archive", "Projects"]
  );
  assert.deepEqual(
    createFileListing(files, { sort: "size-asc" }).map(
      (file) => file.name
    ),
    ["server.js", "cover.jpg", "launch.mp4", "Archive", "Projects"]
  );
  assert.deepEqual(
    createFileListing(files, { sort: "updated-desc" }).map(
      (file) => file.name
    ),
    ["Archive", "server.js", "cover.jpg", "launch.mp4", "Projects"]
  );
  assert.deepEqual(
    createFileListing(files, {
      filter: "folder",
      sort: "updated-asc"
    }).map((file) => file.name),
    ["Projects", "Archive"]
  );
});

test("limits predictive matches and prioritizes name prefixes", async () => {
  const { getSearchSuggestions } = await loadFileListingModule();
  const suggestions = getSearchSuggestions(
    [
      { id: "1", name: "annual report.pdf" },
      { id: "2", name: "report-video.mp4" },
      { id: "3", name: "report-image.png" }
    ],
    "report",
    2
  );

  assert.deepEqual(
    suggestions.map((file) => file.name),
    ["report-video.mp4", "report-image.png"]
  );
});
