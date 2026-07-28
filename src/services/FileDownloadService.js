const { ValidationError } = require("../errors/ApplicationError");

class FileDownloadService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async getDownload(providerKey, fileReference = {}) {
    const id = String(fileReference.id || "").trim();

    if (!id) {
      throw new ValidationError("A cloud file ID is required");
    }

    const provider = this.providerFactory.get(providerKey);
    const download = await provider.downloadCloudFile({
      id,
      path:
        typeof fileReference.path === "string"
          ? fileReference.path
          : undefined
    });

    if (!download?.body || !download.filename) {
      throw new Error(
        `${provider.displayName} returned an incomplete file download`
      );
    }

    return download;
  }
}

module.exports = { FileDownloadService };
