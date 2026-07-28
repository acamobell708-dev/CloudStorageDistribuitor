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
