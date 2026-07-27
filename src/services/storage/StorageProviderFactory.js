const {
  ValidationError
} = require("../../errors/ApplicationError");
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

  list() {
    return [...this.providers.values()].map((provider) =>
      provider.getStatus()
    );
  }
}

function createStorageProviderFactory(environment) {
  return new StorageProviderFactory([
    new BoxStorageProvider({
      ...environment.box,
      maximumUploadSizeBytes: environment.maximumUploadSizeBytes
    })
  ]);
}

module.exports = {
  StorageProviderFactory,
  createStorageProviderFactory
};
