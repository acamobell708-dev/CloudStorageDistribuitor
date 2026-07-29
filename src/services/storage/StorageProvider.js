const { ValidationError } = require("../../errors/ApplicationError");

class StorageProvider {
  constructor({
    acceptedFileTypes = ["*/*"],
    browserUploadStorage = "disk",
    description,
    key,
    displayName,
    maximumUploadSizeBytes,
    supportedFileActions = ["download"]
  }) {
    if (new.target === StorageProvider) {
      throw new TypeError("StorageProvider is an abstract class");
    }

    this.acceptedFileTypes = acceptedFileTypes;
    this.browserUploadStorage = browserUploadStorage;
    this.description = description;
    this.key = key;
    this.displayName = displayName;
    this.maximumUploadSizeBytes = maximumUploadSizeBytes;
    this.supportedFileActions = supportedFileActions;
  }

  async getStatus() {
    return {
      acceptedFileTypes: this.acceptedFileTypes,
      configured: this.isConfigured(),
      description: this.description,
      displayName: this.displayName,
      key: this.key,
      listingConfigured: this.isListingConfigured(),
      maximumUploadSizeBytes: await this.getMaximumUploadSizeBytes(),
      supportedFileActions: this.supportedFileActions
    };
  }

  async getMaximumUploadSizeBytes() {
    return this.maximumUploadSizeBytes;
  }

  isConfigured() {
    return false;
  }

  isListingConfigured() {
    return this.isConfigured();
  }

  normalizeFile(file) {
    const body = file?.body || file?.buffer;
    const filePath = file?.path;
    // Disk-backed middleware assigns a random temporary filename. Preserve the
    // browser filename because providers validate and retain its extension.
    const filename = file?.originalname || file?.filename;
    const contentType =
      file?.contentType || file?.mimetype || "application/octet-stream";

    const size = Buffer.isBuffer(body) ? body.length : Number(file?.size);

    if (
      (!Buffer.isBuffer(body) && !filePath) ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      throw new ValidationError(
        `No file data was supplied for ${filename || "the file"}`
      );
    }

    if (!filename || typeof filename !== "string") {
      throw new ValidationError("The uploaded file must have a filename");
    }

    if (size > this.maximumUploadSizeBytes) {
      const limitMb = this.maximumUploadSizeBytes / (1024 * 1024);
      throw new ValidationError(
        `${filename} is larger than the ${limitMb} MB upload limit`,
        {
          code: "FILE_TOO_LARGE",
          statusCode: 413
        }
      );
    }

    return {
      body,
      contentType,
      path: filePath,
      filename,
      size
    };
  }

  async uploadFile() {
    throw new Error(`${this.displayName} does not implement uploadFile()`);
  }

  async listCloudFiles() {
    throw new Error(
      `${this.displayName} does not implement listCloudFiles()`
    );
  }

  async downloadCloudFile() {
    throw new Error(
      `${this.displayName} does not implement downloadCloudFile()`
    );
  }

  async deleteCloudFile() {
    throw new ValidationError(
      `${this.displayName} does not support file deletion`,
      {
        code: "UNSUPPORTED_FILE_ACTION",
        statusCode: 405
      }
    );
  }
}

module.exports = { StorageProvider };
