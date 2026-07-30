class FileListingService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async list(providerKey, options = {}) {
    const provider = this.providerFactory.get(providerKey);
    const listing = options.browse
      ? typeof provider.browseCloudFiles === "function"
        ? await provider.browseCloudFiles({
            id: options.folderId,
            path: options.path
          })
        : {
            breadcrumbs: [
              {
                name: provider.displayName,
                path: "/"
              }
            ],
            files: await provider.listCloudFiles(),
            folder: {
              name: provider.displayName,
              path: "/"
            }
          }
      : {
          files: await provider.listCloudFiles()
        };

    return {
      ...listing,
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
