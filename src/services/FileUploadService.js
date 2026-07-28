const fs = require("node:fs/promises");

class FileUploadService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async upload(providerKey, file) {
    const provider = this.providerFactory.get(providerKey);

    try {
      const result = await provider.uploadFile(file);

      return {
        file: result,
        message: result.duplicate
          ? `${file.originalname || file.filename} already exists in ${provider.displayName}`
          : `${file.originalname || file.filename} was sent to ${provider.displayName}`
      };
    } finally {
      if (file.temporary && file.path) {
        await fs.rm(file.path, { force: true });
      }
    }
  }
}

module.exports = { FileUploadService };
