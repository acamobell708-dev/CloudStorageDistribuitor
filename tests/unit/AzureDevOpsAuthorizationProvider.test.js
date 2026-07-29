const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AZURE_DEVOPS_SCOPE,
  ManagedIdentityAuthorizationProvider,
  PersonalAccessTokenAuthorizationProvider,
  createAzureDevOpsAuthorizationProvider
} = require("../../src/services/storage/azure/AzureDevOpsAuthorizationProvider");

test("creates a Basic authorization header from a configured PAT", async () => {
  const provider = new PersonalAccessTokenAuthorizationProvider({
    pat: "secret-pat"
  });

  assert.equal(provider.isConfigured(), true);
  assert.equal(
    await provider.getAuthorizationHeader(),
    `Basic ${Buffer.from(":secret-pat").toString("base64")}`
  );
});

test("reports a missing PAT without exposing an authorization header", async () => {
  const provider = new PersonalAccessTokenAuthorizationProvider();

  assert.equal(provider.isConfigured(), false);
  await assert.rejects(
    provider.getAuthorizationHeader(),
    /AZURE_DEVOPS_PAT is not configured/
  );
});

test("requests an Azure DevOps bearer token from managed identity", async () => {
  const requestedScopes = [];
  const provider = new ManagedIdentityAuthorizationProvider({
    credential: {
      async getToken(scope) {
        requestedScopes.push(scope);
        return {
          expiresOnTimestamp: Date.now() + 60_000,
          token: "managed-identity-token"
        };
      }
    }
  });

  assert.equal(provider.isConfigured(), true);
  assert.equal(
    await provider.getAuthorizationHeader(),
    "Bearer managed-identity-token"
  );
  assert.deepEqual(requestedScopes, [AZURE_DEVOPS_SCOPE]);
});

test("rejects unsupported Azure authorization modes", () => {
  assert.throws(
    () =>
      createAzureDevOpsAuthorizationProvider({
        mode: "unknown"
      }),
    /Unsupported Azure authorization mode/
  );
});
