const {
  ConfigurationError,
  ExternalServiceError
} = require("../../../errors/ApplicationError");
const dns = require("node:dns");
const {
  createAzureDevOpsAuthorizationProvider
} = require("./AzureDevOpsAuthorizationProvider");

function parseAzureRemoteUrl(remote) {
  let url;

  try {
    url = new URL(remote);
  } catch {
    throw new ConfigurationError(
      "AZURE_GIT_REMOTE must be a valid Azure Repos HTTPS URL"
    );
  }

  if (url.protocol !== "https:") {
    throw new ConfigurationError(
      "AZURE_GIT_REMOTE must use HTTPS for cloud operations"
    );
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const gitIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === "_git"
  );
  let organization;
  let project;

  if (url.hostname.toLowerCase() === "dev.azure.com") {
    if (gitIndex < 2) {
      throw new ConfigurationError(
        "AZURE_GIT_REMOTE must include its organization, project, and repository"
      );
    }

    organization = segments[0];
    project = segments[gitIndex - 1];
  } else if (url.hostname.toLowerCase().endsWith(".visualstudio.com")) {
    if (gitIndex < 1) {
      throw new ConfigurationError(
        "AZURE_GIT_REMOTE must include its project and repository"
      );
    }

    organization = url.hostname.split(".")[0];
    project = segments[gitIndex - 1];
  } else {
    throw new ConfigurationError(
      "AZURE_GIT_REMOTE must point to an Azure DevOps Services repository"
    );
  }

  const repository = segments[gitIndex + 1]?.replace(/\.git$/i, "");

  if (!organization || !project || !repository) {
    throw new ConfigurationError(
      "AZURE_GIT_REMOTE must include its organization, project, and repository"
    );
  }

  const browserUrl = new URL(url);
  browserUrl.username = "";
  browserUrl.password = "";
  browserUrl.search = "";
  browserUrl.hash = "";

  return {
    apiBaseUrl:
      `https://dev.azure.com/${encodeURIComponent(organization)}/` +
      `${encodeURIComponent(project)}/_apis/git/repositories/` +
      `${encodeURIComponent(repository)}`,
    browserUrl: browserUrl.toString().replace(/\/$/, ""),
    organization,
    project,
    repository
  };
}

class AzureDevOpsApiClient {
  constructor(options = {}) {
    this.branch = options.branch || "main";
    this.authorizationProvider =
      options.authorizationProvider ||
      createAzureDevOpsAuthorizationProvider({
        clientId: options.managedIdentityClientId,
        mode: options.authorizationMode,
        pat: options.pat
      });
    this.fetch = options.fetch || globalThis.fetch;
    this.ipv4Only = Boolean(options.ipv4Only);
    this.remote = options.remote;
    this.repositoryDetails = undefined;

    if (this.ipv4Only && !options.fetch) {
      dns.setDefaultResultOrder("ipv4first");
    }
  }

  isConfigured() {
    return Boolean(
      this.remote && this.authorizationProvider.isConfigured()
    );
  }

  requireConfiguration() {
    const missing = [];

    if (!this.remote) {
      missing.push("AZURE_GIT_REMOTE");
    }

    if (!this.authorizationProvider.isConfigured()) {
      missing.push(
        this.authorizationProvider.getMissingConfigurationName()
      );
    }

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Missing Azure cloud configuration: ${missing.join(", ")}`
      );
    }
  }

  getRepositoryDetails() {
    this.requireConfiguration();

    if (!this.repositoryDetails) {
      this.repositoryDetails = parseAzureRemoteUrl(this.remote);
    }

    return this.repositoryDetails;
  }

  async request(url, options = {}) {
    this.requireConfiguration();
    const { action, ...fetchOptions } = options;
    let response;

    try {
      const authorizationHeader =
        await this.authorizationProvider.getAuthorizationHeader();

      response = await this.fetch(url, {
        ...fetchOptions,
        headers: {
          Accept: "application/json",
          ...(fetchOptions.headers || {}),
          Authorization: authorizationHeader
        }
      });
    } catch (error) {
      throw new ExternalServiceError(
        `${action || "Azure DevOps request"} could not reach Azure DevOps`,
        { cause: error }
      );
    }

    if (!response.ok) {
      const body = await this.readResponseBody(response);
      const message =
        (typeof body === "object" && body?.message) ||
        (typeof body === "string" && body) ||
        "No response body was returned";

      throw new ExternalServiceError(
        `${action || "Azure DevOps request"} failed with Azure status ` +
          `${response.status}: ${message}`,
        {
          details: {
            azureStatus: response.status
          }
        }
      );
    }

    return response;
  }

  async requestJson(url, options = {}) {
    const response = await this.request(url, options);
    return this.readResponseBody(response);
  }

  async readResponseBody(response) {
    const text = await response.text();

    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async listRepositoryItems(options = {}) {
    const { apiBaseUrl } = this.getRepositoryDetails();
    const query = new URLSearchParams({
      "api-version": "7.1",
      includeContentMetadata: "true",
      includeLinks: "true",
      latestProcessedChange: "true",
      recursionLevel: "Full",
      scopePath: "/",
      "versionDescriptor.version": this.branch,
      "versionDescriptor.versionType": "branch"
    });
    const result = await this.requestJson(
      `${apiBaseUrl}/items?${query}`,
      {
        action: `Listing the latest ${this.branch} files from Azure Repos`
      }
    );

    const items = Array.isArray(result?.value) ? result.value : [];

    if (!options.includeSizes) {
      return items;
    }

    const rootTree = items.find(
      (item) =>
        item.path === "/" &&
        String(item.gitObjectType || "").toLowerCase() === "tree"
    );

    if (!rootTree?.objectId) {
      return items;
    }

    const treeEntries = await this.listRepositoryTreeEntries(
      rootTree.objectId
    );
    const sizeByObjectId = new Map(
      treeEntries
        .filter(
          (entry) =>
            String(entry.gitObjectType || "").toLowerCase() === "blob" &&
            entry.objectId &&
            Number.isFinite(Number(entry.size))
        )
        .map((entry) => [entry.objectId, Number(entry.size)])
    );

    return items.map((item) => {
      const size = sizeByObjectId.get(item.objectId);

      return size === undefined ? item : { ...item, size };
    });
  }

  async listRepositoryTreeEntries(treeObjectId) {
    const { apiBaseUrl } = this.getRepositoryDetails();
    const query = new URLSearchParams({
      "api-version": "7.1",
      recursive: "true"
    });
    const tree = await this.requestJson(
      `${apiBaseUrl}/trees/${encodeURIComponent(treeObjectId)}?${query}`,
      {
        action: "Reading Azure Repos file sizes"
      }
    );

    return Array.isArray(tree?.treeEntries) ? tree.treeEntries : [];
  }

  async getBranchReference() {
    const { apiBaseUrl } = this.getRepositoryDetails();
    const referenceName = `refs/heads/${this.branch}`;
    const query = new URLSearchParams({
      "api-version": "7.1",
      filter: `heads/${this.branch}`
    });
    const result = await this.requestJson(
      `${apiBaseUrl}/refs?${query}`,
      {
        action: `Reading the latest ${this.branch} branch reference`
      }
    );

    return (result?.value || []).find(
      (reference) => reference.name === referenceName
    );
  }

  async listCommits(options = {}) {
    const { apiBaseUrl } = this.getRepositoryDetails();
    const days = Math.min(31, Math.max(7, Number(options.days) || 14));
    const fromDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString();
    const query = new URLSearchParams({
      "api-version": "7.1",
      "searchCriteria.$top": "100",
      "searchCriteria.fromDate": fromDate,
      "searchCriteria.itemVersion.version": this.branch,
      "searchCriteria.itemVersion.versionType": "branch"
    });
    const result = await this.requestJson(`${apiBaseUrl}/commits?${query}`, {
      action: `Reading ${this.branch} commit history from Azure Repos`
    });

    return Array.isArray(result?.value) ? result.value : [];
  }

  async listCommitChanges(commitId) {
    const { apiBaseUrl } = this.getRepositoryDetails();
    const query = new URLSearchParams({
      "api-version": "7.1",
      "$top": "100"
    });
    const result = await this.requestJson(
      `${apiBaseUrl}/commits/${encodeURIComponent(commitId)}/changes?${query}`,
      { action: `Reading Azure Repos changes for commit ${commitId}` }
    );

    return Array.isArray(result?.changes) ? result.changes : [];
  }

  async createPush({
    changes,
    comment,
    oldObjectId =
      "0000000000000000000000000000000000000000"
  }) {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new TypeError("At least one Azure file change is required");
    }

    const { apiBaseUrl } = this.getRepositoryDetails();
    const query = new URLSearchParams({
      "api-version": "7.1"
    });
    const body = {
      commits: [
        {
          changes,
          comment
        }
      ],
      refUpdates: [
        {
          name: `refs/heads/${this.branch}`,
          oldObjectId
        }
      ]
    };

    return this.requestJson(`${apiBaseUrl}/pushes?${query}`, {
      action: `Pushing ${changes.length} file(s) to ${this.branch}`,
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  }

  async createFilePush({ changes, comment, oldObjectId }) {
    return this.createPush({
      changes: changes.map((change) => ({
        changeType: "add",
        item: {
          path: change.path
        },
        newContent: {
          content: change.content.toString("base64"),
          contentType: "base64Encoded"
        }
      })),
      comment,
      oldObjectId
    });
  }

  async createFileDeletePush({ comment, oldObjectId, path: filePath }) {
    return this.createFilesDeletePush({
      comment,
      oldObjectId,
      paths: [filePath]
    });
  }

  async createFilesDeletePush({ comment, oldObjectId, paths }) {
    return this.createPush({
      changes: paths.map((filePath) => ({
        changeType: "delete",
        item: {
          path: filePath
        }
      })),
      comment,
      oldObjectId
    });
  }

  async downloadRepositoryItem(filePath, options = {}) {
    const { apiBaseUrl } = this.getRepositoryDetails();
    const query = new URLSearchParams({
      "$format": "octetStream",
      "api-version": "7.1",
      download: "true",
      path: filePath,
      "versionDescriptor.version": this.branch,
      "versionDescriptor.versionType": "branch"
    });

    return this.request(`${apiBaseUrl}/items?${query}`, {
      action:
        `Downloading ${filePath} from the latest ${this.branch} branch`,
      headers: {
        Accept: "application/octet-stream",
        ...(options.range ? { Range: options.range } : {})
      }
    });
  }

  createFileWebUrl(filePath) {
    const { browserUrl } = this.getRepositoryDetails();
    const url = new URL(browserUrl);

    url.searchParams.set("path", filePath);
    url.searchParams.set("version", `GB${this.branch}`);
    url.searchParams.set("_a", "contents");
    return url.toString();
  }
}

module.exports = {
  AzureDevOpsApiClient,
  parseAzureRemoteUrl
};
