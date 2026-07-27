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

const maximumUploadSizeMb = parseNumber("MAX_UPLOAD_SIZE_MB", 50, {
  maximum: 50,
  minimum: 1
});

const environment = Object.freeze({
  host: process.env.HOST || "127.0.0.1",
  port: parseNumber("PORT", 3000, {
    integer: true,
    maximum: 65535,
    minimum: 0
  }),
  maximumUploadSizeBytes: maximumUploadSizeMb * 1024 * 1024,
  maximumUploadSizeMb,
  projectRoot,
  box: Object.freeze({
    clientId: process.env.BOX_CLIENT_ID,
    clientSecret: process.env.BOX_CLIENT_SECRET,
    enterpriseId: process.env.BOX_ENTERPRISE_ID,
    folderId: process.env.BOX_FOLDER_ID,
    downloadDirectory: path.resolve(
      projectRoot,
      process.env.BOX_DOWNLOAD_DIR || ".box-downloads"
    )
  })
});

module.exports = {
  environment,
  loadEnvironmentFile,
  parseNumber
};
