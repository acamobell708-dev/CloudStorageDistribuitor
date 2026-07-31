const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {
  ConfigurationError,
  ValidationError
} = require("../../../errors/ApplicationError");
const { FileNamingService } = require("../FileNamingService");
const { StorageProvider } = require("../StorageProvider");
const { UploadPathService } = require("../UploadPathService");
const { BoxApiClient } = require("./BoxApiClient");
const { BoxAuthClient } = require("./BoxAuthClient");

const boxEventActions = Object.freeze({
  DELETE: "delete",
  DOWNLOAD: "download",
  ITEM_DOWNLOAD: "download",
  ITEM_TRASH: "delete",
  ITEM_UPLOAD: "upload",
  UPLOAD: "upload"
});

class BoxStorageProvider extends StorageProvider {
  constructor(options = {}) {
    super({
      acceptedFileTypes: ["*/*"],
      description: "General files and media",
      displayName: "Box",
      key: "box",
      maximumUploadSizeBytes:
        options.maximumUploadSizeBytes || 250 * 1024 * 1024,
      supportedFileActions: ["download", "delete"]
    });

    this.directUploadMaximumSizeBytes =
      options.directUploadMaximumSizeBytes || 50 * 1024 * 1024;
    this.folderId = options.folderId;
    this.downloadDirectory = options.downloadDirectory;
    this.fileNamingService =
      options.fileNamingService || new FileNamingService();
    this.uploadPathService =
      options.uploadPathService || new UploadPathService();
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
    this.accountStorageDetails = undefined;
    this.accountStorageDetailsPromise = undefined;
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

  async getMaximumUploadSizeBytes() {
    if (!this.isConfigured()) {
      return this.maximumUploadSizeBytes;
    }

    if (this.accountMaximumUploadSizeBytes) {
      return this.accountMaximumUploadSizeBytes;
    }

    const accountDetails = await this.getAccountStorageDetails();
    return accountDetails.maximumUploadSizeBytes;
  }

  async listActivityEvents(options = {}) {
    this.requireConfiguration();

    const days = Math.min(31, Math.max(7, Number(options.days) || 14));
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const query = new URLSearchParams({
      limit: "500",
      stream_position: "0",
      stream_type: "all"
    });
    const result = await this.apiClient.requestJson(
      `${this.apiClient.apiUrl}/events?${query}`,
      { action: "Reading Box activity history" }
    );

    return (result?.entries || [])
      .map((event) => this.toActivityEvent(event))
      .filter(
        (event) =>
          event && new Date(event.occurredAt).getTime() >= startTime
      );
  }

  toActivityEvent(event) {
    const action = boxEventActions[event?.event_type];
    const source = event?.source;

    if (!action || !source || !this.isItemInConfiguredFolder(source)) {
      return undefined;
    }

    const occurredAt = event.created_at || event.recorded_at;
    const timestamp = new Date(occurredAt).getTime();

    if (Number.isNaN(timestamp)) {
      return undefined;
    }

    const pathEntries = source.path_collection?.entries || [];
    const path = pathEntries
      .map((entry) => entry.name)
      .filter(Boolean)
      .join("/");

    return {
      action,
      file: {
        id: source.id,
        name: source.name,
        path: path ? `/${path}/${source.name || "Item"}` : "",
        size: source.size,
        type: source.type
      },
      occurredAt,
      provider: {
        displayName: this.displayName,
        key: this.key
      },
      user: {
        displayName: event.created_by?.name || event.created_by?.login,
        id: event.created_by?.id
      }
    };
  }

  isItemInConfiguredFolder(item) {
    const folderId = String(this.folderId);

    if (String(item?.parent?.id || "") === folderId) {
      return true;
    }

    return (item?.path_collection?.entries || []).some(
      (entry) => String(entry.id || "") === folderId
    );
  }

  async getAccountStorageDetails() {
    if (this.accountStorageDetails) {
      return this.accountStorageDetails;
    }

    if (!this.accountStorageDetailsPromise) {
      this.accountStorageDetailsPromise = this.loadAccountStorageDetails();
    }

    try {
      return await this.accountStorageDetailsPromise;
    } catch (error) {
      this.accountStorageDetailsPromise = undefined;
      throw error;
    }
  }

  async loadAccountStorageDetails() {
    const user = await this.apiClient.requestJson(
      `${this.apiClient.apiUrl}/users/me?fields=` +
        "max_upload_size,space_amount,space_used",
      { action: "Reading Box account storage details" }
    );
    const accountLimit = Number(user?.max_upload_size);

    if (!Number.isFinite(accountLimit) || accountLimit <= 0) {
      throw new Error("Box did not return a valid maximum upload size");
    }

    this.accountMaximumUploadSizeBytes = accountLimit;
    this.maximumUploadSizeBytes = accountLimit;
    this.accountStorageDetails = {
      capacityBytes:
        Number.isFinite(Number(user?.space_amount)) &&
        Number(user.space_amount) > 0
          ? Number(user.space_amount)
          : undefined,
      maximumUploadSizeBytes: accountLimit,
      usedBytes:
        Number.isFinite(Number(user?.space_used)) &&
        Number(user.space_used) >= 0
          ? Number(user.space_used)
          : undefined
    };

    return this.accountStorageDetails;
  }

  async getStorageCapacity() {
    if (!this.isConfigured()) {
      return super.getStorageCapacity();
    }

    const accountDetails = await this.getAccountStorageDetails();

    return {
      capacityBytes: accountDetails.capacityBytes,
      source: "provider-account",
      usedBytes: accountDetails.usedBytes
    };
  }

  async listFolderItems(folderId = this.folderId) {
    this.requireConfiguration();

    const items = [];
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
          `${encodeURIComponent(folderId)}/items?${query}`,
        {
          action: "Listing files in the configured Box folder"
        }
      );

      items.push(...(result?.entries || []));

      marker = result?.next_marker || undefined;
    } while (marker);

    return items;
  }

  async listFiles(folderId = this.folderId) {
    return (await this.listFolderItems(folderId)).filter(
      (entry) => entry.type === "file"
    );
  }

  normalizeCloudFile(file, folderPath = "") {
    const normalizedFolderPath = String(folderPath || "").replace(
      /\/+$/,
      ""
    );

    return {
      id: file.id,
      modifiedAt: file.modified_at,
      name: this.fileNamingService.getDisplayName(file.name),
      path: `${normalizedFolderPath}/${file.name}`,
      provider: this.key,
      sha1: file.sha1,
      size: Number(file.size) || 0,
      storedName: file.name,
      type: "file",
      version: file.file_version?.id,
      webUrl: `https://app.box.com/file/${encodeURIComponent(file.id)}`
    };
  }

  async listCloudFiles() {
    this.requireConfiguration();

    const files = [];
    const folders = [
      {
        id: this.folderId,
        path: ""
      }
    ];
    const visited = new Set();

    while (folders.length > 0) {
      const folder = folders.shift();

      if (visited.has(String(folder.id))) {
        continue;
      }

      visited.add(String(folder.id));

      for (const item of await this.listFolderItems(folder.id)) {
        if (item.type === "folder") {
          folders.push({
            id: item.id,
            path: `${folder.path}/${item.name}`
          });
        } else if (item.type === "file") {
          files.push(this.normalizeCloudFile(item, folder.path));
        }
      }
    }

    return files.sort((first, second) =>
      first.path.localeCompare(second.path)
    );
  }

  async getFolderInfo(folderId) {
    this.requireConfiguration();

    if (!folderId) {
      throw new ValidationError("A Box folder ID is required");
    }

    const query = new URLSearchParams({
      fields: "id,type,name,etag,modified_at,parent,path_collection"
    });

    return this.apiClient.requestJson(
      `${this.apiClient.apiUrl}/folders/` +
        `${encodeURIComponent(folderId)}?${query}`,
      { action: `Reading Box folder ${folderId}` }
    );
  }

  isInsideConfiguredFolder(item) {
    if (String(item?.id) === String(this.folderId)) {
      return true;
    }

    if (String(item?.parent?.id) === String(this.folderId)) {
      return true;
    }

    return (item?.path_collection?.entries || []).some(
      (entry) => String(entry.id) === String(this.folderId)
    );
  }

  requireItemInConfiguredFolder(item) {
    if (!this.isInsideConfiguredFolder(item)) {
      throw new ValidationError(
        `Box item ${item?.id} is not inside the configured folder`
      );
    }
  }

  getFolderNavigation(folder) {
    if (String(folder.id) === String(this.folderId)) {
      return {
        breadcrumbs: [
          {
            id: this.folderId,
            name: this.displayName,
            path: "/"
          }
        ],
        path: "/"
      };
    }

    const ancestry = folder.path_collection?.entries || [];
    const rootIndex = ancestry.findIndex(
      (entry) => String(entry.id) === String(this.folderId)
    );
    const descendants =
      rootIndex === -1 ? [] : ancestry.slice(rootIndex + 1);
    const navigationEntries = [
      {
        id: this.folderId,
        name: this.displayName,
        path: "/"
      }
    ];
    let currentPath = "";

    for (const entry of [...descendants, folder]) {
      currentPath += `/${entry.name}`;
      navigationEntries.push({
        id: entry.id,
        name: entry.name,
        path: currentPath
      });
    }

    return {
      breadcrumbs: navigationEntries,
      path: currentPath || "/"
    };
  }

  async browseCloudFiles(folderReference = {}) {
    const folderId = String(
      folderReference.id || this.folderId
    ).trim();
    const folder =
      folderId === String(this.folderId)
        ? {
            id: this.folderId,
            name: this.displayName,
            type: "folder"
          }
        : await this.getFolderInfo(folderId);

    this.requireItemInConfiguredFolder(folder);

    const navigation = this.getFolderNavigation(folder);
    const items = (await this.listFolderItems(folderId))
      .filter((item) => ["file", "folder"].includes(item.type))
      .map((item) =>
        item.type === "folder"
          ? {
              id: item.id,
              modifiedAt: item.modified_at,
              name: item.name,
              path:
                navigation.path === "/"
                  ? `/${item.name}`
                  : `${navigation.path}/${item.name}`,
              provider: this.key,
              type: "folder",
              webUrl:
                `https://app.box.com/folder/` +
                encodeURIComponent(item.id)
            }
          : this.normalizeCloudFile(
              item,
              navigation.path === "/" ? "" : navigation.path
            )
      )
      .sort(
        (first, second) =>
          (first.type === second.type
            ? first.name.localeCompare(second.name)
            : first.type === "folder"
              ? -1
              : 1)
      );

    return {
      breadcrumbs: navigation.breadcrumbs,
      files: items,
      folder: {
        id: folder.id,
        name: folder.name,
        path: navigation.path
      }
    };
  }

  async downloadCloudFile(fileReference) {
    const fileId = String(fileReference?.id || "").trim();
    const file = await this.getFileInfo(fileId);
    this.requireItemInConfiguredFolder(file);

    const response = await this.apiClient.request(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}/content`,
      {
        action: `Downloading Box file ${fileId}`,
        ...(fileReference.range
          ? {
              headers: {
                Range: fileReference.range
              }
            }
          : {})
      }
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
      acceptRanges: response.headers.get("accept-ranges"),
      contentRange: response.headers.get("content-range"),
      filename: this.fileNamingService.getDisplayName(file.name),
      id: file.id,
      provider: this.key,
      responseSize: Number.isFinite(responseSize)
        ? responseSize
        : undefined,
      size: Number.isFinite(fileSize)
        ? fileSize
        : Number.isFinite(responseSize)
          ? responseSize
          : undefined,
      status: response.status
    };
  }

  async getFileInfo(fileId) {
    this.requireConfiguration();

    if (!fileId) {
      throw new ValidationError("A Box file ID is required");
    }

    const query = new URLSearchParams({
      fields:
        "id,type,name,size,sha1,etag,modified_at,parent,path_collection"
    });

    return this.apiClient.requestJson(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}?${query}`,
      { action: `Reading Box file ${fileId}` }
    );
  }

  async uploadFile(fileOrBody, originalName, contentType) {
    return this.uploadFileToFolder(
      fileOrBody,
      this.folderId,
      originalName,
      contentType
    );
  }

  async uploadFileToFolder(
    fileOrBody,
    folderId,
    originalName,
    contentType,
    folderPath = ""
  ) {
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
    const currentFiles = await this.listFiles(folderId);
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
        path: `${folderPath}/${existing.name}`.replace(/^\/?/, "/"),
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
        ? await this.uploadChunkedFile(file, filename, folderId)
        : await this.uploadDirectFile(file, filename, folderId);

    return {
      duplicate: false,
      filename: uploaded.name,
      hash,
      id: uploaded.id,
      originalName: file.filename,
      path: `${folderPath}/${uploaded.name}`.replace(/^\/?/, "/"),
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

  async uploadDirectFile(file, filename, folderId = this.folderId) {
    const fileBody = file.body || (await fs.readFile(file.path));
    const form = new FormData();

    // Box requires attributes to appear before the file in multipart data.
    form.append(
      "attributes",
      JSON.stringify({
        name: filename,
        parent: {
          id: folderId
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

  async uploadChunkedFile(file, filename, folderId = this.folderId) {
    let session;

    try {
      session = await this.apiClient.requestJson(
        `${this.apiClient.uploadUrl}/files/upload_sessions`,
        {
          action: `Starting the chunked upload for ${file.filename}`,
          body: JSON.stringify({
            file_name: filename,
            file_size: file.size,
            folder_id: folderId
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
    const folderCache = new Map([["", this.folderId]]);

    for (const file of files) {
      const relativeDirectory = this.uploadPathService.getDirectory(
        file.relativePath
      );
      const folderId = await this.ensureFolderPath(
        relativeDirectory,
        folderCache
      );

      uploadedFiles.push(
        await this.uploadFileToFolder(
          file,
          folderId,
          undefined,
          undefined,
          relativeDirectory
            ? `/${relativeDirectory}`
            : ""
        )
      );
    }

    return {
      files: uploadedFiles,
      images: uploadedFiles,
      provider: this.key,
      pushed: true
    };
  }

  async ensureFolderPath(relativeDirectory, folderCache) {
    if (!relativeDirectory) {
      return this.folderId;
    }

    const segments = relativeDirectory.split("/");
    let parentId = this.folderId;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath
        ? `${currentPath}/${segment}`
        : segment;

      if (folderCache.has(currentPath)) {
        parentId = folderCache.get(currentPath);
        continue;
      }

      const existing = (await this.listFolderItems(parentId)).find(
        (item) =>
          item.type === "folder" &&
          item.name.localeCompare(segment, undefined, {
            sensitivity: "accent"
          }) === 0
      );
      let folder = existing;

      if (!folder) {
        folder = await this.apiClient.requestJson(
          `${this.apiClient.apiUrl}/folders`,
          {
            action: `Creating Box folder ${segment}`,
            body: JSON.stringify({
              name: segment,
              parent: {
                id: parentId
              }
            }),
            headers: {
              "Content-Type": "application/json"
            },
            method: "POST"
          }
        );
      }

      if (!folder?.id) {
        throw new Error(`Box did not return folder ${segment}`);
      }

      parentId = folder.id;
      folderCache.set(currentPath, parentId);
    }

    return parentId;
  }

  async downloadFile(fileId, destinationDirectory = this.downloadDirectory) {
    this.requireConfiguration();

    if (!destinationDirectory) {
      throw new ValidationError("A download directory is required");
    }

    const file = await this.getFileInfo(fileId);
    this.requireItemInConfiguredFolder(file);

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
    this.requireItemInConfiguredFolder(file);

    await this.apiClient.request(
      `${this.apiClient.apiUrl}/files/${encodeURIComponent(fileId)}`,
      {
        action: `Deleting Box file ${fileId}`,
        ...(file.etag
          ? {
              headers: {
                "If-Match": file.etag
              }
            }
          : {}),
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

  async deleteCloudFile(fileReference) {
    return this.deleteFile(fileReference?.id);
  }

  async deleteFolder(folderId) {
    this.requireConfiguration();

    const normalizedFolderId = String(folderId || "").trim();

    if (!normalizedFolderId) {
      throw new ValidationError("A Box folder ID is required");
    }

    if (normalizedFolderId === String(this.folderId)) {
      throw new ValidationError(
        "The configured Box root folder cannot be deleted"
      );
    }

    const folder = await this.getFolderInfo(normalizedFolderId);
    this.requireItemInConfiguredFolder(folder);
    const query = new URLSearchParams({
      recursive: "true"
    });

    await this.apiClient.request(
      `${this.apiClient.apiUrl}/folders/` +
        `${encodeURIComponent(normalizedFolderId)}?${query}`,
      {
        action: `Deleting Box folder ${normalizedFolderId}`,
        ...(folder.etag
          ? {
              headers: {
                "If-Match": folder.etag
              }
            }
          : {}),
        method: "DELETE"
      }
    );

    return {
      filename: folder.name,
      id: folder.id,
      provider: this.key,
      removed: true,
      type: "folder"
    };
  }

  async deleteCloudFolder(folderReference) {
    return this.deleteFolder(folderReference?.id);
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
