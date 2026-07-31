const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AzureDevOpsApiClient,
  parseAzureRemoteUrl
} = require("../../src/services/storage/azure/AzureDevOpsApiClient");

test("parses current and legacy Azure Repos remote URLs", () => {
  const current = parseAzureRemoteUrl(
    "https://organization@dev.azure.com/organization/My%20Project/_git/Media"
  );
  const legacy = parseAzureRemoteUrl(
    "https://organization.visualstudio.com/MyProject/_git/Media"
  );

  assert.equal(current.organization, "organization");
  assert.equal(current.project, "My Project");
  assert.equal(current.repository, "Media");
  assert.match(current.apiBaseUrl, /My%20Project/);
  assert.equal(legacy.organization, "organization");
  assert.equal(legacy.project, "MyProject");
});

test("lists the latest remote branch through the Azure DevOps REST API", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "main",
    fetch: async (url, options) => {
      calls.push({ options, url });
      return new Response(
        JSON.stringify({
          count: 1,
          value: [
            {
              gitObjectType: "blob",
              objectId: "blob-id",
              path: "/images/photo.png"
            }
          ]
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 200
        }
      );
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  const items = await client.listRepositoryItems();
  const requestUrl = new URL(calls[0].url);

  assert.equal(items[0].objectId, "blob-id");
  assert.equal(requestUrl.searchParams.get("recursionLevel"), "Full");
  assert.equal(
    requestUrl.searchParams.get("versionDescriptor.version"),
    "main"
  );
  assert.equal(
    requestUrl.searchParams.get("versionDescriptor.versionType"),
    "branch"
  );
  assert.equal(
    calls[0].options.headers.Authorization,
    `Basic ${Buffer.from(":secret-pat").toString("base64")}`
  );
  assert.equal(calls[0].url.includes("secret-pat"), false);
});

test("adds blob sizes from one recursive Azure tree request", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "main",
    fetch: async (url) => {
      calls.push(url);

      if (url.includes("/trees/")) {
        return Response.json({
          treeEntries: [
            {
              gitObjectType: "blob",
              objectId: "blob-id",
              relativePath: "images/photo.png",
              size: 4096
            }
          ]
        });
      }

      return Response.json({
        value: [
          {
            gitObjectType: "tree",
            isFolder: true,
            objectId: "root-tree-id",
            path: "/"
          },
          {
            gitObjectType: "blob",
            objectId: "blob-id",
            path: "/images/photo.png"
          }
        ]
      });
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  const items = await client.listRepositoryItems({
    includeSizes: true
  });
  const file = items.find((item) => item.objectId === "blob-id");
  const treeRequest = new URL(
    calls.find((url) => url.includes("/trees/"))
  );

  assert.equal(file.size, 4096);
  assert.equal(calls.length, 2);
  assert.equal(treeRequest.searchParams.get("recursive"), "true");
  assert.match(treeRequest.pathname, /\/trees\/root-tree-id$/);
});

test("uses an injected bearer authorization provider", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    authorizationProvider: {
      async getAuthorizationHeader() {
        return "Bearer short-lived-token";
      },
      getMissingConfigurationName() {
        return "Azure managed identity";
      },
      isConfigured() {
        return true;
      }
    },
    fetch: async (url, options) => {
      calls.push({ options, url });
      return Response.json({ value: [] });
    },
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  await client.listRepositoryItems();

  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer short-lived-token"
  );
});

test("opens a current-branch Azure item as a download stream", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "uploads",
    fetch: async (url, options) => {
      calls.push({ options, url });
      return new Response("file contents", {
        headers: {
          "Content-Length": "13",
          "Content-Type": "text/plain"
        },
        status: 200
      });
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  const response = await client.downloadRepositoryItem(
    "/source/example.js"
  );
  const requestUrl = new URL(calls[0].url);

  assert.equal(await response.text(), "file contents");
  assert.equal(requestUrl.searchParams.get("path"), "/source/example.js");
  assert.equal(requestUrl.searchParams.get("download"), "true");
  assert.equal(requestUrl.searchParams.get("$format"), "octetStream");
  assert.equal(
    requestUrl.searchParams.get("versionDescriptor.version"),
    "uploads"
  );
  assert.equal(
    calls[0].options.headers.Accept,
    "application/octet-stream"
  );
});

test("forwards one byte range when previewing an Azure item", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    fetch: async (url, options) => {
      calls.push({ options, url });
      return new Response("part", { status: 206 });
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  await client.downloadRepositoryItem("/media/clip.mp4", {
    range: "bytes=0-99"
  });

  assert.equal(calls[0].options.headers.Range, "bytes=0-99");
});

test("reads the configured Azure branch reference", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "uploads",
    fetch: async (url, options) => {
      calls.push({ options, url });
      return Response.json({
        value: [
          {
            name: "refs/heads/uploads",
            objectId: "current-commit"
          }
        ]
      });
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  const reference = await client.getBranchReference();
  const requestUrl = new URL(calls[0].url);

  assert.equal(reference.objectId, "current-commit");
  assert.equal(requestUrl.searchParams.get("filter"), "heads/uploads");
  assert.match(requestUrl.pathname, /\/refs$/);
});

test("creates a remote Azure Git push with base64 file content", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "main",
    fetch: async (url, options) => {
      calls.push({ options, url });
      return Response.json(
        {
          commits: [
            {
              commitId: "created-commit"
            }
          ]
        },
        { status: 201 }
      );
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  const result = await client.createFilePush({
    changes: [
      {
        content: Buffer.from("binary contents"),
        path: "/documents/report.pdf"
      }
    ],
    comment: "Add uploaded file report.pdf",
    oldObjectId: "previous-commit"
  });
  const body = JSON.parse(calls[0].options.body);

  assert.equal(result.commits[0].commitId, "created-commit");
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[0].url, /\/pushes\?/);
  assert.equal(body.refUpdates[0].name, "refs/heads/main");
  assert.equal(body.refUpdates[0].oldObjectId, "previous-commit");
  assert.equal(
    body.commits[0].changes[0].newContent.content,
    Buffer.from("binary contents").toString("base64")
  );
  assert.equal(
    body.commits[0].changes[0].newContent.contentType,
    "base64Encoded"
  );
});

test("creates an Azure Git deletion commit without file content", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "main",
    fetch: async (url, options) => {
      calls.push({ options, url });
      return Response.json(
        {
          commits: [
            {
              commitId: "deletion-commit"
            }
          ]
        },
        { status: 201 }
      );
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  await client.createFileDeletePush({
    comment: "Delete photo.png",
    oldObjectId: "previous-commit",
    path: "/images/photo.png"
  });

  const body = JSON.parse(calls[0].options.body);
  const change = body.commits[0].changes[0];

  assert.equal(change.changeType, "delete");
  assert.equal(change.item.path, "/images/photo.png");
  assert.equal(change.newContent, undefined);
  assert.equal(
    body.refUpdates[0].oldObjectId,
    "previous-commit"
  );
});

test("creates one Azure Git push for multiple file deletions", async () => {
  const calls = [];
  const client = new AzureDevOpsApiClient({
    branch: "main",
    fetch: async (url, options) => {
      calls.push({ options, url });
      return Response.json(
        {
          commits: [
            {
              commitId: "folder-deletion-commit"
            }
          ]
        },
        { status: 201 }
      );
    },
    pat: "secret-pat",
    remote:
      "https://organization@dev.azure.com/organization/project/_git/media"
  });

  await client.createFilesDeletePush({
    comment: "Delete Project",
    oldObjectId: "previous-commit",
    paths: [
      "/folders/Project/one.txt",
      "/folders/Project/Nested/two.txt"
    ]
  });

  const body = JSON.parse(calls[0].options.body);

  assert.deepEqual(
    body.commits[0].changes.map((change) => ({
      changeType: change.changeType,
      path: change.item.path
    })),
    [
      {
        changeType: "delete",
        path: "/folders/Project/one.txt"
      },
      {
        changeType: "delete",
        path: "/folders/Project/Nested/two.txt"
      }
    ]
  );
  assert.equal(calls.length, 1);
});
