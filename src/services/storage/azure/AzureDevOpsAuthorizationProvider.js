const { ManagedIdentityCredential } = require("@azure/identity");
const {
  ConfigurationError
} = require("../../../errors/ApplicationError");

const AZURE_DEVOPS_SCOPE =
  "https://app.vssps.visualstudio.com/.default";

class AzureDevOpsAuthorizationProvider {
  constructor(options = {}) {
    this.configurationName =
      options.configurationName || "Azure authorization";
  }

  isConfigured() {
    return false;
  }

  getMissingConfigurationName() {
    return this.configurationName;
  }

  async getAuthorizationHeader() {
    throw new ConfigurationError(
      `${this.configurationName} is not configured`
    );
  }
}

class PersonalAccessTokenAuthorizationProvider extends
  AzureDevOpsAuthorizationProvider {
  constructor(options = {}) {
    super({
      configurationName:
        options.configurationName || "AZURE_DEVOPS_PAT"
    });
    this.pat = options.pat;
  }

  isConfigured() {
    return Boolean(this.pat);
  }

  async getAuthorizationHeader() {
    if (!this.isConfigured()) {
      return super.getAuthorizationHeader();
    }

    const encodedPat = Buffer.from(`:${this.pat}`).toString("base64");
    return `Basic ${encodedPat}`;
  }
}

class ManagedIdentityAuthorizationProvider extends
  AzureDevOpsAuthorizationProvider {
  constructor(options = {}) {
    super({
      configurationName:
        options.configurationName || "Azure managed identity"
    });
    this.clientId = options.clientId;
    this.credential =
      options.credential ||
      new ManagedIdentityCredential(
        this.clientId ? { clientId: this.clientId } : undefined
      );
    this.scope = options.scope || AZURE_DEVOPS_SCOPE;
  }

  isConfigured() {
    return true;
  }

  async getAuthorizationHeader() {
    const accessToken = await this.credential.getToken(this.scope);

    if (!accessToken?.token) {
      throw new Error(
        "The Azure managed identity returned an empty access token"
      );
    }

    return `Bearer ${accessToken.token}`;
  }
}

function createAzureDevOpsAuthorizationProvider(options = {}) {
  const mode = String(options.mode || "pat").trim().toLowerCase();

  if (mode === "pat") {
    return new PersonalAccessTokenAuthorizationProvider(options);
  }

  if (mode === "managed-identity") {
    return new ManagedIdentityAuthorizationProvider(options);
  }

  throw new ConfigurationError(
    `Unsupported Azure authorization mode: ${options.mode}`
  );
}

module.exports = {
  AZURE_DEVOPS_SCOPE,
  AzureDevOpsAuthorizationProvider,
  ManagedIdentityAuthorizationProvider,
  PersonalAccessTokenAuthorizationProvider,
  createAzureDevOpsAuthorizationProvider
};
