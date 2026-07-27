const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ConfigurationError,
  ValidationError
} = require("../../../errors/ApplicationError");
const { FileNamingService } = require("../FileNamingService");
const { StorageProvider } = require("../StorageProvider");
const { BoxApiClient } = require("./BoxApiClient");
const { BoxAuthClient } = require("./BoxAuthClient");

class BoxStorageProvider extends StorageProvider {
  constructor(options = {}) {
    super({
      displayName: "Box",
      key: "box",
      maximumUploadSizeBytes:
        options.maximumUploadSizeBytes || 50 * 1024 * 1024
    });

    this.folderId = options.folderId;
    this.downloadDirectory = options.downloadDirectory;
    this.fileNamingService =
      options.fileNamingService || new FileNamingService();
    this.apiClient =
      options.apiClient ||
      new BoxApiClient({
        authClient: new BoxAuthClient({
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          enterpriseId: options.enterpriseId,
          fetch: options.fetch
        }),
        fetch: options.fetch
      });
  }

  isConfigured() {
    return Boolean(
      this.folderId && this.apiClient?.authClient?.isConfigured?.()
    );
  }

  requireConfiguration() {
    if (!this.folderId) {
      throw new ConfigurationError(
        "Missing Box configuration: BOX_FOLDER_ID"
      );
    }

    this.apiClient.authClient.requireConfiguration();
  }

  async getAccessToken() {
    this.requireConfiguration();
    return this.apiClient.authClient.getAccessToken();
  }

  async listFiles() {
    this.requireConfiguration();

    const files = [];
    let marker;

    do {
      const query = new URLSearchParams({
        fields: "id,type,name,size,sha1,modified_at,parent",
        limit: "1000",
        usemarker: "true"
      });

      if (marker) {
        query.set("marker", marker);
      }

      const result = await this.apiClient.requestJson(
        `${this.apiClient.apiUrl}/folders/` +
          `${encodeURIComponent(this.folderId)}/items?${query}`,
        {
          action: "Listing files in the configured Box folder"
        }
      );

      for (const entry of result?.entries || []) {
        if (entry.type === "file") {
          files.push(entry);
        }
      }

      marker = result?.next_marker || undefined;
    } while (marker);

    return files;
  }

  async getFileInfo(fileId) {
    this.requireConfiguration();

    if (!fileId) {
      throw new ValidationError("A Box file ID is required");
    }

    const query = new URLSearchParams({
      fields: "id,type,name,size,sha1,modified_at,parent"
    });

    return this.apiClient.requestJson(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}?${query}`,
      { action: `Reading Box file ${fileId}` }
    );
  }

  requireFileInConfiguredFolder(file) {
    if (String(file.parent?.id) !== String(this.folderId)) {
      throw new ValidationError(
        `Box file ${file.id} is not directly inside the configured folder`
      );
    }
  }

  async uploadFile(fileOrBody, originalName, contentType) {
    this.requireConfiguration();

    const suppliedFile = Buffer.isBuffer(fileOrBody)
      ? {
          body: fileOrBody,
          contentType,
          filename: originalName
        }
      : fileOrBody;
    const file = this.normalizeFile(suppliedFile);
    const { filename, hash } = this.fileNamingService.createStoredName(
      file.body,
      file.filename
    );
    const currentFiles = await this.listFiles();
    const existing = currentFiles.find((item) =>
      item.name.startsWith(`${hash}-`)
    );

    if (existing) {
      return {
        duplicate: true,
        filename: existing.name,
        hash,
        id: existing.id,
        originalName: file.filename,
        provider: this.key,
        pushed: true,
        sha1: existing.sha1,
        size: existing.size
      };
    }

    const form = new FormData();

    // Box requires attributes to appear before the file in multipart data.
    form.append(
      "attributes",
      JSON.stringify({
        name: filename,
        parent: {
          id: this.folderId
        }
      })
    );
    form.append(
      "file",
      new Blob([file.body], {
        type: file.contentType
      }),
      filename
    );

    const result = await this.apiClient.requestJson(
      `${this.apiClient.uploadUrl}/files/content`,
      {
        action: `Uploading ${file.filename} to Box`,
        body: form,
        method: "POST"
      }
    );
    const uploaded = result?.entries?.[0];

    if (!uploaded) {
      throw new Error("Box did not return an uploaded file");
    }

    return {
      duplicate: false,
      filename: uploaded.name,
      hash,
      id: uploaded.id,
      originalName: file.filename,
      provider: this.key,
      pushed: true,
      sha1: uploaded.sha1,
      size: uploaded.size ?? file.size
    };
  }

  async uploadFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError("No files were supplied");
    }

    for (const file of files) {
      this.normalizeFile(file);
    }

    const uploadedFiles = [];

    for (const file of files) {
      uploadedFiles.push(await this.uploadFile(file));
    }

    return {
      images: uploadedFiles,
      provider: this.key,
      pushed: true
    };
  }

  async downloadFile(fileId, destinationDirectory = this.downloadDirectory) {
    this.requireConfiguration();

    if (!destinationDirectory) {
      throw new ValidationError("A download directory is required");
    }

    const file = await this.getFileInfo(fileId);
    this.requireFileInConfiguredFolder(file);

    const destination = path.resolve(destinationDirectory);
    await fs.mkdir(destination, { recursive: true });

    const localPath = await this.findAvailableDownloadPath(
      destination,
      file.name
    );
    const response = await this.apiClient.request(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}/content`,
      { action: `Downloading Box file ${fileId}` }
    );
    const fileBody = Buffer.from(await response.arrayBuffer());

    await fs.writeFile(localPath, fileBody, { flag: "wx" });

    return {
      filename: file.name,
      id: file.id,
      localPath,
      provider: this.key,
      size: fileBody.length
    };
  }

  async downloadFiles(fileIds, destinationDirectory = this.downloadDirectory) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new ValidationError("No Box file IDs were supplied");
    }

    const downloaded = [];

    for (const fileId of fileIds) {
      downloaded.push(await this.downloadFile(fileId, destinationDirectory));
    }

    return downloaded;
  }

  async downloadAllFiles(destinationDirectory = this.downloadDirectory) {
    const files = await this.listFiles();

    if (files.length === 0) {
      return [];
    }

    return this.downloadFiles(
      files.map((file) => file.id),
      destinationDirectory
    );
  }

  async deleteFile(fileId) {
    this.requireConfiguration();

    const file = await this.getFileInfo(fileId);
    this.requireFileInConfiguredFolder(file);

    await this.apiClient.request(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}`,
      {
        action: `Deleting Box file ${fileId}`,
        method: "DELETE"
      }
    );

    return {
      filename: file.name,
      id: file.id,
      provider: this.key,
      removed: true
    };
  }

  async deleteFiles(fileIds) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new ValidationError("No Box file IDs were supplied");
    }

    const deleted = [];

    for (const fileId of fileIds) {
      deleted.push(await this.deleteFile(fileId));
    }

    return deleted;
  }

  async findAvailableDownloadPath(destinationDirectory, filename) {
    const safeName = path.basename(filename);
    const extension = path.extname(safeName);
    const stem = path.basename(safeName, extension);
    let candidate = path.join(destinationDirectory, safeName);
    let suffix = 1;

    while (true) {
      try {
        await fs.access(candidate);
        candidate = path.join(
          destinationDirectory,
          `${stem}-${suffix}${extension}`
        );
        suffix += 1;
      } catch (error) {
        if (error.code === "ENOENT") {
          return candidate;
        }

        throw error;
      }
    }
  }
}

module.exports = { BoxStorageProvider };
