const {
  ConfigurationError,
  ExternalServiceError
} = require("../../../errors/ApplicationError");
const dns = require("node:dns");

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
      "AZURE_GIT_REMOTE must use HTTPS for cloud file listings"
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
    this.fetch = options.fetch || globalThis.fetch;
    this.ipv4Only = Boolean(options.ipv4Only);
    this.pat = options.pat;
    this.remote = options.remote;
    this.repositoryDetails = undefined;

    if (this.ipv4Only && !options.fetch) {
      dns.setDefaultResultOrder("ipv4first");
    }
  }

  isConfigured() {
    return Boolean(this.remote && this.pat);
  }

  requireConfiguration() {
    const missing = [];

    if (!this.remote) {
      missing.push("AZURE_GIT_REMOTE");
    }

    if (!this.pat) {
      missing.push("AZURE_DEVOPS_PAT");
    }

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Missing Azure listing configuration: ${missing.join(", ")}`
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

  async requestJson(url, options = {}) {
    this.requireConfiguration();
    const { action, ...fetchOptions } = options;
    const encodedPat = Buffer.from(`:${this.pat}`).toString("base64");
    let response;

    try {
      response = await this.fetch(url, {
        ...fetchOptions,
        headers: {
          Accept: "application/json",
          ...(fetchOptions.headers || {}),
          Authorization: `Basic ${encodedPat}`
        }
      });
    } catch (error) {
      throw new ExternalServiceError(
        `${action || "Azure DevOps request"} could not reach Azure DevOps`,
        { cause: error }
      );
    }

    const text = await response.text();
    let body;

    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }

    if (!response.ok) {
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

    return body;
  }

  async listRepositoryItems() {
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

    return Array.isArray(result?.value) ? result.value : [];
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
