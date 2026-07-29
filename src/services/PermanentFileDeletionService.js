const {
  ValidationError
} = require("../errors/ApplicationError");

class PermanentFileDeletionService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async delete(providerKey, fileReference = {}) {
    const id = String(fileReference.id || "").trim();
    const filePath = String(fileReference.path || "").trim();

    if (!id || !filePath) {
      throw new ValidationError(
        "A cloud file ID and repository path are required"
      );
    }

    const provider = this.providerFactory.get(providerKey);
    const file = await provider.permanentlyDeleteCloudFile({
      id,
      path: filePath
    });

    if (!file?.removed || !file?.removedFromHistory) {
      throw new Error(
        `${provider.displayName} did not confirm the permanent deletion`
      );
    }

    return {
      file,
      message:
        `${file.filename || "Item"} was removed from the current ` +
        `${provider.displayName} repository and its reachable history`,
      provider: {
        displayName: provider.displayName,
        key: provider.key
      },
      purgedAt: new Date().toISOString()
    };
  }
}

module.exports = { PermanentFileDeletionService };
