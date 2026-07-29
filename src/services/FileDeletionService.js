const { ValidationError } = require("../errors/ApplicationError");

class FileDeletionService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async delete(providerKey, fileReference = {}) {
    const id = String(fileReference.id || "").trim();

    if (!id) {
      throw new ValidationError("A cloud file ID is required");
    }

    const provider = this.providerFactory.get(providerKey);
    const file = await provider.deleteCloudFile({
      id,
      path:
        typeof fileReference.path === "string"
          ? fileReference.path
          : undefined
    });

    if (!file?.removed) {
      throw new Error(
        `${provider.displayName} did not confirm the file deletion`
      );
    }

    return {
      deletedAt: new Date().toISOString(),
      file,
      message: `${file.filename || "Item"} was deleted from ${provider.displayName}`,
      provider: {
        displayName: provider.displayName,
        key: provider.key
      }
    };
  }
}

module.exports = { FileDeletionService };
