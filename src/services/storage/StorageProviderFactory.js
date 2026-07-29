const {
  ValidationError
} = require("../../errors/ApplicationError");
const {
  AzureDevOpsStorageProvider
} = require("./azure/AzureDevOpsStorageProvider");
const { BoxStorageProvider } = require("./box/BoxStorageProvider");

class StorageProviderFactory {
  constructor(providers = []) {
    this.providers = new Map();

    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider) {
    if (!provider?.key) {
      throw new TypeError("A storage provider must have a key");
    }

    this.providers.set(provider.key.toLowerCase(), provider);
    return this;
  }

  get(providerKey) {
    const normalizedKey = String(providerKey || "").toLowerCase();
    const provider = this.providers.get(normalizedKey);

    if (!provider) {
      throw new ValidationError(
        `Unsupported storage provider: ${providerKey || "missing"}`
      );
    }

    return provider;
  }

  async list() {
    return Promise.all(
      [...this.providers.values()].map(async (provider) => {
        try {
          return await provider.getStatus();
        } catch (error) {
          return {
            acceptedFileTypes: provider.acceptedFileTypes,
            configured: provider.isConfigured(),
            connectionError: error.message,
            description: provider.description,
            displayName: provider.displayName,
            key: provider.key,
            listingConfigured: provider.isListingConfigured(),
            maximumUploadSizeBytes: provider.maximumUploadSizeBytes,
            supportedFileActions: provider.supportedFileActions
          };
        }
      })
    );
  }
}

function createStorageProviderFactory(environment) {
  return new StorageProviderFactory([
    new BoxStorageProvider({
      ...environment.box
    }),
    new AzureDevOpsStorageProvider({
      ...environment.azure,
      localDataRepositoryEnabled: false
    })
  ]);
}

module.exports = {
  StorageProviderFactory,
  createStorageProviderFactory
};
