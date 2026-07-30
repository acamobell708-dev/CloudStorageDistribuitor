const fs = require("node:fs/promises");

class FileUploadService {
  constructor(providerFactory) {
    this.providerFactory = providerFactory;
  }

  async upload(providerKey, file) {
    return this.uploadMany(providerKey, [file], { mode: "single" });
  }

  async uploadMany(providerKey, files, options = {}) {
    const provider = this.providerFactory.get(providerKey);

    try {
      const providerResult =
        options.mode === "single" && files.length === 1
          ? await provider.uploadFile(files[0])
          : typeof provider.uploadFiles === "function"
            ? await provider.uploadFiles(files)
            : {
                files: await Promise.all(
                  files.map((file) => provider.uploadFile(file))
                )
              };
      const results = Array.isArray(providerResult)
        ? providerResult
        : providerResult.files ||
          providerResult.images ||
          [providerResult];
      const duplicateCount = results.filter(
        (file) => file.duplicate
      ).length;
      const firstFile = files[0];
      const originalName =
        firstFile.originalname || firstFile.filename;
      const folderName =
        options.mode === "folder"
          ? String(firstFile.relativePath || "").split("/")[0]
          : undefined;
      let message;

      if (files.length === 1 && options.mode === "single") {
        message = results[0].duplicate
          ? `${originalName} already exists in ${provider.displayName}`
          : `${originalName} was sent to ${provider.displayName}`;
      } else if (options.mode === "folder") {
        message =
          `${folderName} (${files.length} ` +
          `${files.length === 1 ? "file" : "files"}) was sent to ` +
          `${provider.displayName}`;
      } else {
        message =
          `${files.length} files were sent to ${provider.displayName}`;
      }

      return {
        duplicateCount,
        file: results[0],
        files: results,
        message,
        mode: options.mode || "single"
      };
    } finally {
      await Promise.all(
        files
          .filter((file) => file.temporary && file.path)
          .map((file) => fs.rm(file.path, { force: true }))
      );
    }
  }
}

module.exports = { FileUploadService };
