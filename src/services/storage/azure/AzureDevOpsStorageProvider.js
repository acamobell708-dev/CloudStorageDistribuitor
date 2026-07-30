const fs = require("node:fs/promises");
const path = require("node:path");
const { constants: fsConstants } = require("node:fs");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const {
  ConfigurationError,
  ValidationError
} = require("../../../errors/ApplicationError");
const { FileNamingService } = require("../FileNamingService");
const { StorageProvider } = require("../StorageProvider");
const { UploadPathService } = require("../UploadPathService");
const { AzureDevOpsApiClient } = require("./AzureDevOpsApiClient");
const {
  createAzureDevOpsAuthorizationProvider
} = require("./AzureDevOpsAuthorizationProvider");
const {
  AzureGitHistoryPurgeService
} = require("./AzureGitHistoryPurgeService");

const defaultExecFileAsync = promisify(execFile);

const mediaExtensions = {
  audio: new Set([
    ".aac",
    ".aiff",
    ".alac",
    ".flac",
    ".m4a",
    ".mid",
    ".midi",
    ".mp3",
    ".oga",
    ".ogg",
    ".opus",
    ".wav",
    ".wma"
  ]),
  document: new Set([
    ".csv",
    ".doc",
    ".docx",
    ".json",
    ".md",
    ".odp",
    ".ods",
    ".odt",
    ".pdf",
    ".ppt",
    ".pptx",
    ".rtf",
    ".txt",
    ".xls",
    ".xlsx",
    ".xml"
  ]),
  image: new Set([
    ".avif",
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
    ".ico",
    ".jfif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".tif",
    ".tiff",
    ".webp"
  ]),
  source: new Set([
    ".c",
    ".cc",
    ".cpp",
    ".cs",
    ".css",
    ".dart",
    ".go",
    ".gradle",
    ".groovy",
    ".h",
    ".hpp",
    ".htm",
    ".html",
    ".java",
    ".js",
    ".jsx",
    ".kt",
    ".kts",
    ".lua",
    ".mjs",
    ".php",
    ".pl",
    ".ps1",
    ".py",
    ".r",
    ".rb",
    ".rs",
    ".sass",
    ".scala",
    ".scss",
    ".sh",
    ".sol",
    ".sql",
    ".svelte",
    ".swift",
    ".ts",
    ".tsx",
    ".vb",
    ".vue",
    ".yaml",
    ".yml"
  ]),
  video: new Set([
    ".3g2",
    ".3gp",
    ".avi",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".mts",
    ".ogv",
    ".ts",
    ".webm",
    ".wmv"
  ])
};

const mediaDirectories = {
  audio: "media/audio",
  document: "documents",
  image: "images",
  source: "source",
  video: "media/video"
};
const managedDirectoryRoots = [
  "documents",
  "folders",
  "images",
  "media",
  "source"
];

const documentMimeTypes = new Set([
  "application/json",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xml"
]);

const sourceMimeTypes = new Set([
  "application/javascript",
  "application/typescript",
  "application/x-httpd-php",
  "application/x-javascript",
  "application/x-python-code",
  "application/x-sh",
  "application/x-shellscript"
]);

class AzureDevOpsStorageProvider extends StorageProvider {
  constructor(options = {}) {
    const authorizationProvider =
      options.authorizationProvider ||
      createAzureDevOpsAuthorizationProvider({
        clientId: options.managedIdentityClientId,
        mode: options.authorizationMode,
        pat: options.pat
      });
    const purgeAuthorizationProvider =
      options.purgeAuthorizationProvider ||
      createAzureDevOpsAuthorizationProvider({
        clientId: options.purgeManagedIdentityClientId,
        configurationName: "AZURE_PURGE_PAT",
        mode:
          options.purgeAuthorizationMode ||
          options.authorizationMode,
        pat: options.purgePat
      });
    const deletionConfigured = Boolean(
      options.remote &&
        authorizationProvider.isConfigured() &&
        options.shouldPush
    );
    const permanentDeletionConfigured = Boolean(
      deletionConfigured &&
        purgeAuthorizationProvider.isConfigured()
    );

    super({
      acceptedFileTypes: [
        "image/*",
        "audio/*",
        "video/*",
        ".csv",
        ".doc",
        ".docx",
        ".json",
        ".md",
        ".odp",
        ".ods",
        ".odt",
        ".pdf",
        ".ppt",
        ".pptx",
        ".rtf",
        ".txt",
        ".xls",
        ".xlsx",
        ".xml",
        ".c",
        ".cc",
        ".cpp",
        ".cs",
        ".css",
        ".dart",
        ".go",
        ".gradle",
        ".groovy",
        ".h",
        ".hpp",
        ".htm",
        ".html",
        ".java",
        ".js",
        ".jsx",
        ".kt",
        ".kts",
        ".lua",
        ".mjs",
        ".php",
        ".pl",
        ".ps1",
        ".py",
        ".r",
        ".rb",
        ".rs",
        ".sass",
        ".scala",
        ".scss",
        ".sh",
        ".sol",
        ".sql",
        ".svelte",
        ".swift",
        ".ts",
        ".tsx",
        ".vb",
        ".vue",
        ".yaml",
        ".yml"
      ],
      description: "Versioned documents, source code, images, audio and video",
      displayName: "Azure Repos",
      key: "azure",
      maximumUploadSizeBytes:
        options.maximumUploadSizeBytes || 100 * 1024 * 1024,
      storageCapacityBytes:
        options.storageCapacityBytes || 250 * 1024 * 1024 * 1024,
      storageCapacitySource: "repository-limit",
      supportedFileActions: [
        "download",
        ...(deletionConfigured ? ["delete"] : []),
        ...(permanentDeletionConfigured
          ? ["permanent-delete"]
          : [])
      ]
    });

    this.branch = options.branch || "main";
    this.apiClient =
      options.apiClient ||
      new AzureDevOpsApiClient({
        authorizationProvider,
        branch: this.branch,
        fetch: options.fetch,
        ipv4Only: options.ipv4Only,
        remote: options.remote
      });
    this.authorizationProvider = authorizationProvider;
    this.localDataRepositoryEnabled =
      options.localDataRepositoryEnabled !== false;
    this.codeRepoRoot = options.codeRepoRoot;
    this.dataRepoRoot = this.localDataRepositoryEnabled
      ? path.resolve(options.dataRepoRoot || ".azure-data-repo")
      : undefined;
    this.execFileAsync = options.execFileAsync || defaultExecFileAsync;
    this.fileNamingService =
      options.fileNamingService || new FileNamingService();
    this.uploadPathService =
      options.uploadPathService || new UploadPathService();
    this.gitAuthorEmail =
      options.gitAuthorEmail || "media-service@localhost";
    this.gitAuthorName =
      options.gitAuthorName || "Cloud Storage Media Service";
    this.ipv4Only = Boolean(options.ipv4Only);
    this.permanentDeletionConfigured = permanentDeletionConfigured;
    this.remote = options.remote;
    this.shouldPush = Boolean(options.shouldPush);
    this.sslBackend = options.sslBackend;
    this.historyPurgeService =
      options.historyPurgeService ||
      (permanentDeletionConfigured
        ? new AzureGitHistoryPurgeService({
            authorizationProvider: purgeAuthorizationProvider,
            branch: this.branch,
            ipv4Only: this.ipv4Only,
            remote: this.remote
          })
        : undefined);
    this.dataRepositoryReady = undefined;
    this.operationQueue = Promise.resolve();

    if (
      this.localDataRepositoryEnabled &&
      this.codeRepoRoot &&
      path.resolve(this.codeRepoRoot) === this.dataRepoRoot
    ) {
      throw new ConfigurationError(
        "AZURE_DATA_REPO_DIR must not be the application repository"
      );
    }
  }

  isConfigured() {
    return Boolean(
      this.remote &&
        this.authorizationProvider.isConfigured() &&
        this.shouldPush
    );
  }

  isListingConfigured() {
    return this.apiClient.isConfigured();
  }

  getStorageLocation(filename, contentType) {
    const extension = path.extname(filename || "").toLowerCase();
    const normalizedContentType = String(contentType || "")
      .split(";")[0]
      .toLowerCase();
    const extensionCategory = Object.entries(mediaExtensions).find(
      ([, extensions]) => extensions.has(extension)
    )?.[0];

    if (!extensionCategory) {
      throw new ValidationError(
        `${filename || "The file"} is not a supported document, source code, image, audio, or video format`
      );
    }

    const mediaMimeCategory = ["image", "audio", "video"].find((category) =>
      normalizedContentType.startsWith(`${category}/`)
    );
    const mimeCategory =
      mediaMimeCategory ||
      (documentMimeTypes.has(normalizedContentType)
        ? "document"
        : sourceMimeTypes.has(normalizedContentType)
          ? "source"
          : normalizedContentType.startsWith("text/") &&
              ["document", "source"].includes(extensionCategory)
            ? extensionCategory
            : undefined);

    if (mimeCategory && mimeCategory !== extensionCategory) {
      throw new ValidationError(
        `${filename} does not match its reported ${contentType} media type`
      );
    }

    if (
      normalizedContentType &&
      normalizedContentType !== "application/octet-stream" &&
      normalizedContentType !== "application/ogg" &&
      !mimeCategory
    ) {
      throw new ValidationError(
        `Unsupported Azure file type: ${contentType}`
      );
    }

    return {
      category: extensionCategory,
      extension,
      relativeDirectory: mediaDirectories[extensionCategory]
    };
  }

  normalizeCloudFile(item) {
    const numericSize =
      item.size === undefined || item.size === null
        ? Number.NaN
        : Number(item.size);
    const modifiedAt =
      item.latestProcessedChange?.committer?.date ||
      item.latestProcessedChange?.author?.date;
    const storedName = path.posix.basename(item.path);

    return {
      contentType: item.contentMetadata?.contentType,
      id: item.objectId,
      modifiedAt,
      name: this.fileNamingService.getDisplayName(storedName),
      path: item.path,
      provider: this.key,
      ...(Number.isFinite(numericSize) ? { size: numericSize } : {}),
      storedName,
      type: "file",
      version: item.commitId,
      webUrl: this.apiClient.createFileWebUrl(item.path)
    };
  }

  async listCloudFiles() {
    const items = await this.apiClient.listRepositoryItems({
      includeSizes: true
    });

    return items
      .filter(
        (item) =>
          !item.isFolder &&
          String(item.gitObjectType || "").toLowerCase() === "blob"
      )
      .map((item) => this.normalizeCloudFile(item))
      .sort((first, second) => first.path.localeCompare(second.path));
  }

  normalizeFolderPath(folderPath) {
    const suppliedPath = String(folderPath || "/").trim();

    if (
      !suppliedPath.startsWith("/") ||
      suppliedPath.includes("\\") ||
      /[\0\r\n]/.test(suppliedPath)
    ) {
      throw new ValidationError(
        "The Azure repository folder path is not safe"
      );
    }

    const normalizedPath = path.posix.normalize(suppliedPath);

    if (
      normalizedPath !== suppliedPath.replace(/\/+$/, "") &&
      suppliedPath !== "/"
    ) {
      throw new ValidationError(
        "The Azure repository folder path is not safe"
      );
    }

    return normalizedPath;
  }

  async browseCloudFiles(folderReference = {}) {
    const folderPath = this.normalizeFolderPath(folderReference.path);
    const items = await this.apiClient.listRepositoryItems({
      includeSizes: true
    });
    const folderExists =
      folderPath === "/" ||
      items.some(
        (item) =>
          item.isFolder && item.path === folderPath
      ) ||
      items.some((item) =>
        item.path.startsWith(`${folderPath}/`)
      );

    if (!folderExists) {
      throw new ValidationError(
        "The Azure folder is no longer present on the configured branch",
        {
          code: "FOLDER_NOT_FOUND",
          statusCode: 404
        }
      );
    }

    const prefix = folderPath === "/" ? "/" : `${folderPath}/`;
    const children = new Map();

    for (const item of items) {
      if (folderPath === "/" && item.path === "/folders") {
        continue;
      }

      if (!item.path.startsWith(prefix) || item.path === folderPath) {
        continue;
      }

      const isManagedFolderItem =
        folderPath === "/" && item.path.startsWith("/folders/");
      const relativePath = isManagedFolderItem
        ? item.path.slice("/folders/".length)
        : item.path.slice(prefix.length);
      const [childName, ...remainingSegments] =
        relativePath.split("/");
      const childPath =
        isManagedFolderItem
          ? `/folders/${childName}`
          : folderPath === "/"
          ? `/${childName}`
          : `${folderPath}/${childName}`;

      if (remainingSegments.length > 0 || item.isFolder) {
        const folderItem =
          items.find(
            (candidate) =>
              candidate.isFolder && candidate.path === childPath
          ) || item;

        children.set(`folder:${childPath}`, {
          id: folderItem.objectId || childPath,
          modifiedAt:
            folderItem.latestProcessedChange?.committer?.date ||
            folderItem.latestProcessedChange?.author?.date,
          name: childName,
          path: childPath,
          provider: this.key,
          type: "folder",
          webUrl: this.apiClient.createFileWebUrl(childPath)
        });
      } else if (
        String(item.gitObjectType || "").toLowerCase() === "blob"
      ) {
        children.set(`file:${item.objectId}:${item.path}`, {
          ...this.normalizeCloudFile(item)
        });
      }
    }

    const segments = folderPath.split("/").filter(Boolean);
    const visibleSegments =
      segments[0] === "folders" ? segments.slice(1) : segments;
    const breadcrumbs = [
      {
        id: "/",
        name: this.displayName,
        path: "/"
      }
    ];
    let breadcrumbPath =
      segments[0] === "folders" ? "/folders" : "";

    for (const segment of visibleSegments) {
      breadcrumbPath += `/${segment}`;
      breadcrumbs.push({
        id: breadcrumbPath,
        name: segment,
        path: breadcrumbPath
      });
    }

    return {
      breadcrumbs,
      files: [...children.values()].sort(
        (first, second) =>
          first.type === second.type
            ? first.name.localeCompare(second.name)
            : first.type === "folder"
              ? -1
              : 1
      ),
      folder: {
        id: folderPath,
        name: visibleSegments.at(-1) || this.displayName,
        path: folderPath
      }
    };
  }

  async downloadCloudFile(fileReference) {
    const item = await this.findCurrentCloudItem(fileReference);
    const response = await this.apiClient.downloadRepositoryItem(item.path);
    const responseSizeHeader = response.headers.get("content-length");
    const responseSize =
      responseSizeHeader === null
        ? Number.NaN
        : Number(responseSizeHeader);
    const itemSize = Number(item.size);
    const storedName = path.posix.basename(item.path);

    return {
      body: response.body,
      contentType:
        response.headers.get("content-type") ||
        item.contentMetadata?.contentType ||
        "application/octet-stream",
      filename: this.fileNamingService.getDisplayName(storedName),
      id: item.objectId,
      path: item.path,
      provider: this.key,
      size: Number.isFinite(itemSize)
        ? itemSize
        : Number.isFinite(responseSize)
          ? responseSize
          : undefined
    };
  }

  async findCurrentCloudItem(fileReference) {
    const fileId = String(fileReference?.id || "").trim();
    const filePath = String(fileReference?.path || "").trim();

    if (!fileId || !filePath) {
      throw new ValidationError(
        "An Azure file ID and repository path are required"
      );
    }

    const items = await this.apiClient.listRepositoryItems();
    const item = items.find(
      (candidate) =>
        !candidate.isFolder &&
        String(candidate.gitObjectType || "").toLowerCase() === "blob" &&
        candidate.objectId === fileId &&
        candidate.path === filePath
    );

    if (!item) {
      throw new ValidationError(
        "The Azure file is no longer present on the configured branch",
        {
          code: "FILE_NOT_FOUND",
          statusCode: 404
        }
      );
    }

    return item;
  }

  async deleteFileDirectly(fileReference) {
    this.requirePushConfiguration();

    const branchReference = await this.apiClient.getBranchReference();

    if (!branchReference?.objectId) {
      throw new ValidationError(
        `The configured Azure branch ${this.branch} was not found`,
        {
          code: "BRANCH_NOT_FOUND",
          statusCode: 404
        }
      );
    }

    const item = await this.findCurrentCloudItem(fileReference);
    const storedName = path.posix.basename(item.path);
    const push = await this.apiClient.createFileDeletePush({
      comment: `Delete ${path.posix.basename(item.path)}`,
      oldObjectId: branchReference.objectId,
      path: item.path
    });
    const commit =
      push?.commits?.[0]?.commitId ||
      push?.refUpdates?.[0]?.newObjectId;

    if (!commit) {
      throw new Error(
        "Azure DevOps did not return the deletion commit"
      );
    }

    return {
      filename: this.fileNamingService.getDisplayName(storedName),
      id: item.objectId,
      path: item.path,
      provider: this.key,
      commit,
      removed: true,
      retainedInHistory: true
    };
  }

  deleteCloudFile(fileReference) {
    return this.enqueueOperation(() =>
      this.deleteFileDirectly(fileReference)
    );
  }

  normalizeManagedFolderPath(folderPath) {
    const normalizedPath = this.normalizeFolderPath(folderPath);
    const relativePath = normalizedPath.replace(/^\/+/, "");

    if (
      normalizedPath === "/" ||
      !managedDirectoryRoots.some(
        (root) =>
          relativePath === root ||
          relativePath.startsWith(`${root}/`)
      )
    ) {
      throw new ValidationError(
        "Folder deletion is limited to managed Azure storage paths"
      );
    }

    return normalizedPath;
  }

  async findCurrentCloudFolder(fileReference, items) {
    const folderId = String(fileReference?.id || "").trim();
    const folderPath = this.normalizeManagedFolderPath(
      fileReference?.path
    );

    if (!folderId) {
      throw new ValidationError(
        "An Azure folder ID and repository path are required"
      );
    }

    const repositoryItems =
      items || (await this.apiClient.listRepositoryItems());
    const folder = repositoryItems.find(
      (candidate) =>
        candidate.isFolder &&
        candidate.path === folderPath &&
        [candidate.objectId, candidate.path].includes(folderId)
    );
    const files = repositoryItems.filter(
      (candidate) =>
        !candidate.isFolder &&
        String(candidate.gitObjectType || "").toLowerCase() === "blob" &&
        candidate.path.startsWith(`${folderPath}/`)
    );

    if (!folder || files.length === 0) {
      throw new ValidationError(
        "The Azure folder is no longer present on the configured branch",
        {
          code: "FOLDER_NOT_FOUND",
          statusCode: 404
        }
      );
    }

    return {
      files,
      folder,
      path: folderPath
    };
  }

  async deleteFolderDirectly(folderReference) {
    this.requirePushConfiguration();

    const branchReference = await this.apiClient.getBranchReference();

    if (!branchReference?.objectId) {
      throw new ValidationError(
        `The configured Azure branch ${this.branch} was not found`,
        {
          code: "BRANCH_NOT_FOUND",
          statusCode: 404
        }
      );
    }

    const items = await this.apiClient.listRepositoryItems();
    const currentFolder = await this.findCurrentCloudFolder(
      folderReference,
      items
    );
    const push = await this.apiClient.createFilesDeletePush({
      comment:
        `Delete folder ${path.posix.basename(currentFolder.path)} ` +
        `(${currentFolder.files.length} files)`,
      oldObjectId: branchReference.objectId,
      paths: currentFolder.files.map((file) => file.path)
    });
    const commit =
      push?.commits?.[0]?.commitId ||
      push?.refUpdates?.[0]?.newObjectId;

    if (!commit) {
      throw new Error(
        "Azure DevOps did not return the folder deletion commit"
      );
    }

    return {
      commit,
      filename: path.posix.basename(currentFolder.path),
      id: currentFolder.folder.objectId,
      path: currentFolder.path,
      provider: this.key,
      removed: true,
      removedFileCount: currentFolder.files.length,
      retainedInHistory: true,
      type: "folder"
    };
  }

  deleteCloudFolder(folderReference) {
    return this.enqueueOperation(() =>
      this.deleteFolderDirectly(folderReference)
    );
  }

  async permanentlyDeleteFileDirectly(fileReference) {
    this.requirePushConfiguration();

    if (
      !this.permanentDeletionConfigured ||
      !this.historyPurgeService
    ) {
      throw new ConfigurationError(
        "Azure permanent deletion requires purge authorization"
      );
    }

    const item = await this.findCurrentCloudItem(fileReference);
    const storedName = path.posix.basename(item.path);
    const purge = await this.historyPurgeService.purge({
      id: item.objectId,
      path: item.path
    });

    return {
      ...purge,
      filename: this.fileNamingService.getDisplayName(storedName),
      id: item.objectId,
      path: item.path,
      provider: this.key,
      removed: true,
      removedFromHistory: true
    };
  }

  permanentlyDeleteCloudFile(fileReference) {
    return this.enqueueOperation(() =>
      this.permanentlyDeleteFileDirectly(fileReference)
    );
  }

  async uploadFileDirectly(fileOrBody, originalName, contentType) {
    const file = Buffer.isBuffer(fileOrBody)
      ? {
          body: fileOrBody,
          contentType,
          filename: originalName
        }
      : fileOrBody;
    const result = await this.uploadFilesDirectly([file]);

    return result.files[0];
  }

  async uploadFilesDirectly(files) {
    this.requirePushConfiguration();

    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError("No files were supplied");
    }

    const normalizedFiles = files.map((file) => {
      const normalized = this.normalizeFile(file);
      this.getStorageLocation(normalized.filename, normalized.contentType);
      return normalized;
    });
    const branchReference = await this.apiClient.getBranchReference();
    const remoteItems = branchReference
      ? await this.apiClient.listRepositoryItems()
      : [];
    const inventory = remoteItems
      .filter(
        (item) =>
          !item.isFolder &&
          String(item.gitObjectType || "").toLowerCase() === "blob"
      )
      .map((item) => ({
        commitId: item.commitId,
        filename: path.posix.basename(item.path),
        objectId: item.objectId,
        path: item.path,
        relativeDirectory: path.posix
          .dirname(item.path)
          .replace(/^\/+/, "")
      }));
    const preparedFiles = [];
    const changes = [];

    for (const file of normalizedFiles) {
      const location = this.getStorageLocation(
        file.filename,
        file.contentType
      );
      const uploadedDirectory =
        this.uploadPathService.getDirectory(file.relativePath);
      const relativeDirectory = uploadedDirectory
        ? `folders/${uploadedDirectory}`
        : location.relativeDirectory;
      const { filename: requestedFilename, hash } =
        await this.fileNamingService.createStoredNameForFile(file);
      const gitBlobHash =
        await this.fileNamingService.createGitBlobHash(file);
      const directoryInventory = inventory.filter(
        (item) =>
          item.relativeDirectory === relativeDirectory
      );
      const existing = directoryInventory.find(
        (item) =>
          item.filename.startsWith(`${hash}-`) ||
          String(item.objectId || "").toLowerCase() ===
            gitBlobHash.toLowerCase()
      );

      if (existing) {
        preparedFiles.push({
          commit: existing.commitId,
          duplicate: true,
          filename: existing.filename,
          hash,
          id: existing.objectId,
          originalName: file.filename,
          path: existing.path.replace(/^\/+/, ""),
          provider: this.key,
          size: file.size
        });
        continue;
      }

      const filename = this.fileNamingService.createAvailableName(
        requestedFilename,
        directoryInventory.map((item) => item.filename)
      );
      const safeFilename = `${path.basename(
        filename,
        path.extname(filename)
      )}${location.extension}`;
      const repositoryPath =
        `/${relativeDirectory}/${safeFilename}`;
      const body = Buffer.isBuffer(file.body)
        ? file.body
        : await fs.readFile(file.path);

      changes.push({
        content: body,
        path: repositoryPath
      });
      inventory.push({
        filename: safeFilename,
        objectId: gitBlobHash,
        path: repositoryPath,
        relativeDirectory
      });
      preparedFiles.push({
        duplicate: false,
        filename: safeFilename,
        hash,
        id: gitBlobHash,
        originalName: file.filename,
        path: repositoryPath.replace(/^\/+/, ""),
        provider: this.key,
        size: file.size
      });
    }

    let commit =
      branchReference?.objectId ||
      preparedFiles.find((file) => file.commit)?.commit;

    if (changes.length > 0) {
      const comment =
        changes.length === 1
          ? `Add uploaded file ${path.posix.basename(changes[0].path)}`
          : `Add ${changes.length} uploaded files`;
      const push = await this.apiClient.createFilePush({
        changes,
        comment,
        oldObjectId: branchReference?.objectId
      });

      commit =
        push?.commits?.[0]?.commitId ||
        push?.refUpdates?.[0]?.newObjectId;

      if (!commit) {
        throw new Error("Azure DevOps did not return the created commit");
      }
    }

    const completedFiles = preparedFiles.map((file) => ({
      ...file,
      commit: file.commit || commit,
      pushed: true
    }));

    return {
      commit,
      files: completedFiles,
      images: completedFiles,
      provider: this.key,
      pushed: true
    };
  }

  async runGit(argumentsList, options = {}) {
    this.requireLocalDataRepository();

    const configurationArguments = ["-c", "credential.helper="];
    const processEnvironment = {
      ...process.env,
      GCM_INTERACTIVE: "Never",
      GIT_TERMINAL_PROMPT: "0"
    };

    delete processEnvironment.GIT_ASKPASS;
    delete processEnvironment.SSH_ASKPASS;
    delete processEnvironment.VSCODE_GIT_ASKPASS_NODE;
    delete processEnvironment.VSCODE_GIT_ASKPASS_EXTRA_ARGS;
    delete processEnvironment.VSCODE_GIT_IPC_HANDLE;
    delete processEnvironment.AZURE_GIT_AUTH_HEADER;

    const authenticate =
      Boolean(options.authenticate) &&
      /^https:/i.test(this.remote || "");

    if (this.sslBackend) {
      configurationArguments.push(
        "-c",
        `http.sslBackend=${this.sslBackend}`
      );
    }

    try {
      const authorizationHeader = authenticate
        ? await this.authorizationProvider.getAuthorizationHeader()
        : undefined;

      if (authorizationHeader) {
        processEnvironment.AZURE_GIT_AUTH_HEADER =
          `Authorization: ${authorizationHeader}`;
        configurationArguments.push(
          "--config-env=http.extraheader=AZURE_GIT_AUTH_HEADER"
        );
      }

      const { stdout } = await this.execFileAsync(
        "git",
        [...configurationArguments, ...argumentsList],
        {
          cwd: this.dataRepoRoot,
          env: processEnvironment,
          windowsHide: true
        }
      );

      return stdout.trim();
    } catch (error) {
      throw new Error(error.stderr?.trim() || error.message);
    }
  }

  requireLocalDataRepository() {
    if (!this.localDataRepositoryEnabled) {
      throw new ConfigurationError(
        "The local Azure data repository is disabled for web providers"
      );
    }
  }

  toGitPath(absolutePath) {
    return path
      .relative(this.dataRepoRoot, absolutePath)
      .split(path.sep)
      .join("/");
  }

  async hasCommitHistory() {
    try {
      await this.runGit(["rev-parse", "--verify", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  }

  async fetchExistingAzureHistory() {
    if (
      !this.shouldPush ||
      !this.remote ||
      (/^https:/i.test(this.remote) &&
        !this.authorizationProvider.isConfigured())
    ) {
      return;
    }

    const fetchArguments = ["fetch"];

    if (this.ipv4Only) {
      fetchArguments.push("--ipv4");
    }

    fetchArguments.push("--depth=1", this.remote, this.branch);

    try {
      await this.runGit(fetchArguments, { authenticate: true });
      await this.runGit([
        "checkout",
        "-B",
        this.branch,
        "FETCH_HEAD"
      ]);
    } catch (error) {
      const remoteIsEmpty =
        /couldn't find remote ref|remote ref does not exist|not found/i.test(
          error.message
        );

      if (!remoteIsEmpty) {
        throw error;
      }
    }
  }

  async ensureDataRepository() {
    this.requireLocalDataRepository();

    if (!this.dataRepositoryReady) {
      this.dataRepositoryReady = (async () => {
        await fs.mkdir(this.dataRepoRoot, { recursive: true });

        try {
          await fs.access(path.join(this.dataRepoRoot, ".git"));
        } catch {
          await this.runGit(["init", "--initial-branch", this.branch]);
        }

        await this.runGit([
          "config",
          "user.name",
          this.gitAuthorName
        ]);
        await this.runGit([
          "config",
          "user.email",
          this.gitAuthorEmail
        ]);

        if (!(await this.hasCommitHistory())) {
          await this.fetchExistingAzureHistory();
        }

        for (const directory of [
          ...Object.values(mediaDirectories),
          "folders"
        ]) {
          await fs.mkdir(path.join(this.dataRepoRoot, directory), {
            recursive: true
          });
        }
      })();
    }

    return this.dataRepositoryReady;
  }

  async getStoredMediaInventory(relativeDirectory) {
    this.requireLocalDataRepository();

    const directory = path.join(this.dataRepoRoot, relativeDirectory);
    const inventory = new Map();

    try {
      const filenames = await fs.readdir(directory);

      for (const filename of filenames) {
        inventory.set(filename.toLowerCase(), {
          filename,
          localPath: path.join(directory, filename),
          path: `${relativeDirectory}/${filename}`
        });
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    if (this.shouldPush && this.apiClient.isConfigured?.()) {
      const remoteItems = await this.apiClient.listRepositoryItems();
      const directoryPrefix = `/${relativeDirectory}/`;

      for (const item of remoteItems) {
        if (
          item.isFolder ||
          String(item.gitObjectType || "").toLowerCase() !== "blob" ||
          !item.path.startsWith(directoryPrefix)
        ) {
          continue;
        }

        const filename = path.posix.basename(item.path);
        const existing = inventory.get(filename.toLowerCase());

        inventory.set(filename.toLowerCase(), {
          ...existing,
          commitId: item.commitId,
          filename,
          objectId: item.objectId,
          path: item.path.replace(/^\/+/, "")
        });
      }
    }

    return [...inventory.values()];
  }

  async findExistingMedia({
    gitBlobHash,
    hash,
    relativeDirectory
  }) {
    const inventory =
      await this.getStoredMediaInventory(relativeDirectory);
    let existing = inventory.find(
      (item) =>
        item.filename.startsWith(`${hash}-`) ||
        (item.objectId &&
          item.objectId.toLowerCase() === gitBlobHash.toLowerCase())
    );

    if (!existing) {
      for (const item of inventory) {
        if (!item.localPath) {
          continue;
        }

        const localHash = await this.fileNamingService.hashFile(
          item.localPath,
          "sha256",
          "hex"
        );

        if (localHash === hash) {
          existing = item;
          break;
        }
      }
    }

    return {
      existing,
      inventory
    };
  }

  async isTrackedInHead(relativePath) {
    if (!(await this.hasCommitHistory())) {
      return false;
    }

    const trackedPath = await this.runGit([
      "ls-tree",
      "--name-only",
      "HEAD",
      "--",
      relativePath
    ]);

    return trackedPath === relativePath;
  }

  requirePushConfiguration() {
    const missing = [];

    if (!this.remote) {
      missing.push("AZURE_GIT_REMOTE");
    }

    if (
      /^https:/i.test(this.remote || "") &&
      !this.authorizationProvider.isConfigured()
    ) {
      missing.push(
        this.authorizationProvider.getMissingConfigurationName()
      );
    }

    if (!this.shouldPush) {
      missing.push("AZURE_GIT_PUSH=true");
    }

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Missing Azure push configuration: ${missing.join(", ")}`
      );
    }
  }

  async pushCurrentHead() {
    this.requirePushConfiguration();

    const pushArguments = ["push"];

    if (this.ipv4Only) {
      pushArguments.push("--ipv4");
    }

    pushArguments.push(this.remote, `HEAD:${this.branch}`);
    await this.runGit(pushArguments, { authenticate: true });
  }

  async pushStoredMedia(storedFiles) {
    this.requirePushConfiguration();

    const newFiles = storedFiles.filter((file) => !file.duplicate);

    if (newFiles.length === 0) {
      return (
        storedFiles.find((file) => file.commit)?.commit ||
        this.runGit(["rev-parse", "HEAD"])
      );
    }

    const pathsToCommit = new Set();

    for (const file of newFiles) {
      if (!(await this.isTrackedInHead(file.path))) {
        pathsToCommit.add(file.path);
      }
    }

    const uniquePaths = [...pathsToCommit];

    if (uniquePaths.length > 0) {
      await this.runGit(["add", "--", ...uniquePaths]);

      const message =
        uniquePaths.length === 1
          ? `Add uploaded media ${path.basename(uniquePaths[0])}`
          : `Add ${uniquePaths.length} uploaded media files`;

      await this.runGit([
        "commit",
        "--only",
        "-m",
        message,
        "--",
        ...uniquePaths
      ]);
    }

    const commit = await this.runGit(["rev-parse", "HEAD"]);
    await this.pushCurrentHead();
    return commit;
  }

  async storeMediaFile(file) {
    this.requireLocalDataRepository();

    const mediaLocation = this.getStorageLocation(
      file.filename,
      file.contentType
    );
    const { filename: requestedFilename, hash } =
      await this.fileNamingService.createStoredNameForFile(file);
    const gitBlobHash =
      await this.fileNamingService.createGitBlobHash(file);
    const { existing, inventory } = await this.findExistingMedia({
      gitBlobHash,
      hash,
      relativeDirectory: mediaLocation.relativeDirectory
    });

    if (existing) {
      return {
        commit: existing.commitId,
        duplicate: true,
        filename: existing.filename,
        hash,
        path: existing.path
      };
    }

    const filename = this.fileNamingService.createAvailableName(
      requestedFilename,
      inventory.map((item) => item.filename)
    );
    const safeFilename = `${path.basename(
      filename,
      path.extname(filename)
    )}${mediaLocation.extension}`;
    const absolutePath = path.join(
      this.dataRepoRoot,
      mediaLocation.relativeDirectory,
      safeFilename
    );
    const relativePath = this.toGitPath(absolutePath);

    if (Buffer.isBuffer(file.body)) {
      await fs.writeFile(absolutePath, file.body, { flag: "wx" });
    } else {
      await fs.copyFile(
        file.path,
        absolutePath,
        fsConstants.COPYFILE_EXCL
      );
    }

    return {
      duplicate: false,
      filename: safeFilename,
      hash,
      path: relativePath
    };
  }

  async saveAndOptionallyPushFiles(files) {
    this.requireLocalDataRepository();

    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError("No files were supplied");
    }

    const normalizedFiles = files.map((file) => {
      const normalized = this.normalizeFile(file);
      this.getStorageLocation(normalized.filename, normalized.contentType);
      return normalized;
    });

    await this.ensureDataRepository();

    const storedFiles = [];

    for (const file of normalizedFiles) {
      const stored = await this.storeMediaFile(file);
      storedFiles.push({
        ...stored,
        originalName: file.filename,
        provider: this.key,
        size: file.size
      });
    }

    if (!this.shouldPush) {
      const completedFiles = storedFiles.map((file) => ({
        ...file,
        pushed: false
      }));

      return {
        files: completedFiles,
        images: completedFiles,
        provider: this.key,
        pushed: false
      };
    }

    const commit = await this.pushStoredMedia(storedFiles);
    const completedFiles = storedFiles.map((file) => ({
      ...file,
      commit,
      pushed: true
    }));

    return {
      commit,
      files: completedFiles,
      images: completedFiles,
      provider: this.key,
      pushed: true
    };
  }

  async saveAndOptionallyPushFile(
    fileOrBody,
    originalName,
    contentType
  ) {
    const file = Buffer.isBuffer(fileOrBody)
      ? {
          body: fileOrBody,
          contentType,
          filename: originalName
        }
      : fileOrBody;
    const result = await this.saveAndOptionallyPushFiles([file]);

    return result.files[0];
  }

  enqueueOperation(operation) {
    const job = this.operationQueue.then(operation);
    this.operationQueue = job.catch(() => undefined);
    return job;
  }

  uploadFile(...argumentsList) {
    return this.enqueueOperation(() =>
      this.uploadFileDirectly(...argumentsList)
    );
  }

  uploadFiles(files) {
    return this.enqueueOperation(() =>
      this.uploadFilesDirectly(files)
    );
  }

  async removeLastCommitMedia() {
    this.requirePushConfiguration();
    await this.ensureDataRepository();

    if (!(await this.hasCommitHistory())) {
      throw new ValidationError(
        "The Azure data repository has no commits"
      );
    }

    const sourceCommit = await this.runGit(["rev-parse", "HEAD"]);
    const output = await this.runGit([
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-only",
      "--diff-filter=A",
      "-r",
      "HEAD",
      "--",
      "documents/",
      "folders/",
      "images/",
      "media/",
      "source/"
    ]);
    const mediaPaths = output
      .split(/\r?\n/)
      .filter(
        (item) =>
          item.startsWith("documents/") ||
          item.startsWith("folders/") ||
          item.startsWith("images/") ||
          item.startsWith("media/") ||
          item.startsWith("source/")
      );

    if (mediaPaths.length === 0) {
      throw new ValidationError(
        "The last commit did not add any media files"
      );
    }

    await this.runGit(["rm", "--", ...mediaPaths]);
    await this.runGit([
      "commit",
      "--only",
      "-m",
      `Remove media added by ${sourceCommit.slice(0, 7)}`,
      "--",
      ...mediaPaths
    ]);

    const commit = await this.runGit(["rev-parse", "HEAD"]);
    await this.pushCurrentHead();

    return {
      commit,
      removed: mediaPaths,
      sourceCommit
    };
  }

  removeMediaFromLastCommit() {
    const job = this.operationQueue.then(() =>
      this.removeLastCommitMedia()
    );

    this.operationQueue = job.catch(() => undefined);
    return job;
  }
}

module.exports = {
  AzureDevOpsStorageProvider
};
