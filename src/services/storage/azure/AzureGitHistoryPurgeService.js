const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const {
  ConfigurationError,
  ExternalServiceError,
  ValidationError
} = require("../../../errors/ApplicationError");
const {
  createAzureDevOpsAuthorizationProvider
} = require("./AzureDevOpsAuthorizationProvider");

const defaultExecFileAsync = promisify(execFile);
const managedPathPrefixes = [
  "documents/",
  "folders/",
  "images/",
  "media/",
  "source/"
];

class AzureGitHistoryPurgeService {
  constructor(options = {}) {
    this.branch = options.branch || "main";
    this.authorizationProvider =
      options.authorizationProvider ||
      createAzureDevOpsAuthorizationProvider({
        clientId: options.purgeManagedIdentityClientId,
        configurationName: "AZURE_PURGE_PAT",
        mode:
          options.purgeAuthorizationMode ||
          options.authorizationMode,
        pat: options.purgePat
      });
    this.execFileAsync = options.execFileAsync || defaultExecFileAsync;
    this.ipv4Only = Boolean(options.ipv4Only);
    this.remote = options.remote;
    this.temporaryRoot = options.temporaryRoot || os.tmpdir();
  }

  requireConfiguration() {
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

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Missing Azure history-purge configuration: ${missing.join(", ")}`
      );
    }
  }

  normalizeManagedPath(filePath) {
    const suppliedPath = String(filePath || "").trim();

    if (
      !suppliedPath ||
      suppliedPath.includes("\0") ||
      suppliedPath.includes("\r") ||
      suppliedPath.includes("\n") ||
      suppliedPath.includes("\\")
    ) {
      throw new ValidationError(
        "The Azure repository path is not safe to purge"
      );
    }

    const relativePath = suppliedPath.replace(/^\/+/, "");
    const normalizedPath = path.posix.normalize(relativePath);

    if (
      normalizedPath !== relativePath ||
      normalizedPath.startsWith("../") ||
      !managedPathPrefixes.some((prefix) =>
        normalizedPath.startsWith(prefix)
      )
    ) {
      throw new ValidationError(
        "Permanent deletion is limited to managed Azure storage paths"
      );
    }

    return normalizedPath;
  }

  createProcessEnvironment(
    additions = {},
    authorizationHeader
  ) {
    const processEnvironment = {
      ...process.env,
      ...additions,
      GCM_INTERACTIVE: "Never",
      GIT_TERMINAL_PROMPT: "0"
    };

    delete processEnvironment.GIT_ASKPASS;
    delete processEnvironment.SSH_ASKPASS;
    delete processEnvironment.VSCODE_GIT_ASKPASS_NODE;
    delete processEnvironment.VSCODE_GIT_ASKPASS_EXTRA_ARGS;
    delete processEnvironment.VSCODE_GIT_IPC_HANDLE;
    delete processEnvironment.AZURE_PURGE_AUTH_HEADER;

    if (authorizationHeader) {
      processEnvironment.AZURE_PURGE_AUTH_HEADER =
        `Authorization: ${authorizationHeader}`;
    }

    return processEnvironment;
  }

  async runGit(cwd, argumentsList, options = {}) {
    const configurationArguments = ["-c", "credential.helper="];
    const authenticate =
      Boolean(options.authenticate) &&
      /^https:/i.test(this.remote || "");

    try {
      const authorizationHeader = authenticate
        ? await this.authorizationProvider.getAuthorizationHeader()
        : undefined;

      if (authorizationHeader) {
        configurationArguments.push(
          "--config-env=http.extraheader=AZURE_PURGE_AUTH_HEADER"
        );
      }

      const { stdout } = await this.execFileAsync(
        "git",
        [...configurationArguments, ...argumentsList],
        {
          cwd,
          env: this.createProcessEnvironment(
            options.environment,
            authorizationHeader
          ),
          maxBuffer: 20 * 1024 * 1024,
          windowsHide: true
        }
      );

      return stdout.trim();
    } catch (error) {
      throw new ExternalServiceError(
        options.action || "The Azure history-rewrite operation failed",
        {
          cause: error,
          details: {
            gitMessage: String(error.stderr || error.message)
              .trim()
              .slice(0, 500)
          }
        }
      );
    }
  }

  async cloneMirror(destination, action) {
    const argumentsList = ["clone"];

    if (this.ipv4Only) {
      argumentsList.push("--ipv4");
    }

    argumentsList.push("--mirror", this.remote, destination);
    await this.runGit(this.temporaryRoot, argumentsList, {
      action,
      authenticate: true
    });
  }

  async listReferences(repositoryDirectory) {
    const output = await this.runGit(repositoryDirectory, [
      "for-each-ref",
      "--format=%(refname)\t%(objectname)",
      "refs/"
    ]);

    if (!output) {
      return [];
    }

    return output.split(/\r?\n/).map((line) => {
      const separatorIndex = line.indexOf("\t");

      return {
        name: line.slice(0, separatorIndex),
        objectId: line.slice(separatorIndex + 1)
      };
    });
  }

  requireSingleManagedBranch(references) {
    const branchReferenceName = `refs/heads/${this.branch}`;
    const unexpectedReferences = references.filter(
      (reference) => reference.name !== branchReferenceName
    );
    const branchReference = references.find(
      (reference) => reference.name === branchReferenceName
    );

    if (!branchReference || unexpectedReferences.length > 0) {
      throw new ValidationError(
        "Permanent deletion requires the Azure storage repository to " +
          "contain only its configured branch and no tags or other refs",
        {
          code: "UNSAFE_REPOSITORY_REFERENCES",
          details: {
            configuredBranch: branchReferenceName,
            unexpectedReferences: unexpectedReferences.map(
              (reference) => reference.name
            )
          },
          statusCode: 409
        }
      );
    }

    return branchReference;
  }

  quoteForShell(value) {
    return `'${value.replace(/'/g, "'\"'\"'")}'`;
  }

  outputContainsObject(output, objectId) {
    return output
      .split(/\r?\n/)
      .some(
        (line) =>
          line === objectId || line.startsWith(`${objectId} `)
      );
  }

  async verifyPurgedHistory(
    repositoryDirectory,
    relativePath,
    objectId
  ) {
    const pathHistory = await this.runGit(repositoryDirectory, [
      "log",
      "--all",
      "--format=%H",
      "--",
      relativePath
    ]);

    if (pathHistory) {
      throw new ValidationError(
        "The selected path is still reachable from repository history",
        {
          code: "PURGE_VERIFICATION_FAILED",
          statusCode: 409
        }
      );
    }

    const reachableObjects = await this.runGit(repositoryDirectory, [
      "rev-list",
      "--objects",
      "--all"
    ]);

    if (this.outputContainsObject(reachableObjects, objectId)) {
      throw new ValidationError(
        "The same file data is still referenced by another repository path",
        {
          code: "FILE_DATA_STILL_REFERENCED",
          statusCode: 409
        }
      );
    }
  }

  async removeOriginalReferences(repositoryDirectory) {
    const output = await this.runGit(repositoryDirectory, [
      "for-each-ref",
      "--format=%(refname)",
      "refs/original/"
    ]);

    for (const referenceName of output.split(/\r?\n/).filter(Boolean)) {
      await this.runGit(repositoryDirectory, [
        "update-ref",
        "-d",
        referenceName
      ]);
    }
  }

  async forcePushBranch(
    repositoryDirectory,
    oldObjectId,
    newObjectId
  ) {
    const referenceName = `refs/heads/${this.branch}`;
    const argumentsList = ["push"];

    await this.runGit(repositoryDirectory, [
      "config",
      "remote.origin.mirror",
      "false"
    ]);

    if (this.ipv4Only) {
      argumentsList.push("--ipv4");
    }

    argumentsList.push(
      `--force-with-lease=${referenceName}:${oldObjectId}`,
      "origin",
      `${newObjectId}:${referenceName}`
    );

    await this.runGit(repositoryDirectory, argumentsList, {
      action:
        "Azure rejected the history rewrite. The repository may have " +
        "changed while permanent deletion was running.",
      authenticate: true
    });
  }

  async purge(fileReference = {}) {
    this.requireConfiguration();

    const objectId = String(fileReference.id || "").trim();
    const relativePath = this.normalizeManagedPath(fileReference.path);

    if (!/^[a-f0-9]{40,64}$/i.test(objectId)) {
      throw new ValidationError(
        "A valid Azure Git blob ID is required for permanent deletion"
      );
    }

    const temporaryDirectory = await fs.mkdtemp(
      path.join(this.temporaryRoot, "cloud-storage-purge-")
    );
    const repositoryDirectory = path.join(
      temporaryDirectory,
      "repository.git"
    );
    const verificationDirectory = path.join(
      temporaryDirectory,
      "verification.git"
    );

    try {
      await this.cloneMirror(
        repositoryDirectory,
        "Azure Repos could not be cloned for permanent deletion"
      );

      const originalReferences = await this.listReferences(
        repositoryDirectory
      );
      const originalBranch = this.requireSingleManagedBranch(
        originalReferences
      );
      let currentObjectId;

      try {
        currentObjectId = await this.runGit(repositoryDirectory, [
          "rev-parse",
          `${originalBranch.name}:${relativePath}`
        ]);
      } catch (error) {
        if (error.code !== "EXTERNAL_SERVICE_ERROR") {
          throw error;
        }

        throw new ValidationError(
          "The selected Azure file is no longer present on the configured branch",
          {
            code: "FILE_NOT_FOUND",
            statusCode: 404
          }
        );
      }

      if (currentObjectId !== objectId) {
        throw new ValidationError(
          "The selected Azure file changed before permanent deletion began",
          {
            code: "FILE_VERSION_CHANGED",
            statusCode: 409
          }
        );
      }

      const existingHistory = await this.runGit(repositoryDirectory, [
        "log",
        "--all",
        "--format=%H",
        "--",
        relativePath
      ]);

      if (!existingHistory) {
        throw new ValidationError(
          "The selected Azure file was not found in repository history",
          {
            code: "FILE_NOT_FOUND",
            statusCode: 404
          }
        );
      }

      const indexFilter =
        "git rm -r --cached --ignore-unmatch -- " +
        this.quoteForShell(relativePath);

      await this.runGit(
        repositoryDirectory,
        [
          "filter-branch",
          "--force",
          "--index-filter",
          indexFilter,
          "--tag-name-filter",
          "cat",
          "--",
          "--all"
        ],
        {
          action: "Git could not rewrite the selected Azure file history",
          environment: {
            FILTER_BRANCH_SQUELCH_WARNING: "1"
          }
        }
      );

      await this.removeOriginalReferences(repositoryDirectory);
      await this.verifyPurgedHistory(
        repositoryDirectory,
        relativePath,
        objectId
      );

      const rewrittenReferences = await this.listReferences(
        repositoryDirectory
      );
      const rewrittenBranch = this.requireSingleManagedBranch(
        rewrittenReferences
      );

      await this.forcePushBranch(
        repositoryDirectory,
        originalBranch.objectId,
        rewrittenBranch.objectId
      );

      await this.cloneMirror(
        verificationDirectory,
        "Azure Repos could not be cloned to verify permanent deletion"
      );
      this.requireSingleManagedBranch(
        await this.listReferences(verificationDirectory)
      );
      await this.verifyPurgedHistory(
        verificationDirectory,
        relativePath,
        objectId
      );

      return {
        branch: this.branch,
        previousCommit: originalBranch.objectId,
        rewrittenCommit: rewrittenBranch.objectId,
        verified: true
      };
    } finally {
      await fs.rm(temporaryDirectory, {
        force: true,
        recursive: true
      });
    }
  }
}

module.exports = { AzureGitHistoryPurgeService };
