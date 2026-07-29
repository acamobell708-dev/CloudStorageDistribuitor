const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

function loadEnvironmentFile() {
  if (typeof process.loadEnvFile !== "function") {
    throw new Error("Node.js 22.12 or newer is required to load the .env file");
  }

  try {
    process.loadEnvFile(path.join(projectRoot, ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function parseNumber(name, fallback, limits = {}) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);

  if (
    !Number.isFinite(value) ||
    (limits.integer && !Number.isInteger(value)) ||
    (limits.minimum !== undefined && value < limits.minimum) ||
    (limits.maximum !== undefined && value > limits.maximum)
  ) {
    throw new Error(`Invalid ${name} environment value`);
  }

  return value;
}

loadEnvironmentFile();

const boxMaximumUploadSizeMb = parseNumber(
  "BOX_MAX_UPLOAD_SIZE_MB",
  250,
  {
    maximum: 500 * 1024,
    minimum: 1
  }
);

const environment = Object.freeze({
  auth: Object.freeze({
    secureCookies:
      process.env.AUTH_SECURE_COOKIE === "true" ||
      process.env.NODE_ENV === "production",
    sessionDurationMs:
      parseNumber("AUTH_SESSION_HOURS", 8, {
        maximum: 168,
        minimum: 1
      }) *
      60 *
      60 *
      1000
  }),
  host: process.env.HOST || "127.0.0.1",
  port: parseNumber("PORT", 3000, {
    integer: true,
    maximum: 65535,
    minimum: 0
  }),
  projectRoot,
  uploadTempDirectory: path.resolve(
    process.env.UPLOAD_TEMP_DIR ||
      path.join(os.tmpdir(), "cloud-storage-distributor")
  ),
  azure: Object.freeze({
    authorizationMode: process.env.AZURE_AUTH_MODE || "pat",
    branch: process.env.AZURE_GIT_BRANCH || "main",
    ipv4Only: process.env.GIT_IPV4_ONLY === "true",
    managedIdentityClientId:
      process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID,
    maximumUploadSizeBytes: 100 * 1024 * 1024,
    pat: process.env.AZURE_DEVOPS_PAT,
    purgeAuthorizationMode:
      process.env.AZURE_PURGE_AUTH_MODE ||
      process.env.AZURE_AUTH_MODE ||
      "pat",
    purgeManagedIdentityClientId:
      process.env.AZURE_PURGE_MANAGED_IDENTITY_CLIENT_ID ||
      process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID,
    purgePat:
      process.env.AZURE_PURGE_PAT || process.env.AZURE_DEVOPS_PAT,
    remote: process.env.AZURE_GIT_REMOTE,
    shouldPush: process.env.AZURE_GIT_PUSH === "true"
  }),
  azureCli: Object.freeze({
    dataRepoRoot: path.resolve(
      projectRoot,
      process.env.AZURE_DATA_REPO_DIR || "../AzureDataRepo"
    ),
    gitAuthorEmail:
      process.env.AZURE_GIT_AUTHOR_EMAIL || "media-service@localhost",
    gitAuthorName:
      process.env.AZURE_GIT_AUTHOR_NAME || "Cloud Storage Media Service",
    sslBackend: process.env.GIT_SSL_BACKEND
  }),
  box: Object.freeze({
    clientId: process.env.BOX_CLIENT_ID,
    clientSecret: process.env.BOX_CLIENT_SECRET,
    enterpriseId: process.env.BOX_ENTERPRISE_ID,
    folderId: process.env.BOX_FOLDER_ID,
    maximumUploadSizeBytes: boxMaximumUploadSizeMb * 1024 * 1024,
    downloadDirectory: path.resolve(
      projectRoot,
      process.env.BOX_DOWNLOAD_DIR || ".box-downloads"
    )
  })
});

module.exports = { environment };
