class FileListingService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async list(providerKey) {
    const provider = this.providerFactory.get(providerKey);
    const files = await provider.listCloudFiles();

    return {
      files,
      provider: {
        displayName: provider.displayName,
        key: provider.key
      },
      refreshedAt: new Date().toISOString(),
      source: "cloud"
    };
  }
}

module.exports = { FileListingService };
