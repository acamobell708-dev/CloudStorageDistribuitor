const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
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
      acceptedFileTypes: ["*/*"],
      description: "General files and media",
      displayName: "Box",
      key: "box",
      maximumUploadSizeBytes:
        options.maximumUploadSizeBytes || 250 * 1024 * 1024
    });

    this.directUploadMaximumSizeBytes =
      options.directUploadMaximumSizeBytes || 50 * 1024 * 1024;
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
    this.accountMaximumUploadSizeBytes =
      options.accountMaximumUploadSizeBytes;
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

  async getMaximumUploadSizeBytes() {
    if (!this.isConfigured()) {
      return this.maximumUploadSizeBytes;
    }

    if (this.accountMaximumUploadSizeBytes) {
      return this.accountMaximumUploadSizeBytes;
    }

    const user = await this.apiClient.requestJson(
      `${this.apiClient.apiUrl}/users/me?fields=max_upload_size`,
      { action: "Reading the Box account upload limit" }
    );
    const accountLimit = Number(user?.max_upload_size);

    if (!Number.isFinite(accountLimit) || accountLimit <= 0) {
      throw new Error("Box did not return a valid maximum upload size");
    }

    this.accountMaximumUploadSizeBytes = accountLimit;
    this.maximumUploadSizeBytes = accountLimit;
    return accountLimit;
  }

  async listFiles() {
    this.requireConfiguration();

    const files = [];
    let marker;

    do {
      const query = new URLSearchParams({
        fields:
          "id,type,name,size,sha1,modified_at,parent,file_version",
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

  async listCloudFiles() {
    const files = await this.listFiles();

    return files
      .map((file) => ({
        id: file.id,
        modifiedAt: file.modified_at,
        name: this.fileNamingService.getDisplayName(file.name),
        path: `/${file.name}`,
        provider: this.key,
        sha1: file.sha1,
        size: Number(file.size) || 0,
        storedName: file.name,
        version: file.file_version?.id,
        webUrl: `https://app.box.com/file/${encodeURIComponent(file.id)}`
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
  }

  async downloadCloudFile(fileReference) {
    const fileId = String(fileReference?.id || "").trim();
    const file = await this.getFileInfo(fileId);
    this.requireFileInConfiguredFolder(file);

    const response = await this.apiClient.request(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}/content`,
      { action: `Downloading Box file ${fileId}` }
    );
    const responseSizeHeader = response.headers.get("content-length");
    const responseSize =
      responseSizeHeader === null
        ? Number.NaN
        : Number(responseSizeHeader);
    const fileSize = Number(file.size);

    return {
      body: response.body,
      contentType:
        response.headers.get("content-type") ||
        "application/octet-stream",
      filename: this.fileNamingService.getDisplayName(file.name),
      id: file.id,
      provider: this.key,
      size: Number.isFinite(fileSize)
        ? fileSize
        : Number.isFinite(responseSize)
          ? responseSize
          : undefined
    };
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
    const maximumUploadSizeBytes = await this.getMaximumUploadSizeBytes();
    this.maximumUploadSizeBytes = maximumUploadSizeBytes;
    const file = this.normalizeFile(suppliedFile);

    const { filename: requestedFilename, hash } =
      await this.fileNamingService.createStoredNameForFile(
        file
      );
    const contentSha1 = await this.fileNamingService.hashFileContents(
      file,
      "sha1"
    );
    const currentFiles = await this.listFiles();
    const existing = currentFiles.find(
      (item) =>
        String(item.sha1 || "").toLowerCase() ===
          contentSha1.toLowerCase() ||
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
        size: existing.size,
        uploadMethod: "duplicate"
      };
    }

    const filename = this.fileNamingService.createAvailableName(
      requestedFilename,
      currentFiles.map((item) => item.name)
    );
    const uploaded =
      file.size > this.directUploadMaximumSizeBytes
        ? await this.uploadChunkedFile(file, filename)
        : await this.uploadDirectFile(file, filename);

    return {
      duplicate: false,
      filename: uploaded.name,
      hash,
      id: uploaded.id,
      originalName: file.filename,
      provider: this.key,
      pushed: true,
      sha1: uploaded.sha1,
      size: uploaded.size ?? file.size,
      uploadMethod:
        file.size > this.directUploadMaximumSizeBytes
          ? "chunked"
          : "direct"
    };
  }

  async uploadDirectFile(file, filename) {
    const fileBody = file.body || (await fs.readFile(file.path));
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
      new Blob([fileBody], {
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

    return uploaded;
  }

  async uploadChunkedFile(file, filename) {
    let session;

    try {
      session = await this.apiClient.requestJson(
        `${this.apiClient.uploadUrl}/files/upload_sessions`,
        {
          action: `Starting the chunked upload for ${file.filename}`,
          body: JSON.stringify({
            file_name: filename,
            file_size: file.size,
            folder_id: this.folderId
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        }
      );

      if (
        !session?.part_size ||
        !session?.session_endpoints?.upload_part ||
        !session?.session_endpoints?.commit
      ) {
        throw new Error("Box returned an incomplete upload session");
      }

      const parts = await this.uploadFileParts(file, session);
      const wholeFileDigest = Buffer.isBuffer(file.body)
        ? createHash("sha1").update(file.body).digest("base64")
        : await this.fileNamingService.hashFile(
            file.path,
            "sha1",
            "base64"
          );
      const committed = await this.apiClient.requestJson(
        session.session_endpoints.commit,
        {
          action: `Committing the chunked upload for ${file.filename}`,
          body: JSON.stringify({ parts }),
          headers: {
            "Content-Type": "application/json",
            Digest: `sha=${wholeFileDigest}`
          },
          method: "POST"
        }
      );
      const uploaded = committed?.entries?.[0];

      if (!uploaded) {
        throw new Error("Box did not return the committed file");
      }

      return uploaded;
    } catch (error) {
      const abortUrl = session?.session_endpoints?.abort;

      if (abortUrl) {
        try {
          await this.apiClient.request(abortUrl, {
            action: `Aborting the failed upload for ${file.filename}`,
            method: "DELETE"
          });
        } catch {
          // Preserve the original upload error.
        }
      }

      throw error;
    }
  }

  async uploadFileParts(file, session) {
    const parts = [];
    const partSize = Number(session.part_size);
    const fileHandle = file.path ? await fs.open(file.path, "r") : undefined;

    try {
      for (let offset = 0; offset < file.size; offset += partSize) {
        const size = Math.min(partSize, file.size - offset);
        let partBody;

        if (Buffer.isBuffer(file.body)) {
          partBody = file.body.subarray(offset, offset + size);
        } else {
          partBody = Buffer.allocUnsafe(size);
          const { bytesRead } = await fileHandle.read(
            partBody,
            0,
            size,
            offset
          );

          if (bytesRead !== size) {
            throw new Error(
              `Could not read the complete upload part at byte ${offset}`
            );
          }
        }

        const digest = createHash("sha1")
          .update(partBody)
          .digest("base64");
        const result = await this.apiClient.requestJson(
          session.session_endpoints.upload_part,
          {
            action: `Uploading bytes ${offset}-${offset + size - 1}`,
            body: partBody,
            headers: {
              "Content-Range":
                `bytes ${offset}-${offset + size - 1}/${file.size}`,
              "Content-Type": "application/octet-stream",
              Digest: `sha=${digest}`
            },
            method: "PUT"
          }
        );

        if (!result?.part) {
          throw new Error("Box did not acknowledge an uploaded part");
        }

        parts.push(result.part);
      }
    } finally {
      await fileHandle?.close();
    }

    return parts;
  }

  async uploadFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError("No files were supplied");
    }

    this.maximumUploadSizeBytes = await this.getMaximumUploadSizeBytes();

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
