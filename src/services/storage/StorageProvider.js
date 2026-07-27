const { ValidationError } = require("../../errors/ApplicationError");

class StorageProvider {
  constructor({ key, displayName, maximumUploadSizeBytes }) {
    if (new.target === StorageProvider) {
      throw new TypeError("StorageProvider is an abstract class");
    }

    this.key = key;
    this.displayName = displayName;
    this.maximumUploadSizeBytes = maximumUploadSizeBytes;
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      displayName: this.displayName,
      key: this.key,
      maximumUploadSizeBytes: this.maximumUploadSizeBytes
    };
  }

  isConfigured() {
    return false;
  }

  normalizeFile(file) {
    const body = file?.body || file?.buffer;
    const filename = file?.filename || file?.originalname;
    const contentType =
      file?.contentType || file?.mimetype || "application/octet-stream";

    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ValidationError(
        `No file data was supplied for ${filename || "the file"}`
      );
    }

    if (!filename || typeof filename !== "string") {
      throw new ValidationError("The uploaded file must have a filename");
    }

    if (body.length > this.maximumUploadSizeBytes) {
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
      filename,
      size: body.length
    };
  }

  async uploadFile() {
    throw new Error(`${this.displayName} does not implement uploadFile()`);
  }
}

module.exports = { StorageProvider };
