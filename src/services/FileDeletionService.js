const { ValidationError } = require("../errors/ApplicationError");

class FileDeletionService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async delete(providerKey, fileReference = {}) {
    const id = String(fileReference.id || "").trim();
    const itemType =
      fileReference.type === "folder" ? "folder" : "file";

    if (!id) {
      throw new ValidationError(`A cloud ${itemType} ID is required`);
    }

    const provider = this.providerFactory.get(providerKey);
    const deleteItem =
      itemType === "folder"
        ? provider.deleteCloudFolder?.bind(provider)
        : provider.deleteCloudFile.bind(provider);

    if (!deleteItem) {
      throw new ValidationError(
        `${provider.displayName} does not support folder deletion`,
        {
          code: "UNSUPPORTED_FILE_ACTION",
          statusCode: 405
        }
      );
    }

    const file = await deleteItem({
      id,
      path:
        typeof fileReference.path === "string"
          ? fileReference.path
          : undefined
    });

    if (!file?.removed) {
      throw new Error(
        `${provider.displayName} did not confirm the ${itemType} deletion`
      );
    }

    return {
      deletedAt: new Date().toISOString(),
      file,
      message:
        `${file.filename || file.name || "Item"} was deleted from ` +
        provider.displayName,
      provider: {
        displayName: provider.displayName,
        key: provider.key
      }
    };
  }
}

module.exports = { FileDeletionService };
